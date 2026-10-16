import { authFetch, getAuthToken, getAuthHeaders } from "./authHeaders";
import { ApiError } from "./authErrors";

export { authFetch, getAuthToken, getAuthHeaders, ApiError };

function parseErrorBody(bodyText: string): { code?: string; message?: string } {
  try {
    const data = JSON.parse(bodyText);
    return {
      code: typeof data?.code === "string" ? data.code : undefined,
      message: typeof data?.error === "string" ? data.error : undefined,
    };
  } catch {
    return {};
  }
}

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
    const { code, message } = parseErrorBody(bodyText);
    if (res.status === 401) {
      // Session problems get a friendly message plus the machine-readable code;
      // the UI renders them as a "Your session is not valid" card.
      throw new ApiError(message || "Your session is not valid.", 401, code);
    }
    throw new ApiError(
      `Request failed with status ${res.status} (${res.statusText}): ${bodyText.slice(0, 200)}`,
      res.status,
      code
    );
  }

  const rawText = await res.text();
  try {
    return JSON.parse(rawText) as T;
  } catch (err: any) {
    throw new Error(
      `Invalid response format (expected JSON, received: "${rawText.slice(0, 100)}..."): ${err.message}`,
      { cause: err }
    );
  }
}
