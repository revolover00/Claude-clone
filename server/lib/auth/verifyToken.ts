import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthErrorCode } from "./authHeader";

export type ServerAuthMode = "supabase" | "guest" | "unconfigured";

export interface AuthUser {
  id: string;
  email?: string;
}

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; code: AuthErrorCode; message?: string };

/** How long we wait for Supabase before reporting AUTH_UNAVAILABLE. */
export const VERIFY_TIMEOUT_MS = 8000;

// Configuration is read lazily (not at import time) so a `.env` loaded after
// this module is imported is still honoured, and tests can switch modes.
function readAuthConfig() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const configured = Boolean(
    url && serviceKey && !url.includes("YOUR_") && !serviceKey.includes("YOUR_")
  );
  const isProd = process.env.NODE_ENV === "production";
  const guestFlag = process.env.ALLOW_GUEST === "true" || process.env.VITE_ALLOW_GUEST === "true";
  return { url, serviceKey, configured, guestAllowed: !isProd && guestFlag };
}

/** Guest/mock tokens are accepted only outside production with ALLOW_GUEST=true. */
export function isGuestAllowed(): boolean {
  return readAuthConfig().guestAllowed;
}

export function getServerAuthMode(): ServerAuthMode {
  const config = readAuthConfig();
  if (config.configured) return "supabase";
  if (config.guestAllowed) return "guest";
  return "unconfigured";
}

let cachedClient: { url: string; serviceKey: string; client: SupabaseClient } | null = null;

function getAuthClient(): SupabaseClient | null {
  const { url, serviceKey, configured } = readAuthConfig();
  if (!configured) return null;
  if (!cachedClient || cachedClient.url !== url || cachedClient.serviceKey !== serviceKey) {
    cachedClient = {
      url,
      serviceKey,
      client: createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
    };
  }
  return cachedClient.client;
}

/** Reads the (unverified) `exp` claim. Used only to refine an already rejected token. */
export function isJwtExpired(token: string, nowMs = Date.now()): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof claims?.exp === "number" && claims.exp * 1000 <= nowMs;
  } catch {
    return false;
  }
}

/**
 * Maps a Supabase `getUser` error to a reason code. Network failures, Supabase
 * outages (5xx), rate limiting and errors without a status are "unavailable":
 * the token may be perfectly valid, so the client must not be signed out.
 */
export function classifyVerificationError(error: unknown, token: string): AuthErrorCode {
  const err = (error ?? {}) as { name?: unknown; status?: unknown; code?: unknown; message?: unknown };
  const status = typeof err.status === "number" ? err.status : undefined;
  if (
    err.name === "AuthRetryableFetchError" ||
    status === undefined ||
    status === 0 ||
    status === 429 ||
    status >= 500
  ) {
    return "AUTH_UNAVAILABLE";
  }
  const message = typeof err.message === "string" ? err.message : "";
  if (err.code === "session_expired" || /expired/i.test(message) || isJwtExpired(token)) {
    return "AUTH_TOKEN_EXPIRED";
  }
  return "AUTH_TOKEN_INVALID";
}

export async function verifySupabaseToken(token: string): Promise<AuthResult> {
  const client = getAuthClient();
  if (!client) return { ok: false, code: "AUTH_UNAVAILABLE" };

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Supabase verification timed out")), VERIFY_TIMEOUT_MS);
    });
    const { data, error } = await Promise.race([client.auth.getUser(token), timeout]);
    if (error) return { ok: false, code: classifyVerificationError(error, token) };
    if (!data?.user?.id) return { ok: false, code: "AUTH_TOKEN_INVALID" };
    return { ok: true, user: { id: data.user.id, email: data.user.email } };
  } catch {
    // Thrown (not returned) errors mean Supabase could not be reached or timed out.
    return { ok: false, code: "AUTH_UNAVAILABLE" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
