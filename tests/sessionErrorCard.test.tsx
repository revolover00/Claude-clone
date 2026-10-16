import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

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
vi.mock("../src/context/ChatContext", () => ({
  useChat: () => ({ preferences: { memory_enabled: true }, updatePreferences: vi.fn() }),
}));
vi.mock("../src/context/ToastContext", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
// ProviderCard imports through the "@/" alias, which only vite.config.ts defines
// (vitest.config.ts does not). It is not under test here, so stub it.
vi.mock("../src/components/providers/ProviderCard", () => ({ ProviderCard: () => null }));

import SkillsTab from "../src/components/modals/SkillsTab";
import MemoryTab from "../src/components/modals/MemoryTab";
import ModelsTab from "../src/components/modals/ModelsTab";
import { ProvidersSettingsView } from "../src/components/views/ProvidersSettingsView";
import { SettingsErrorCard } from "../src/components/shared/SettingsErrorCard";
import { ApiError, SESSION_EXPIRED_EVENT } from "../src/utils/authErrors";

const SESSION_TITLE = "Your session is not valid";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const unauthorized = (code = "AUTH_TOKEN_EXPIRED") =>
  jsonResponse(401, { error: "Your session has expired. Please sign in again.", code });

function expectNoRawStatusText() {
  const text = document.body.textContent ?? "";
  expect(text).not.toMatch(/Request failed with status 401/i);
  expect(text).not.toMatch(/HTTP 401/);
}

let fetchSpy: ReturnType<typeof vi.spyOn>;
const events: CustomEvent[] = [];
const onExpired = (e: Event) => events.push(e as CustomEvent);

beforeEach(() => {
  mocks.getSession.mockReset();
  mocks.refreshSession.mockReset();
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: "session-jwt", expires_at: Math.floor(Date.now() / 1000) + 3600 } },
  });
  mocks.refreshSession.mockResolvedValue({ data: { session: null }, error: { message: "refresh failed" } });
  fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => unauthorized());
  events.length = 0;
  window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
});

afterEach(() => {
  window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  fetchSpy.mockRestore();
});

describe("Settings session error card", () => {
  it("Skills: a 401 shows the session card with Sign in again and Retry, not raw HTTP text", async () => {
    render(<SkillsTab />);

    expect(await screen.findByText(SESSION_TITLE)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expectNoRawStatusText();
  });

  it("keeps the technical code in a collapsible Details section", async () => {
    render(<SkillsTab />);
    await screen.findByText(SESSION_TITLE);

    const details = screen.getByRole("button", { name: "Details" });
    expect(details.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("AUTH_TOKEN_EXPIRED")).toBeNull();

    fireEvent.click(details);

    expect(details.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("AUTH_TOKEN_EXPIRED")).toBeTruthy();
    expectNoRawStatusText();
  });

  it("Sign in again asks the app to end the session and show the login screen", async () => {
    render(<SkillsTab />);
    await screen.findByText(SESSION_TITLE);
    events.length = 0;

    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ code: "AUTH_TOKEN_EXPIRED", source: "user" });
  });

  it("Retry reloads the section", async () => {
    render(<SkillsTab />);
    await screen.findByText(SESSION_TITLE);
    fetchSpy.mockImplementation(async () =>
      jsonResponse(200, [{ id: "deep-research", name: "Deep research", description: "Search", enabled: false }])
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Deep research")).toBeTruthy();
    expect(screen.queryByText(SESSION_TITLE)).toBeNull();
  });

  it.each([
    ["Memory", () => <MemoryTab />, 1],
    ["Models", () => <ModelsTab />, 1],
    // One card for the provider list, one for the model catalog (ModelBrowser).
    ["Providers (including the model catalog)", () => <ProvidersSettingsView />, 2],
  ])("%s uses the same session card", async (_name, renderSection, expectedCards) => {
    render(renderSection());

    await waitFor(() => expect(screen.getAllByText(SESSION_TITLE)).toHaveLength(expectedCards));
    expectNoRawStatusText();
  });

  it("uses the session card for legacy 401 messages and the generic card otherwise", () => {
    const legacy = new Error("Request failed with status 401 (Unauthorized): Missing or invalid authorization header");
    const { unmount } = render(<SettingsErrorCard onRetry={() => {}} error={legacy} />);
    expect(screen.getByText(SESSION_TITLE)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expectNoRawStatusText();
    unmount();

    render(<SettingsErrorCard onRetry={() => {}} error={new ApiError("Request failed with status 500", 500)} />);
    expect(screen.queryByText(SESSION_TITLE)).toBeNull();
    expect(screen.getByText("Couldn't load this section")).toBeTruthy();
  });
});
