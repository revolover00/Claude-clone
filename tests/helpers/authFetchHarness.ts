/** Shared fixtures for the authFetch test files (not a test file itself). */

export const nowSec = () => Math.floor(Date.now() / 1000);

export const makeSession = (token: string, expiresInSec = 3600) => ({
  access_token: token,
  expires_at: nowSec() + expiresInSec,
});

export const sessionResult = (session: unknown) => ({ data: { session }, error: null });

export const refreshOk = (token: string) => ({
  data: { session: makeSession(token), user: { id: "u1" } },
  error: null,
});

export const refreshFailed = () => ({
  data: { session: null, user: null },
  error: { message: "Invalid Refresh Token" },
});

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const unauthorized = (code: string) => jsonResponse(401, { error: "Your session is not valid.", code });

export function headerValue(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    const hit = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return hit ? hit[1] : null;
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? record[key] : null;
}

/** Authorization header sent by the n-th call of a mocked fetch. */
export function authorizationOfCall(calls: unknown[][], index: number): string | null {
  const init = calls[index]?.[1] as RequestInit | undefined;
  return headerValue(init?.headers, "Authorization");
}
