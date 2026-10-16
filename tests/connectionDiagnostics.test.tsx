import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("../src/utils/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: () => mocks.getSession(),
      refreshSession: async () => ({ data: { session: null }, error: { message: "no" } }),
    },
  },
  isRealSupabaseConfigured: true,
}));

import {
  collectConnectionDiagnostics,
  formatDiagnosticsReport,
} from "../src/utils/connectionDiagnostics";
import { isInIframe, isStorageAvailable } from "../src/utils/environment";
import IframeBanner, { IFRAME_BANNER_TEXT } from "../src/components/shared/IframeBanner";
import AboutTab from "../src/components/modals/AboutTab";

const ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MmY3YzJkMSIsImV4cCI6MTk5OTk5OTk5OX0.S3cr3tS1gnatur3Valu3XyZ";
const SERVER_DEBUG = {
  serverMode: "supabase",
  hasAuthHeader: true,
  scheme: "Bearer",
  tokenLength: ACCESS_TOKEN.length,
  verified: true,
  userIdPrefix: "42f7c2",
  errorCode: null,
  // An unexpected field must never make it into the report.
  unexpected: ACCESS_TOKEN,
};

function expectNoTokenFragments(text: string) {
  for (const part of ACCESS_TOKEN.split(".")) expect(text).not.toContain(part);
  for (let i = 0; i + 8 <= ACCESS_TOKEN.length; i++) {
    expect(text).not.toContain(ACCESS_TOKEN.slice(i, i + 8));
  }
}

const originalTop = Object.getOwnPropertyDescriptor(window, "top")!;
function simulateIframe() {
  Object.defineProperty(window, "top", { value: {}, configurable: true, writable: true });
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks.getSession.mockReset();
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: ACCESS_TOKEN, expires_at: Math.floor(Date.now() / 1000) + 30 * 60 + 20 } },
  });
  fetchSpy = vi.spyOn(global, "fetch").mockImplementation(
    async () => new Response(JSON.stringify(SERVER_DEBUG), { status: 200, headers: { "Content-Type": "application/json" } })
  );
});

afterEach(() => {
  Object.defineProperty(window, "top", originalTop);
  fetchSpy.mockRestore();
  vi.restoreAllMocks();
});

describe("connection diagnostics report", () => {
  it("summarises client and server state without any token", async () => {
    const report = formatDiagnosticsReport(await collectConnectionDiagnostics());

    expect(fetchSpy.mock.calls[0][0]).toBe("/api/auth/debug");
    expect(report).toContain("Client mode: Real Supabase");
    expect(report).toContain("Session: present");
    expect(report).toContain("Access token expires: in 30 min");
    expect(report).toContain("Storage available: yes");
    expect(report).toContain("Inside iframe: no");
    expect(report).toContain("serverMode: supabase");
    expect(report).toContain("verified: true");
    expect(report).toContain("userIdPrefix: 42f7c2");
    expect(report).not.toContain("unexpected");
    expectNoTokenFragments(report);
  });

  it("reports an unreachable backend and missing session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));

    const report = formatDiagnosticsReport(await collectConnectionDiagnostics());

    expect(report).toContain("Session: none");
    expect(report).toContain("Access token expires: n/a (no session)");
    expect(report).toContain("Server (/api/auth/debug): failed (Backend not reachable)");
  });

  it("detects blocked storage and embedding", () => {
    expect(isStorageAvailable()).toBe(true);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(isStorageAvailable()).toBe(false);

    expect(isInIframe()).toBe(false);
    simulateIframe();
    expect(isInIframe()).toBe(true);
  });
});

describe("embedded preview banner", () => {
  it("is hidden when the app runs in its own tab", () => {
    render(<IframeBanner />);
    expect(screen.queryByText(IFRAME_BANNER_TEXT)).toBeNull();
  });

  it("offers to open the current page in a new tab when framed", () => {
    simulateIframe();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<IframeBanner />);
    expect(screen.getByText(IFRAME_BANNER_TEXT)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open in new tab" }));

    expect(openSpy).toHaveBeenCalledWith(window.location.href, "_blank", "noopener,noreferrer");
  });
});

describe("Settings > About > Connection diagnostics", () => {
  it("runs the checks, warns about iframes and copies a token-free report", async () => {
    simulateIframe();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<AboutTab />);
    fireEvent.click(screen.getByRole("button", { name: /Connection diagnostics/ }));

    expect(await screen.findByText("Real Supabase")).toBeTruthy();
    expect(screen.getByText("Present")).toBeTruthy();
    expect(screen.getByText(/embedded preview/)).toBeTruthy();

    await waitFor(() => expect(screen.getByRole("button", { name: /Copy report/ }).hasAttribute("disabled")).toBe(false));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Copy report/ }));
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = String(writeText.mock.calls[0][0]);
    expect(copied).toContain("Inside iframe: yes");
    expect(copied).toContain("verified: true");
    expectNoTokenFragments(copied);
    expect(await screen.findByText("Copied")).toBeTruthy();
    expectNoTokenFragments(document.body.textContent ?? "");
  });
});
