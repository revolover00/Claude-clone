import { isAuthRetryableFetchError, type Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { notifySessionExpired, readAuthErrorCode } from "./authErrors";

/** Refresh proactively when the access token expires within this window. */
export const REFRESH_MARGIN_MS = 60 * 1000;

type UsableSession = Pick<Session, "access_token"> & { expires_at?: number };

interface RefreshOutcome {
  session: UsableSession | null;
  error: unknown | null;
}

let refreshInFlight: Promise<RefreshOutcome> | null = null;

/** Concurrent callers share one refresh while retaining its error classification. */
async function refreshSessionOutcomeShared(): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        return {
          session: data?.session?.access_token ? (data.session as UsableSession) : null,
          error: error ?? null,
        };
      } catch (error) {
        return { session: null, error };
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Resolves to null when the session could not be refreshed. */
export async function refreshSessionShared(): Promise<UsableSession | null> {
  return (await refreshSessionOutcomeShared()).session;
}

function isTransientRefreshError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (isAuthRetryableFetchError(error)) return true;
  const details = error as { name?: unknown; status?: unknown; message?: unknown };
  const status = typeof details.status === "number" ? details.status : null;
  if (status === 0 || status === 408 || status === 429 || (status !== null && status >= 500)) return true;
  return details.name === "AbortError" ||
    (typeof details.message === "string" && /network|fetch|offline|timeout|timed out|temporar/i.test(details.message));
}

function expiresWithin(session: UsableSession | null, ms: number): boolean {
  const exp = session?.expires_at;
  return typeof exp === "number" && exp * 1000 - Date.now() < ms;
}

async function readSession(): Promise<UsableSession | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return (data?.session as UsableSession | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * The session to authenticate the next request with. The token always comes
 * from Supabase's own session storage (never a copy in localStorage). When
 * there is no session or it expires within 60 seconds it is refreshed once.
 */
export async function getFreshSession(): Promise<UsableSession | null> {
  const session = await readSession();
  if (session?.access_token && !expiresWithin(session, REFRESH_MARGIN_MS)) return session;

  const refreshed = await refreshSessionShared();
  if (refreshed?.access_token) return refreshed;
  // Refresh failed: a token that has not actually expired yet is still worth sending.
  return session?.access_token && !expiresWithin(session, 0) ? session : null;
}

export async function getAuthToken(): Promise<string | null> {
  return (await getFreshSession())?.access_token ?? null;
}

function isRequest(input: unknown): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function baseHeaders(input: string | URL | Request, init?: RequestInit): HeadersInit | undefined {
  return init?.headers ?? (isRequest(input) ? input.headers : undefined);
}

function withAuthorization(base: HeadersInit | undefined, token?: string | null): Headers {
  const headers = new Headers(base || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function getAuthHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  return withAuthorization(extra, await getAuthToken());
}

function canReplayBody(init?: RequestInit): boolean {
  return !(typeof ReadableStream !== "undefined" && init?.body instanceof ReadableStream);
}

/**
 * `fetch` with the session's bearer token that heals auth failures itself:
 *  1. refreshes first when there is no session or it expires within 60s;
 *  2. on a 401 carrying an AUTH_* code, refreshes once (shared) and retries once;
 *  3. signs out only after a definitive refresh failure, not a network outage.
 * AUTH_UNAVAILABLE is retried once without refresh; transient refresh errors
 * preserve the stored session so a later request can recover it.
 */
export async function authFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  const callerAuthorization = new Headers(baseHeaders(input, init) || {}).has("Authorization");
  const replayable = canReplayBody(init) && !callerAuthorization;
  const retryInput = isRequest(input) && replayable ? input.clone() : input;
  const send = (target: string | URL | Request, token?: string | null) =>
    fetch(target, { ...init, headers: withAuthorization(baseHeaders(target, init), token) });

  const session = await getFreshSession();
  const first = await send(input, session?.access_token);

  const code = await readAuthErrorCode(first);
  if (!code || !replayable) return first;

  if (code === "AUTH_UNAVAILABLE") {
    return send(retryInput, session?.access_token);
  }

  const refreshOutcome = await refreshSessionOutcomeShared();
  const refreshed = refreshOutcome.session;
  if (!refreshed?.access_token) {
    if (!isTransientRefreshError(refreshOutcome.error)) {
      notifySessionExpired({ code, source: "authFetch" });
    }
    return first;
  }

  const retry = await send(retryInput, refreshed.access_token);
  const retryCode = await readAuthErrorCode(retry);
  if (retryCode && retryCode !== "AUTH_UNAVAILABLE") {
    notifySessionExpired({ code: retryCode, source: "authFetch" });
  }
  return retry;
}
