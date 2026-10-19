import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { authFetch } from "../src/utils/safeFetch";
import { ProviderCard } from "../src/components/providers/ProviderCard";

vi.mock("../src/components/providers/CredentialList", () => ({ CredentialList: () => null }));
vi.mock("../src/utils/safeFetch", () => ({ authFetch: vi.fn() }));

const base = {
  name: "OpenAI",
  status: "disconnected" as const,
  docsUrl: "https://platform.openai.com/docs",
};

beforeEach(() => vi.mocked(authFetch).mockReset());

describe("provider connection tests", () => {
  it("shows Experimental for an unverified OpenAI-compatible provider", () => {
    render(<ProviderCard {...base} id="openai" />);
    expect(screen.getByText("Experimental")).toBeTruthy();
  });

  it("hides Experimental for a verified key and for exempt providers", () => {
    const { rerender } = render(<ProviderCard {...base} id="openai" credentials={[
      { id: "cred-1", provider: "openai", label: "default", key_last4: "1234", status: "active", last_verified_at: "2026-10-19T00:00:00Z" },
    ]} />);
    expect(screen.queryByText("Experimental")).toBeNull();
    rerender(<ProviderCard {...base} id="groq" />);
    expect(screen.queryByText("Experimental")).toBeNull();
  });

  it("shows the provider error returned by the connection test", async () => {
    vi.mocked(authFetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid API key" }),
    } as Response);
    render(<ProviderCard {...base} id="openai" />);
    fireEvent.change(screen.getByPlaceholderText("Paste your API key"), { target: { value: "sk-test-key-123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Invalid API key"));
  });

  it("sends a tiny test request and renders latency, tokens, and model", async () => {
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, latencyMs: 132, tokens: 7, model: "gpt-5" }),
    } as Response);
    render(<ProviderCard {...base} id="openai" />);
    fireEvent.change(screen.getByPlaceholderText("Paste your API key"), { target: { value: "sk-test-key-123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("132 ms · 7 tokens · gpt-5"));
    expect(authFetch).toHaveBeenCalledWith("/api/providers/openai/test-connection", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ key: "sk-test-key-123456" }),
    }));
  });
});
