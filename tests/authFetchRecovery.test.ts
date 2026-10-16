import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  authorizationOfCall,
  headerValue,
  jsonResponse,
  makeSession,
  refreshFailed,
  refreshOk,
  sessionResult,
  unauthorized,
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

import { authFetch, refreshSessionShared } from "../src/utils/authHeaders";
import { SESSION_EXPIRED_EVENT } from "../src/utils/authErrors";

let fetchSpy: ReturnType<typeof vi.spyOn>;
const authorizationOf = (index: number) => authorizationOfCall(fetchSpy.mock.calls, index);

const expiredEvents: CustomEvent[] = [];
const onExpired = (e: Event) => expiredEvents.push(e as CustomEvent);

beforeEach(() => {
  mocks.getSession.mockReset();
  mocks.refreshSession.mockReset();
  expiredEvents.length = 0;
  window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
  mocks.getSession.mockResolvedValue(sessionResult(makeSession("real-jwt")));
  mocks.refreshSession.mockResolvedValue(refreshFailed());
  fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => jsonResponse(200, []));
});

afterEach(() => {
  window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  fetchSpy.mockRestore();
});

describe("authFetch refresh-and-retry", () => {
  it("on a 401 with an AUTH_* code it refreshes once and retries the request once", async () => {
    fetchSpy
      .mockImplementationOnce(async () => unauthorized("AUTH_TOKEN_EXPIRED"))
      .mockImplementationOnce(async () => jsonResponse(200, { ok: true }));
    mocks.refreshSession.mockResolvedValue(refreshOk("rotated-jwt"));

    const res = await authFetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"content":"x"}',
    });

    expect(res.status).toBe(200);
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(authorizationOf(0)).toBe("Bearer real-jwt");
    expect(authorizationOf(1)).toBe("Bearer rotated-jwt");
    const [, retryInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
    expect(retryInit.method).toBe("POST");
    expect(retryInit.body).toBe('{"content":"x"}');
    expect(headerValue(retryInit.headers, "Content-Type")).toBe("application/json");
    expect(expiredEvents).toHaveLength(0);
  });

  it("leaves 401 responses without an AUTH_* code and other errors alone", async () => {
    fetchSpy
      .mockImplementationOnce(async () => jsonResponse(401, { error: "Upstream provider rejected the key" }))
      .mockImplementationOnce(async () => jsonResponse(500, { error: "boom", code: "AUTH_TOKEN_INVALID" }));

    expect((await authFetch("/api/providers/test")).status).toBe(401);
    expect((await authFetch("/api/skills")).status).toBe(500);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(mocks.refreshSession).not.toHaveBeenCalled();
    expect(expiredEvents).toHaveLength(0);
  });

  it("retries AUTH_UNAVAILABLE once without refreshing and never ends the session", async () => {
    fetchSpy.mockImplementation(async () => unauthorized("AUTH_UNAVAILABLE"));

    const res = await authFetch("/api/skills");

    expect(res.status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(mocks.refreshSession).not.toHaveBeenCalled();
    expect(expiredEvents).toHaveLength(0);
  });

  it("returns a response whose body the caller can still read", async () => {
    fetchSpy.mockImplementation(async () => unauthorized("AUTH_TOKEN_INVALID"));

    const res = await authFetch("/api/skills");

    await expect(res.json()).resolves.toMatchObject({ code: "AUTH_TOKEN_INVALID" });
  });
});

describe("single shared refresh", () => {
  it("concurrent requests with an expiring token share one in-flight refresh", async () => {
    mocks.getSession.mockResolvedValue(sessionResult(makeSession("expiring", 10)));
    let resolveRefresh!: (value: unknown) => void;
    mocks.refreshSession.mockImplementation(() => new Promise((resolve) => (resolveRefresh = resolve)));

    const pending = Promise.all([authFetch("/api/a"), authFetch("/api/b"), authFetch("/api/c")]);
    await vi.waitFor(() => expect(mocks.refreshSession).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);

    resolveRefresh(refreshOk("shared-jwt"));
    await pending;

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    [0, 1, 2].forEach((i) => expect(authorizationOf(i)).toBe("Bearer shared-jwt"));
  });

  it("concurrent 401s trigger a single refresh, then each request retries once", async () => {
    const attempts = new Map<string, number>();
    fetchSpy.mockImplementation(async (input: any) => {
      const count = (attempts.get(String(input)) ?? 0) + 1;
      attempts.set(String(input), count);
      return count === 1 ? unauthorized("AUTH_TOKEN_EXPIRED") : jsonResponse(200, {});
    });
    mocks.refreshSession.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return refreshOk("rotated");
    });

    const results = await Promise.all([authFetch("/api/a"), authFetch("/api/b"), authFetch("/api/c")]);

    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });

  it("allows a new refresh once the previous one has settled", async () => {
    mocks.refreshSession.mockResolvedValue(refreshOk("next"));

    await refreshSessionShared();
    await refreshSessionShared();

    expect(mocks.refreshSession).toHaveBeenCalledTimes(2);
  });
});

describe("session-expired flow", () => {
  it("dispatches claude:session-expired when the retried request still fails", async () => {
    fetchSpy.mockImplementation(async () => unauthorized("AUTH_TOKEN_INVALID"));
    mocks.refreshSession.mockResolvedValue(refreshOk("rotated-but-rejected"));

    const res = await authFetch("/api/skills");

    expect(res.status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(expiredEvents).toHaveLength(1);
    expect(expiredEvents[0].detail).toEqual({ code: "AUTH_TOKEN_INVALID", source: "authFetch" });
  });

  it("dispatches claude:session-expired without retrying when the refresh fails", async () => {
    fetchSpy.mockImplementation(async () => unauthorized("AUTH_TOKEN_EXPIRED"));

    const res = await authFetch("/api/skills");

    expect(res.status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(expiredEvents).toHaveLength(1);
    expect(JSON.stringify(expiredEvents[0].detail)).not.toContain("real-jwt");
  });
});
