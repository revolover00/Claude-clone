import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const getSession = vi.fn();

vi.mock("../src/utils/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
    },
  },
  isRealSupabaseConfigured: true,
}));

import SkillsTab from "../src/components/modals/SkillsTab";

const SKILLS = [
  { id: "deep-research", name: "Deep research", description: "Plan and search the web", enabled: false },
];

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

function authorizationOf(init?: RequestInit): string | null {
  const headers = init?.headers;
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get("Authorization");
  if (Array.isArray(headers)) {
    const hit = headers.find(([key]) => key.toLowerCase() === "authorization");
    return hit ? hit[1] : null;
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find((k) => k.toLowerCase() === "authorization");
  return key ? record[key] : null;
}

// These two panels used to render "Request failed with status 401: Missing or
// invalid authorization header" because they called /api/skills without a bearer
// token. The token must come from the live Supabase session on every request.
describe("Skills panel requests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: { access_token: "session-jwt" } } });
  });

  it("carries the session bearer token when listing skills", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => jsonResponse(SKILLS));

    render(<SkillsTab />);
    await waitFor(() => expect(screen.getByText("Deep research")).toBeTruthy());

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/skills");
    expect(authorizationOf(init)).toBe("Bearer session-jwt");
  });

  it("carries the token on toggle while keeping method, content-type and body", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input: any) => {
      if (String(input).endsWith("/toggle")) return jsonResponse({ ok: true });
      return jsonResponse(SKILLS);
    });

    render(<SkillsTab />);
    fireEvent.click(await screen.findByRole("checkbox"));

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(([u]) => String(u).endsWith("/api/skills/deep-research/toggle"));
      expect(call).toBeTruthy();
      const [, init] = call as [string, RequestInit];
      expect(authorizationOf(init)).toBe("Bearer session-jwt");
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify({ enabled: true }));
    });
  });
});
