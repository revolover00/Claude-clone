import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "../src/components/shared/ErrorBoundary";
import { usePreferencesStore } from "../src/context/stores/usePreferencesStore";

function PreferencesProbe() {
  const { preferences } = usePreferencesStore();
  return <span data-testid="theme">{preferences.theme}</span>;
}

let matchMediaDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  localStorage.clear();
  matchMediaDescriptor = Object.getOwnPropertyDescriptor(window, "matchMedia");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
});

afterEach(() => {
  if (matchMediaDescriptor) Object.defineProperty(window, "matchMedia", matchMediaDescriptor);
  else delete (window as any).matchMedia;
  localStorage.clear();
});

describe("system theme fallback", () => {
  it("does not crash the app when matchMedia is unavailable", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary fallbackType="page">
        <PreferencesProbe />
      </ErrorBoundary>
    );

    expect(screen.getByTestId("theme").textContent).toBe("system");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.queryByText(/An unexpected error occurred/)).toBeNull();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
