import { supabase } from "./supabaseClient";

export async function getAuthToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return session.access_token;
    }
  } catch {
    // ignore
  }

  try {
    const local = localStorage.getItem("supabase_token");
    if (local && local !== "mock-jwt-token-guest") {
      return local;
    }
  } catch {
    // ignore
  }

  return null;
}

export async function getAuthHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const token = await getAuthToken();
  const headers = new Headers(extra || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function authFetch(
  url: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  const headers = await getAuthHeaders(init?.headers);
  return fetch(url, {
    ...init,
    headers,
  });
}
