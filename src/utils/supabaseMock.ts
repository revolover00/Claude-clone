import { FALLBACK_MODELS, normalizeSlug } from "../hooks/useModels";

const isDev = (import.meta as any).env.DEV;
const allowLocalMode = (import.meta as any).env.VITE_ALLOW_LOCAL_MODE === "true";

function getMockSession() {
  if (isDev && allowLocalMode) {
    try {
      const saved = localStorage.getItem("claude_clone_mock_session");
      if (saved) return JSON.parse(saved);
    } catch { /* ignored */ }
    
    // Default logged-in guest session using a non-shared unique ID
    const guestId = crypto.randomUUID();
    const defaultSession = {
      access_token: `mock-jwt-token-${guestId}`,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "mock-refresh-token",
      user: {
        id: guestId,
        email: "guest@example.com",
        user_metadata: { name: "Guest User" },
        role: "authenticated",
      },
    };
    try {
      localStorage.setItem("claude_clone_mock_session", JSON.stringify(defaultSession));
    } catch { /* ignored */ }
    return defaultSession;
  }
  return null;
}

const authListeners = new Set<(event: string, session: any) => void>();

function getMockModels() {
  try {
    const saved = localStorage.getItem("claude_clone_mock_models");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((m: any) => ({
          ...m,
          slug: normalizeSlug(m.slug),
        }));
      }
    }
  } catch { /* ignored */ }
  try {
    localStorage.setItem("claude_clone_mock_models", JSON.stringify(FALLBACK_MODELS));
  } catch { /* ignored */ }
  return FALLBACK_MODELS;
}

function saveMockModels(models: any[]) {
  try {
    localStorage.setItem("claude_clone_mock_models", JSON.stringify(models));
  } catch { /* ignored */ }
}

