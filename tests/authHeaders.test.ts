import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  authorizationOfCall,
  headerValue,
  jsonResponse,
  makeSession,
  refreshFailed,
  refreshOk,
  sessionResult,
} from "./helpers/authFetchHarness";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn() }));

vi.mock("../src/utils/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: () => mocks.getSession(),
      refreshSession: () => mocks.refreshSession(),
    },
  },
  isRealSupabaseConfigured: true,
}));

import { getAuthToken, getAuthHeaders, authFetch } from "../src/utils/authHeaders";

let fetchSpy: ReturnType<typeof vi.spyOn>;
const authorizationOf = (index: number) => authorizationOfCall(fetchSpy.mock.calls, index);

beforeEach(() => {
  mocks.getSession.mockReset();
  mocks.refreshSession.mockReset();
  localStorage.clear();
  mocks.getSession.mockResolvedValue(sessionResult(makeSession("real-jwt")));
  mocks.refreshSession.mockResolvedValue(refreshFailed());
  fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => jsonResponse(200, []));
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe("session token source", () => {
  it("uses the access token of the active session", async () => {
    expect(await getAuthToken()).toBe("real-jwt");
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  it("picks up a rotated token instead of a stale cached one", async () => {
    mocks.getSession
      .mockResolvedValueOnce(sessionResult(makeSession("token-v1")))
      .mockResolvedValueOnce(sessionResult(makeSession("token-v2")));

    expect(await getAuthToken()).toBe("token-v1");
    expect(await getAuthToken()).toBe("token-v2");
  });

  it("never falls back to a token copied into localStorage", async () => {
    mocks.getSession.mockResolvedValue(sessionResult(null));
    localStorage.setItem("supabase_token", "persisted-token");

    expect(await getAuthToken()).toBeNull();
  });

  it("does not persist the access token in localStorage", async () => {
    mocks.getSession.mockResolvedValue(sessionResult(makeSession("secret-access-token")));

    await authFetch("/api/skills");

    const stored = Object.keys(localStorage).map((key) => `${key}=${localStorage.getItem(key)}`);
    expect(stored.join("\n")).not.toContain("secret-access-token");
  });

  it("returns null instead of throwing when the auth client fails", async () => {
    mocks.getSession.mockRejectedValue(new Error("network down"));
    mocks.refreshSession.mockRejectedValue(new Error("network down"));

    await expect(getAuthToken()).resolves.toBeNull();
  });
});

describe("proactive refresh before a request", () => {
  it("refreshes once when the token expires within 60 seconds and sends the new token", async () => {
    mocks.getSession.mockResolvedValue(sessionResult(makeSession("about-to-expire", 30)));
    mocks.refreshSession.mockResolvedValue(refreshOk("fresh-jwt"));

    await authFetch("/api/skills");

    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(authorizationOf(0)).toBe("Bearer fresh-jwt");
  });

  it("does not refresh a token that is valid for longer than 60 seconds", async () => {
    mocks.getSession.mockResolvedValue(sessionResult(makeSession("still-good", 5 * 60)));

    await authFetch("/api/skills");

    expect(mocks.refreshSession).not.toHaveBeenCalled();
    expect(authorizationOf(0)).toBe("Bearer still-good");
  });

  it("tries one refresh when there is no session, then sends no Authorization header", async () => {
    mocks.getSession.mockResolvedValue(sessionResult(null));

    const headers = await getAuthHeaders();

    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(headerValue(headers, "Authorization")).toBeNull();
  });

  it("keeps using a not-yet-expired token when the proactive refresh fails", async () => {
    mocks.getSession.mockResolvedValue(sessionResult(makeSession("expiring-but-valid", 20)));

    await authFetch("/api/skills");

    expect(authorizationOf(0)).toBe("Bearer expiring-but-valid");
  });
});

describe("getAuthHeaders", () => {
  it("adds Authorization when the caller did not set one", async () => {
    expect(headerValue(await getAuthHeaders(), "Authorization")).toBe("Bearer real-jwt");
  });

  it("keeps an explicit caller Authorization header", async () => {
    const headers = await getAuthHeaders({ Authorization: "Bearer caller-token" });

    expect(headerValue(headers, "Authorization")).toBe("Bearer caller-token");
  });
});

describe("authFetch", () => {
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

    expect(authorizationOf(0)).toBe("Bearer real-jwt");
  });
});
