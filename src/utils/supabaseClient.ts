import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";

const isRealSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes("YOUR_") && 
  !supabaseAnonKey.includes("YOUR_")
);

function getMockSession() {
  try {
    const saved = localStorage.getItem("claude_clone_mock_session");
    if (saved) return JSON.parse(saved);
  } catch {}
  
  // Default logged-in guest session so that the user doesn't even have to log in!
  const defaultSession = {
    access_token: "mock-jwt-token-12345",
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: "mock-refresh-token",
    user: {
      id: "00000000-0000-0000-0000-000000000000",
      email: "guest@example.com",
      user_metadata: { name: "Guest User" },
      role: "authenticated",
    },
  };
  try {
    localStorage.setItem("claude_clone_mock_session", JSON.stringify(defaultSession));
  } catch {}
  return defaultSession;
}

const authListeners = new Set<(event: string, session: any) => void>();

// Mock client implementation
const mockSupabase = {
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
      const session = {
        access_token: "mock-jwt-token-12345",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "mock-refresh-token",
        user: {
          id: "00000000-0000-0000-0000-000000000000",
          email: email || "guest@example.com",
          user_metadata: { name: email ? email.split("@")[0] : "Guest User" },
          role: "authenticated",
        },
      };
      localStorage.setItem("claude_clone_mock_session", JSON.stringify(session));
      authListeners.forEach((cb) => cb("SIGNED_IN", session));
      return { data: { session, user: session.user }, error: null };
    },
    signUp: async ({ email }: { email: string }) => {
      const session = {
        access_token: "mock-jwt-token-12345",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "mock-refresh-token",
        user: {
          id: "00000000-0000-0000-0000-000000000000",
          email: email || "guest@example.com",
          user_metadata: { name: email ? email.split("@")[0] : "Guest User" },
          role: "authenticated",
        },
      };
      localStorage.setItem("claude_clone_mock_session", JSON.stringify(session));
      authListeners.forEach((cb) => cb("SIGNED_IN", session));
      return { data: { session, user: session.user }, error: null };
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
    const chainable = {
      select: () => chainable,
      insert: async () => ({ error: null }),
      update: async () => ({ error: null }),
      delete: async () => ({ error: null }),
      eq: () => chainable,
      single: async () => {
        if (table === "profiles") {
          return {
            data: {
              id: "00000000-0000-0000-0000-000000000000",
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
              user_id: "00000000-0000-0000-0000-000000000000",
              response_style: "Normal",
              profile_instructions: "",
              settings: {},
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    };
    return chainable;
  },
};

export const supabase = isRealSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (mockSupabase as any);
