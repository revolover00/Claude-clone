import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("mock guest session", () => {
  it("creates and persists a guest session after explicit dev opt-in", async () => {
    vi.stubEnv("VITE_ALLOW_LOCAL_MODE", "true");
    const { mockAuth } = await import("../src/utils/supabaseMockAuth");
    const result = await mockAuth.signInAsGuest();
    const saved = JSON.parse(localStorage.getItem("claude_clone_mock_session") || "null");

    expect(result.error).toBeNull();
    expect(result.data.session.user.user_metadata.name).toBe("Guest User");
    expect(saved.access_token).toBe(result.data.session.access_token);
    expect(saved.access_token).toMatch(/^mock-jwt-token-/);
  });

  it("refuses to create a guest session when opt-in is disabled", async () => {
    vi.stubEnv("VITE_ALLOW_LOCAL_MODE", "false");
    const { mockAuth } = await import("../src/utils/supabaseMockAuth");
    const result = await mockAuth.signInAsGuest();

    expect(result.data.session).toBeNull();
    expect(result.error?.message).toContain("disabled");
    expect(localStorage.getItem("claude_clone_mock_session")).toBeNull();
  });
});
