import { isDevGuestEnabled } from "./devGuestMode";

type AuthListener = (event: string, session: any) => void;
const env = (import.meta as any)?.env || (typeof process !== "undefined" ? process.env : {}) || {};
const isDev = Boolean(env.DEV ?? (env.NODE_ENV !== "production"));
const localExplicitOn = env.VITE_ALLOW_LOCAL_MODE === "true" || env.ALLOW_GUEST === "true";
const localExplicitOff = env.VITE_ALLOW_LOCAL_MODE === "false" || env.ALLOW_GUEST === "false";
const allowLocalMode = localExplicitOn || (isDev && !localExplicitOff);
const showGuestButton = isDevGuestEnabled(env);
const authListeners = new Set<AuthListener>();

function createGuestSession() {
  const guestId = globalThis.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
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
}

function persistSession(session: any) {
  try { localStorage.setItem("claude_clone_mock_session", JSON.stringify(session)); } catch { /* ignored */ }
  return session;
}

export function getMockSession() {
  if (!isDev || !allowLocalMode) return null;
  try {
    const saved = localStorage.getItem("claude_clone_mock_session");
    if (saved) return JSON.parse(saved);
  } catch { /* ignored */ }
  // Preserve bare `npm run dev` behavior, but explicit opt-in must be user-triggered.
  return showGuestButton ? null : persistSession(createGuestSession());
}

function ensureMockSession() {
  if (!isDev || !allowLocalMode) return null;
  return getMockSession() || createGuestSession();
}

function notify(event: string, session: any) {
  authListeners.forEach((callback) => callback(event, session));
}

function signInResult(email?: string) {
  const session = ensureMockSession();
  if (!session) return { data: { session: null, user: null }, error: { message: "Local mock authentication is disabled" } };
  if (email) {
    session.user.email = email;
    session.user.user_metadata = { name: email.split("@")[0] };
  }
  persistSession(session);
  notify("SIGNED_IN", session);
  return { data: { session, user: session.user }, error: null };
}

export const mockAuth = {
  getSession: async () => ({ data: { session: getMockSession() }, error: null }),
  onAuthStateChange: (callback: AuthListener) => {
    authListeners.add(callback);
    const session = getMockSession();
    setTimeout(() => callback(session ? "SIGNED_IN" : "SIGNED_OUT", session), 0);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
  },
  signInWithPassword: async ({ email }: { email: string }) => signInResult(email),
  signUp: async ({ email }: { email: string }) => signInResult(email),
  signInAsGuest: async () => {
    if (!showGuestButton || !allowLocalMode) {
      return { data: { session: null, user: null }, error: { message: "Development guest mode is disabled" } };
    }
    const session = persistSession(createGuestSession());
    notify("SIGNED_IN", session);
    return { data: { session, user: session.user }, error: null };
  },
  signOut: async () => {
    try { localStorage.removeItem("claude_clone_mock_session"); } catch { /* ignored */ }
    notify("SIGNED_OUT", null);
    return { error: null };
  },
  refreshSession: async () => {
    const session = getMockSession();
    return { data: { session, user: session?.user ?? null }, error: session ? null : { message: "Auth session missing!" } };
  },
  resetPasswordForEmail: async () => ({ error: null }),
  signInWithOAuth: async () => {
    const session = ensureMockSession();
    if (!session) return { error: { message: "Local mock authentication is disabled" } };
    persistSession(session);
    notify("SIGNED_IN", session);
    return { error: null };
  },
};
