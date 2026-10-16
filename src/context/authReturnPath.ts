/**
 * Remembers the page to return to after signing in again. Kept in
 * sessionStorage (per tab) so it survives the OAuth redirect round-trip.
 */

const RETURN_PATH_KEY = "claude:auth-return-to";
const LEGACY_TOKEN_KEY = "supabase_token";

/** Only same-origin, in-app paths are accepted (no "//host" open redirects). */
export function isSafeReturnPath(path: unknown): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

export function rememberReturnPath(path: string): void {
  if (!isSafeReturnPath(path)) return;
  try {
    sessionStorage.setItem(RETURN_PATH_KEY, path);
  } catch {
    // storage unavailable (e.g. blocked in an embedded preview): memory copy still works
  }
}

export function readReturnPath(): string | null {
  try {
    const stored = sessionStorage.getItem(RETURN_PATH_KEY);
    return isSafeReturnPath(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function clearReturnPath(): void {
  try {
    sessionStorage.removeItem(RETURN_PATH_KEY);
  } catch {
    // storage unavailable
  }
}

/**
 * Older builds copied the access token into localStorage["supabase_token"].
 * The session lives in Supabase's own storage, so drop that stale copy.
 */
export function clearLegacyTokenCopy(): void {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // storage unavailable
  }
}
