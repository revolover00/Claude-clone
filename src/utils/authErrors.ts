/**
 * Client-side vocabulary for authentication failures: the reason codes the
 * server returns in 401 bodies, a typed API error, and the session-expired event.
 */

export const SESSION_EXPIRED_EVENT = "claude:session-expired";
export const SESSION_EXPIRED_MESSAGE = "Your session expired, please sign in again";

export type AuthErrorCode =
  | "AUTH_HEADER_MISSING"
  | "AUTH_HEADER_MALFORMED"
  | "AUTH_TOKEN_INVALID"
  | "AUTH_TOKEN_EXPIRED"
  | "AUTH_UNAVAILABLE";

export interface SessionExpiredDetail {
  /** Reason code, e.g. AUTH_TOKEN_EXPIRED; never a token. */
  code?: string;
  /** "authFetch" when recovery failed automatically, "user" for "Sign in again". */
  source: "authFetch" | "user";
}

/** Error thrown by `safeFetchJson` for non-2xx responses. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function isAuthErrorCode(code: unknown): code is AuthErrorCode {
  return typeof code === "string" && code.startsWith("AUTH_");
}

/** True for anything that means "the server did not accept our session". */
export function isSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, code, message } = error as { status?: unknown; code?: unknown; message?: unknown };
  if (status === 401 || isAuthErrorCode(code)) return true;
  // Errors built from raw HTTP text (e.g. "HTTP 401", "status 401") still count.
  return typeof message === "string" && /\b(status|HTTP)\s+401\b/i.test(message);
}

/** The technical code shown in "Details" (e.g. AUTH_TOKEN_EXPIRED or HTTP_401). */
export function sessionErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return isAuthErrorCode(code) ? code : "HTTP_401";
}

/**
 * Reads the AUTH_* code from a 401 response without consuming the body the
 * caller will read. Returns null for any other response.
 */
export async function readAuthErrorCode(res: Response): Promise<AuthErrorCode | null> {
  if (!res || res.status !== 401) return null;
  try {
    const copy = typeof res.clone === "function" ? res.clone() : res;
    const data = await copy.json();
    return isAuthErrorCode(data?.code) ? data.code : null;
  } catch {
    return null;
  }
}

export function notifySessionExpired(detail: SessionExpiredDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, { detail }));
}

/** Used by "Sign in again" buttons: AuthContext signs out and shows the login screen. */
export function requestSignIn(code?: string): void {
  notifySessionExpired({ code, source: "user" });
}
