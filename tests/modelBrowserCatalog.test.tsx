import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const getSession = vi.fn();

vi.mock("../src/utils/supabaseClient", () => ({
  supabase: { auth: { getSession: () => getSession() } },
  isRealSupabaseConfigured: true,
}));

import { ModelBrowser } from "../src/components/providers/ModelBrowser";

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

function row(over: Record<string, unknown>) {
  return {
    display_name: undefined,
    description: null,
    max_output_tokens: null,
    supports_json: false,
    is_free: false,
    recommended: false,
    status: "active",
    kind: "chat",
    pricing: null,
    released_at: "2025-06-01",
    first_seen_at: "2026-10-01T00:00:00.000Z",
    alias: null,
    pinned: false,
    enabled: true,
    requires_key: false,
    hidden: false,
    ...over,
  };
}

const CATALOG = {
  source: "bundled",
  is_admin: false,
  total: 4,
  nextCursor: null,
  limit: 50,
  providers: [
    { id: "gemini", label: "Google AI Studio", connected: false, modelCount: 2 },
    { id: "openai", label: "OpenAI", connected: true, modelCount: 2 },
  ],
  syncable: ["openrouter", "gemini", "groq"],
  sync: { newest: null, stale12h: true },
  models: [
    row({
      provider: "gemini",
      model_id: "gemini-3.8-flash",
      name: "Gemini 3.8 Flash",
      vendor: "Google",
      family: "Gemini 3.8 Flash",
      context_length: 1000000,
      supports_tools: true,
      supports_vision: true,
      supports_reasoning: true,
      recommended: true,
      is_free: false,
      pricing: { inputPerMTok: 1.25, outputPerMTok: 10, currency: "USD" },
      connected: false,
      requires_key: true,
    }),
    row({
      provider: "gemini",
      model_id: "gemini-embedding-004",
      name: "Gemini Embedding 004",
      vendor: "Google",
      family: "Gemini",
      kind: "embedding",
      context_length: 2048,
      connected: false,
      requires_key: true,
    }),
    row({
      provider: "openai",
      model_id: "gpt-5",
      name: "GPT-5",
      vendor: "OpenAI",
      family: "GPT-5",
      context_length: 400000,
      max_output_tokens: 128000,
      supports_tools: true,
      supports_vision: true,
      supports_reasoning: true,
      recommended: true,
      pricing: { inputPerMTok: 1.25, outputPerMTok: 10, currency: "USD" },
      connected: true,
      released_at: "2025-08-01",
    }),
    row({
      provider: "openai",
      model_id: "gpt-5-mini",
      name: "GPT-5 Mini",
      vendor: "OpenAI",
      family: "GPT-5",
      context_length: 400000,
      connected: true,
      released_at: "2025-09-01",
    }),
  ],
};

function mockFetch() {
  return vi.spyOn(global, "fetch").mockImplementation(async (input: any, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/catalog")) return jsonResponse(CATALOG);
    if (url.includes("/api/models/prefs")) return jsonResponse({ success: true, method: init?.method });
    if (url.includes("/api/models")) return jsonResponse([]);
    return jsonResponse({});
  });
}

