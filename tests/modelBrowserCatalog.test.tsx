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

const REGISTRY = {
  providers: [
    { id: "gemini", label: "Google AI Studio", vendor: "Google", docsUrl: "https://ai.google.dev", keyHelpUrl: "https://aistudio.google.com/app/apikey", keyEnv: "GEMINI_API_KEY", bundledModelCount: 2, connected: false },
    { id: "openai", label: "OpenAI", vendor: "OpenAI", docsUrl: "https://platform.openai.com/docs/models", keyHelpUrl: "https://platform.openai.com/api-keys", keyEnv: "OPENAI_API_KEY", bundledModelCount: 2, connected: true },
  ],
  credentials: [{ id: "c1", provider: "openai", status: "active", key_last4: "1234" }],
  catalog: { providers: 2, models: 4, snapshot: { generatedAt: "2026-10-16" } },
};

const GEMINI_MODELS = {
  provider: "gemini",
  source: "bundled",
  liveError: null,
  bundledModelCount: 2,
  models: [
    {
      provider: "gemini", id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", description: null,
      contextLength: 1048576, maxOutputTokens: 65536, inputModalities: ["text", "image"], outputModalities: ["text"],
      supportsTools: true, supportsReasoning: true, supportsVision: true, pricing: { inputPerMTok: 1.25, outputPerMTok: 10, currency: "USD" },
      isActive: true, isEnabled: true, isPinned: false, kind: "chat", source: "bundled", vendor: "Google",
      releaseDate: "2025-03-20", knowledgeCutoff: "2025-01",
    },
    {
      provider: "gemini", id: "gemini-embedding-001", displayName: "Gemini Embedding 001", description: null,
      contextLength: 2048, maxOutputTokens: null, inputModalities: ["text"], outputModalities: ["text"],
      supportsTools: false, supportsReasoning: false, supportsVision: false, pricing: { inputPerMTok: 0.15, outputPerMTok: 0, currency: "USD" },
      isActive: true, isEnabled: true, isPinned: false, kind: "embedding", source: "bundled", vendor: "Google",
    },
  ],
};

const OPENAI_MODELS = {
  provider: "openai",
  source: "live",
  liveError: null,
  bundledModelCount: 1,
  models: [
    {
      provider: "openai", id: "gpt-5", displayName: "GPT-5", description: null,
      contextLength: 400000, maxOutputTokens: 128000, inputModalities: ["text", "image"], outputModalities: ["text"],
      supportsTools: true, supportsReasoning: true, supportsVision: true, pricing: { inputPerMTok: 1.25, outputPerMTok: 10, currency: "USD" },
      isActive: true, isEnabled: true, isPinned: false, kind: "chat", source: "live", vendor: "OpenAI",
    },
  ],
};

function mockFetch() {
  return vi.spyOn(global, "fetch").mockImplementation(async (input: any, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/providers") return jsonResponse(REGISTRY);
    if (url.startsWith("/api/providers/gemini/models")) return jsonResponse(GEMINI_MODELS);
    if (url.startsWith("/api/providers/openai/models")) return jsonResponse(OPENAI_MODELS);
    if (url === "/api/models/prefs") return jsonResponse({ success: true, method: init?.method });
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

  it("lists every provider with counts, bundled models, details and key flags", async () => {
    mockFetch();
    render(<ModelBrowser />);

    await waitFor(() => expect(screen.getByText("Model Catalog")).toBeTruthy());

    // Provider tabs carry their model counts.
    expect(screen.getByText("All providers")).toBeTruthy();
    expect(screen.getByText("OpenAI")).toBeTruthy();

    // Bundled models are shown even though the provider has no key yet.
    await waitFor(() => expect(screen.getByText("Gemini 2.5 Pro")).toBeTruthy());
    expect(screen.getByText("Gemini Embedding 001")).toBeTruthy();
    expect(screen.getAllByText("key needed").length).toBe(2);

    // Details: context window, pricing, capability badges, kind label.
    expect(screen.getByText(/M ctx/)).toBeTruthy();
    expect(screen.getAllByText("$1.25 / $10 / 1M").length).toBeGreaterThan(0);
    expect(screen.getByText("Embedding")).toBeTruthy();
    expect(screen.getByText("Showing 3 of 3 models")).toBeTruthy();

    // Live catalogs are marked as live.
    expect(screen.getAllByText("live").length).toBeGreaterThan(0);
    expect(screen.getAllByText("catalog").length).toBeGreaterThan(0);
  });

  it("filters by provider tab, kind and search, and saves preferences", async () => {
    const fetchSpy = mockFetch();
    render(<ModelBrowser />);
    await waitFor(() => expect(screen.getByText("Gemini 2.5 Pro")).toBeTruthy());

    // Provider tab
    fireEvent.click(screen.getByText("OpenAI"));
    await waitFor(() => expect(screen.queryByText("Gemini 2.5 Pro")).toBeNull());
    expect(screen.getByText("GPT-5")).toBeTruthy();

    // Back to all providers, filter by kind
    fireEvent.click(screen.getByText("All providers"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "embedding" } });
    await waitFor(() => expect(screen.queryByText("GPT-5")).toBeNull());
    expect(screen.getByText("Gemini Embedding 001")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "all" } });

    // Search
    fireEvent.change(screen.getByPlaceholderText(/Search by name/), { target: { value: "gpt-5" } });
    await waitFor(() => expect(screen.getByText("GPT-5")).toBeTruthy());
    expect(screen.queryByText("Gemini 2.5 Pro")).toBeNull();

    // Toggle a model on/off and persist the preference
    fireEvent.change(screen.getByPlaceholderText(/Search by name/), { target: { value: "" } });
    await waitFor(() => expect(screen.getByText("Gemini 2.5 Pro")).toBeTruthy());
    fireEvent.click(screen.getAllByRole("switch")[0]);

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(([u]) => String(u) === "/api/models/prefs");
      expect(call).toBeTruthy();
      const body = JSON.parse(String((call as any)[1].body));
      expect(body.items[0]).toMatchObject({ provider: "gemini", model_id: "gemini-2.5-pro", enabled: false });
    });
  });
});
