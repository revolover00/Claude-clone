import { describe, it, expect, vi, beforeEach } from "vitest";

const getSession = vi.fn();

vi.mock("../src/utils/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
    },
  },
  isRealSupabaseConfigured: true,
}));

import { getAuthToken, getAuthHeaders, authFetch } from "../src/utils/authHeaders";

const headerValue = (headers: HeadersInit | undefined, name: string): string | null => {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    const hit = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return hit ? hit[1] : null;
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? record[key] : null;
};

describe("authHeaders", () => {
  beforeEach(() => {
    getSession.mockReset();
    localStorage.clear();
  });

  it("uses the access token of the active session", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "real-jwt" } } });

    expect(await getAuthToken()).toBe("real-jwt");
  });

  it("picks up a rotated token instead of a stale cached one", async () => {
    getSession
      .mockResolvedValueOnce({ data: { session: { access_token: "token-v1" } } })
      .mockResolvedValueOnce({ data: { session: { access_token: "token-v2" } } });

    expect(await getAuthToken()).toBe("token-v1");
    expect(await getAuthToken()).toBe("token-v2");
  });

  it("falls back to the persisted session token when the client reports no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    localStorage.setItem("supabase_token", "persisted-token");

    expect(await getAuthToken()).toBe("persisted-token");
  });

  it("ignores the placeholder guest token stored in localStorage", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    localStorage.setItem("supabase_token", "mock-jwt-token-guest");

    expect(await getAuthToken()).toBeNull();
  });

  it("returns null instead of throwing when the auth client fails", async () => {
    getSession.mockRejectedValue(new Error("network down"));

    await expect(getAuthToken()).resolves.toBeNull();
  });
});

describe("getAuthHeaders", () => {
  beforeEach(() => {
    getSession.mockReset();
    localStorage.clear();
    getSession.mockResolvedValue({ data: { session: { access_token: "real-jwt" } } });
  });

  it("adds Authorization when the caller did not set one", async () => {
    const headers = await getAuthHeaders();

    expect(headerValue(headers, "Authorization")).toBe("Bearer real-jwt");
  });

  it("keeps an explicit caller Authorization header", async () => {
    const headers = await getAuthHeaders({ Authorization: "Bearer caller-token" });

    expect(headerValue(headers, "Authorization")).toBe("Bearer caller-token");
  });

  it("sends no Authorization header when there is no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    const headers = await getAuthHeaders();

    expect(headerValue(headers, "Authorization")).toBeNull();
  });
});

describe("authFetch", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getSession.mockReset();
    localStorage.clear();
    getSession.mockResolvedValue({ data: { session: { access_token: "real-jwt" } } });
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => ({
      ok: true,
      status: 200,
      text: async () => "[]",
      json: async () => [],
    }) as Response);
  });

  it("keeps method, body and other headers while attaching the token", async () => {
    await authFetch("/api/skills/deep-research/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/skills/deep-research/toggle");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"enabled":true}');
    expect(headerValue(init.headers, "Content-Type")).toBe("application/json");
    expect(headerValue(init.headers, "Authorization")).toBe("Bearer real-jwt");
  });

  it("works without an init object", async () => {
    await authFetch("/api/skills");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(headerValue(init.headers, "Authorization")).toBe("Bearer real-jwt");
  });
});
