import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  authCallback: null as null | ((event: string, session: unknown) => void),
}));

vi.mock("../src/utils/supabaseClient", () => {
  const chain: any = { select: () => chain, eq: () => chain, single: async () => ({ data: null, error: null }) };
  return {
    supabase: {
      auth: {
        getSession: () => mocks.getSession(),
        onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
          mocks.authCallback = cb;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        signOut: (...args: unknown[]) => mocks.signOut(...args),
        signInWithPassword: (...args: unknown[]) => mocks.signInWithPassword(...args),
        refreshSession: async () => ({ data: { session: null }, error: { message: "no session" } }),
        signInWithOAuth: vi.fn(),
        signUp: vi.fn(),
        resetPasswordForEmail: vi.fn(),
      },
      from: () => chain,
    },
    isRealSupabaseConfigured: true,
  };
});
vi.mock("../src/utils/supabaseImport", () => ({ importLocalChatsToSupabase: vi.fn() }));
vi.mock("../src/context/ToastContext", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { AuthProvider, useAuth } from "../src/context/AuthContext";
import AuthGate from "../src/components/views/AuthGate";
import { SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE } from "../src/utils/authErrors";

const makeSession = (token: string, userId = "user-1") => ({
  access_token: token,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: userId, email: `${userId}@example.com` },
});

let navigateRef: NavigateFunction | null = null;

function AppProbe() {
  const { user, signOut } = useAuth();
  return (
    <div>
      <p>App content for {user?.id}</p>
      <button type="button" onClick={() => signOut()}>Sign out</button>
    </div>
  );
}

function LocationProbe() {
  const location = useLocation();
  navigateRef = useNavigate();
  return <p data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</p>;
}

function renderApp(path = "/chat/abc?view=1#m5") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AuthGate>
          <AppProbe />
        </AuthGate>
        <LocationProbe />
      </AuthProvider>
    </MemoryRouter>
  );
}

const emit = (event: string, session: unknown) => act(() => mocks.authCallback?.(event, session));
const expireViaEvent = (code = "AUTH_TOKEN_EXPIRED") =>
  act(() => {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { code, source: "authFetch" } }));
  });

async function signInThroughForm(session: ReturnType<typeof makeSession>) {
  mocks.signInWithPassword.mockImplementation(async () => {
    mocks.authCallback?.("SIGNED_IN", session);
    return { data: { session, user: session.user }, error: null };
  });
  fireEvent.change(screen.getByPlaceholderText("Email address"), { target: { value: "me@example.com" } });
  fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "correct-horse" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
  });
}

beforeEach(() => {
  mocks.getSession.mockReset();
  mocks.signOut.mockReset();
  mocks.signInWithPassword.mockReset();
  mocks.authCallback = null;
  navigateRef = null;
  localStorage.clear();
  sessionStorage.clear();
  mocks.getSession.mockResolvedValue({ data: { session: makeSession("live-token") } });
  mocks.signOut.mockImplementation(async () => {
    mocks.authCallback?.("SIGNED_OUT", null);
    return { error: null };
  });
});

describe("session-expired flow", () => {
  it("signs out, shows the login banner and returns to the same page after signing in", async () => {
    renderApp();
    expect(await screen.findByText("App content for user-1")).toBeTruthy();

    expireViaEvent();

    expect(await screen.findByText(SESSION_EXPIRED_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(/App content/)).toBeNull();
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" }));
    expect(mocks.signOut).toHaveBeenCalledTimes(1);

    // Something (e.g. an OAuth round-trip) moved the router while signed out.
    act(() => navigateRef!("/"));
    expect(screen.getByTestId("location").textContent).toBe("/");

    await signInThroughForm(makeSession("new-token", "user-2"));

    expect(await screen.findByText("App content for user-2")).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/chat/abc?view=1#m5");
    expect(screen.queryByText(SESSION_EXPIRED_MESSAGE)).toBeNull();
  });

  it("handles repeated expiry events only once", async () => {
    renderApp();
    await screen.findByText("App content for user-1");

    expireViaEvent("AUTH_TOKEN_EXPIRED");
    expireViaEvent("AUTH_TOKEN_INVALID");

    await screen.findByText(SESSION_EXPIRED_MESSAGE);
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("treats a TOKEN_REFRESHED event without a session as an expired session", async () => {
    renderApp();
    await screen.findByText("App content for user-1");

    emit("TOKEN_REFRESHED", null);

    expect(await screen.findByText(SESSION_EXPIRED_MESSAGE)).toBeTruthy();
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" }));
  });

  it("treats an unexpected SIGNED_OUT after a rejected refresh token as expired", async () => {
    renderApp();
    await screen.findByText("App content for user-1");

    emit("SIGNED_OUT", null);

    expect(await screen.findByText(SESSION_EXPIRED_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(/App content/)).toBeNull();
  });

  it("shows the login screen without the banner after a deliberate sign-out", async () => {
    renderApp();
    await screen.findByText("App content for user-1");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    });

    expect(await screen.findByText("Welcome back")).toBeTruthy();
    expect(screen.queryByText(SESSION_EXPIRED_MESSAGE)).toBeNull();
  });

  it("ignores session-expired events when nobody is signed in", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    renderApp();
    await screen.findByText("Welcome back");

    expireViaEvent();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.queryByText(SESSION_EXPIRED_MESSAGE)).toBeNull();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("never renders the app for a session without an access token", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "ghost" } } } });
    renderApp();

    expect(await screen.findByText("Welcome back")).toBeTruthy();
    expect(screen.queryByText(/App content/)).toBeNull();
  });

  it("returns to the remembered page after an OAuth redirect reloaded the app", async () => {
    sessionStorage.setItem("claude:auth-return-to", "/projects/p1?tab=files");
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    renderApp("/");
    await screen.findByText("Welcome back");

    emit("SIGNED_IN", makeSession("oauth-token"));

    expect(await screen.findByText("App content for user-1")).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/projects/p1?tab=files");
    expect(sessionStorage.getItem("claude:auth-return-to")).toBeNull();
  });

  it("removes the legacy localStorage token copy and never writes the access token", async () => {
    localStorage.setItem("supabase_token", "stale-token-copy");
    renderApp();
    await screen.findByText("App content for user-1");

    await waitFor(() => expect(localStorage.getItem("supabase_token")).toBeNull());
    const everything = Object.keys(localStorage).map((k) => `${k}=${localStorage.getItem(k)}`).join("\n");
    expect(everything).not.toContain("live-token");
  });
});