export const mockSupabase = {
  auth: {
    getSession: async () => {
      const session = getMockSession();
      return { data: { session }, error: null };
    },
    onAuthStateChange: (callback: any) => {
      authListeners.add(callback);
      const session = getMockSession();
      // Initially trigger
      setTimeout(() => {
        callback(session ? "SIGNED_IN" : "SIGNED_OUT", session);
      }, 0);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
    signInWithPassword: async ({ email }: { email: string }) => {
      const s = getMockSession();
      if (email) {
        s.user.email = email;
        s.user.user_metadata = { name: email.split("@")[0] };
      }
      localStorage.setItem("claude_clone_mock_session", JSON.stringify(s));
      authListeners.forEach((cb) => cb("SIGNED_IN", s));
      return { data: { session: s, user: s.user }, error: null };
    },
    signUp: async ({ email }: { email: string }) => {
      const s = getMockSession();
      if (email) {
        s.user.email = email;
        s.user.user_metadata = { name: email.split("@")[0] };
      }
      localStorage.setItem("claude_clone_mock_session", JSON.stringify(s));
      authListeners.forEach((cb) => cb("SIGNED_IN", s));
      return { data: { session: s, user: s.user }, error: null };
    },
    signOut: async () => {
      localStorage.removeItem("claude_clone_mock_session");
      authListeners.forEach((cb) => cb("SIGNED_OUT", null));
      return { error: null };
    },
    resetPasswordForEmail: async () => ({ error: null }),
    signInWithOAuth: async () => {
      const session = getMockSession();
      authListeners.forEach((cb) => cb("SIGNED_IN", session));
      return { error: null };
    },
  },
  from: (table: string) => {
    let list: any[] = [];
    if (table === "models") {
      list = getMockModels();
    } else if (table === "app_admins") {
      list = [{ user_id: getMockSession()?.user.id }];
    } else if (table === "memories") {
      try {
        const saved = localStorage.getItem("claude_clone_mock_memories");
        list = saved ? JSON.parse(saved) : [];
      } catch {
        list = [];
      }
    }

    const filters: Array<(item: any) => boolean> = [];
    let sortKey = "";
    let sortAscending = true;

    const chainable = {
      select: () => chainable,
      eq: (field: string, value: any) => {
        filters.push((item: any) => item[field] === value);
        return chainable;
      },
      order: (field: string, { ascending = true } = {}) => {
        sortKey = field;
        sortAscending = ascending;
        return chainable;
      },
      single: async () => {
        if (table === "profiles") {
          return {
            data: {
              id: getMockSession()?.user.id,
              display_name: "Guest User",
              avatar_url: null,
              locale: "en",
            },
            error: null,
          };
        }
        if (table === "user_preferences") {
          return {
            data: {
              user_id: getMockSession()?.user.id,
              response_style: "Normal",
              profile_instructions: "",
              settings: {},
              memory_enabled: true,
              sensitive_memory: false
            },
            error: null,
          };
        }
        let filtered = [...list];
        filters.forEach((f) => {
          filtered = filtered.filter(f);
        });
        return { data: filtered[0] || null, error: null };
      },
      insert: async (data: any) => {
        if (table === "models") {
          const current = getMockModels();
          const items = Array.isArray(data) ? data : [data];
          const newItems = items.map((item) => ({
            id: item.id || `m-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            ...item,
          }));
          const updated = [...current, ...newItems];
          saveMockModels(updated);
          return { data: newItems, error: null };
        }
        if (table === "memories") {
          try {
            const saved = localStorage.getItem("claude_clone_mock_memories");
            const current = saved ? JSON.parse(saved) : [];
            const items = Array.isArray(data) ? data : [data];
            const newItems = items.map((item) => ({
              id: item.id || `mem-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              pinned: false,
              status: "active",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...item,
            }));
            const updated = [...current, ...newItems];
            localStorage.setItem("claude_clone_mock_memories", JSON.stringify(updated));
            return { data: newItems, error: null };
          } catch {
            return { data: null, error: new Error("Failed to insert memory") };
          }
        }
        return { data: null, error: null };
      },
      update: async (data: any) => {
        if (table === "models") {
          const current = getMockModels();
          const updated = current.map((item: any) => {
            let match = true;
            filters.forEach((f) => {
              if (!f(item)) match = false;
            });
            if (match) {
              return { ...item, ...data };
            }
            return item;
          });
          saveMockModels(updated);
          return { data, error: null };
        }
        if (table === "memories") {
          try {
            const saved = localStorage.getItem("claude_clone_mock_memories");
            const current = saved ? JSON.parse(saved) : [];
            const updated = current.map((item: any) => {
              let match = true;
              filters.forEach((f) => {
                if (!f(item)) match = false;
              });
              if (match) {
                return { ...item, ...data, updated_at: new Date().toISOString() };
              }
              return item;
            });
            localStorage.setItem("claude_clone_mock_memories", JSON.stringify(updated));
            return { data, error: null };
          } catch {
            return { data: null, error: new Error("Failed to update memory") };
          }
        }
        return { data: null, error: null };
      },
      delete: () => {
        return {
          eq: async (field: string, value: any) => {
            if (table === "models") {
              const current = getMockModels();
              const filtered = current.filter((item: any) => item[field] !== value);
              saveMockModels(filtered);
            }
            if (table === "memories") {
              try {
                const saved = localStorage.getItem("claude_clone_mock_memories");
                const current = saved ? JSON.parse(saved) : [];
                const filtered = current.filter((item: any) => item[field] !== value);
                localStorage.setItem("claude_clone_mock_memories", JSON.stringify(filtered));
              } catch { /* ignored */ }
            }
            return { error: null };
          },
        };
      },
      then: (onfulfilled: any) => {
        let filtered = [...list];
        filters.forEach((f) => {
          filtered = filtered.filter(f);
        });
        if (sortKey) {
          filtered.sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];
            if (valA < valB) return sortAscending ? -1 : 1;
            if (valA > valB) return sortAscending ? 1 : -1;
            return 0;
          });
        }
        return Promise.resolve({ data: filtered, error: null }).then(onfulfilled);
      },
    };
    return chainable;
  },
};