describe("Model catalog browser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: { access_token: "session-jwt" } } });
  });

  it("lists providers with counts, grouped catalog rows, details and key hints", async () => {
    mockFetch();
    render(<ModelBrowser />);

    await waitFor(() => expect(screen.getByText("Model Catalog")).toBeTruthy());
    await waitFor(() => expect(screen.getAllByText("Gemini 3.8 Flash").length).toBeGreaterThan(0));

    // Filter selectors carry per-provider and per-kind counts.
    const providerSelect = screen.getByRole("combobox", { name: "Filter by provider" });
    const optionTexts = Array.from(providerSelect.querySelectorAll("option")).map((o) => o.textContent);
    expect(optionTexts).toEqual(["All providers (4)", "Google AI Studio (2)", "OpenAI (2)"]);
    const kindSelect = screen.getByRole("combobox", { name: "Filter by kind" });
    const kindTexts = Array.from(kindSelect.querySelectorAll("option")).map((o) => o.textContent);
    expect(kindTexts).toEqual(["All kinds (4)", "Chat (3)", "Embedding (1)"]);

    // Every model is listed, even for unconnected providers; only those rows
    // are dimmed with a "Connect <provider> to use" hint.
    expect(screen.getAllByText("GPT-5").length).toBeGreaterThan(0);
    expect(screen.getByText("Gemini Embedding 004")).toBeTruthy();
    expect(screen.getAllByText(/Connect Google AI Studio to use/)).toHaveLength(2);
    expect(screen.queryByText(/Connect OpenAI to use/)).toBeNull();
    expect(screen.getAllByText("Settings › Providers").length).toBeGreaterThanOrEqual(2);

    // Grouped Provider -> Vendor -> Family hierarchy with counts.
    expect(screen.getAllByText("gemini").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getAllByText("Gemini 3.8 Flash").length).toBeGreaterThanOrEqual(2); // family header + row name

    // Details: context window, pricing, kind label, capability chips.
    expect(screen.getAllByText(/1M ctx/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$1.25 / $10 / 1M").length).toBeGreaterThan(0);
    expect(screen.getByText("Embedding")).toBeTruthy();

    // Filter chips + summary + source badge.
    expect(screen.getByRole("button", { name: "Recommended" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Long context 200k+" })).toBeTruthy();
    expect(screen.getByText("Showing 4 of 4 models")).toBeTruthy();
    expect(screen.getByText("bundled snapshot")).toBeTruthy();
    expect(screen.getAllByRole("switch")).toHaveLength(4);
  });

  it("filters by provider, kind, chips and search, and saves preferences", async () => {
    const fetchSpy = mockFetch();
    render(<ModelBrowser />);
    await waitFor(() => expect(screen.getAllByText("Gemini 3.8 Flash").length).toBeGreaterThan(0));

    // Provider filter
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by provider" }), { target: { value: "openai" } });
    await waitFor(() => expect(screen.queryAllByText("Gemini 3.8 Flash")).toHaveLength(0));
    expect(screen.getAllByText("GPT-5").length).toBeGreaterThan(0);
    expect(screen.getByText("Showing 2 of 4 models")).toBeTruthy();

    // Kind filter
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by provider" }), { target: { value: "all" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by kind" }), { target: { value: "embedding" } });
    await waitFor(() => expect(screen.queryAllByText("GPT-5")).toHaveLength(0));
    expect(screen.getByText("Gemini Embedding 004")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by kind" }), { target: { value: "all" } });

    // Capability chip toggles (aria-pressed reflects state)
    const visionChip = screen.getByRole("button", { name: "Vision" });
    fireEvent.click(visionChip);
    expect(visionChip.getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(screen.queryByText("Gemini Embedding 004")).toBeNull());
    expect(screen.getAllByText("GPT-5").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Vision" }));
    await waitFor(() => expect(screen.getByText("Gemini Embedding 004")).toBeTruthy());

    // Search
    fireEvent.change(screen.getByRole("textbox", { name: "Search models" }), { target: { value: "gpt-5 mini" } });
    await waitFor(() => expect(screen.getByText("GPT-5 Mini")).toBeTruthy());
    expect(screen.queryAllByText("Gemini 3.8 Flash")).toHaveLength(0);
    fireEvent.change(screen.getByRole("textbox", { name: "Search models" }), { target: { value: "" } });
    await waitFor(() => expect(screen.getAllByText("Gemini 3.8 Flash").length).toBeGreaterThan(0));

    // Sort selector accepts the client-side sorts
    fireEvent.change(screen.getByRole("combobox", { name: "Sort models" }), { target: { value: "context" } });
    await waitFor(() => expect(screen.getByText("Showing 4 of 4 models")).toBeTruthy());

    // Toggling a model persists the per-user preference
    fireEvent.click(screen.getByRole("switch", { name: "Disable Gemini 3.8 Flash" }));
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(([u]) => String(u).includes("/api/models/prefs"));
      expect(call).toBeTruthy();
      const body = JSON.parse(String((call as any)[1].body));
      expect(body.items[0]).toMatchObject({ provider: "gemini", model_id: "gemini-3.8-flash", enabled: false });
    });
    expect(screen.getByRole("switch", { name: "Enable Gemini 3.8 Flash" })).toBeTruthy();
  });
});
