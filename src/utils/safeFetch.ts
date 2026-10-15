import { authFetch, getAuthToken, getAuthHeaders } from "./authHeaders";

export { authFetch, getAuthToken, getAuthHeaders };

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await authFetch(url, options);
  if (!res.ok) {
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      // ignore
    }
    throw new Error(
      `Request failed with status ${res.status} (${res.statusText}): ${bodyText.slice(0, 200)}`
    );
  }

  const rawText = await res.text();
  try {
    return JSON.parse(rawText) as T;
  } catch (err: any) {
    throw new Error(
      `Invalid response format (expected JSON, received: "${rawText.slice(0, 100)}..."): ${err.message}`
    );
  }
}
