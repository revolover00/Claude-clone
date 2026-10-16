import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";
import ModelMenu from "../src/components/composer/ModelMenu";
import * as ChatContextCore from "../src/context/ChatContextCore";

const CATALOG = {
  source: "catalog",
  is_admin: false,
  total: 2,
  providers: [
    { id: "openai", label: "OpenAI", connected: false, modelCount: 1 },
    { id: "xai", label: "xAI", connected: false, modelCount: 1 },
  ],
  models: [
    {
      provider: "openai",
      model_id: "gpt-5",
      name: "GPT-5",
      display_name: "GPT-5",
      vendor: "OpenAI",
      family: "GPT-5",
      kind: "chat",
      status: "active",
      context_length: 400000,
      max_output_tokens: 128000,
      supports_tools: true,
      supports_reasoning: true,
      supports_vision: true,
      supports_json: false,
      is_free: false,
      recommended: true,
      pricing: { inputPerMTok: 1.25, outputPerMTok: 10, currency: "USD" },
      released_at: "2025-08-01",
      first_seen_at: "2026-10-01T00:00:00.000Z",
      connected: false,
      requires_key: true,
      enabled: true,
      pinned: false,
      alias: null,
      description: "Flagship reasoning model",
    },
    {
      provider: "xai",
      model_id: "grok-4",
      name: "Grok 4",
      display_name: "Grok 4",
      vendor: "xAI",
      family: "Grok 4",
      kind: "chat",
      status: "active",
      context_length: 256000,
      max_output_tokens: null,
      supports_tools: true,
      supports_reasoning: true,
      supports_vision: false,
      supports_json: false,
      is_free: false,
      recommended: false,
      pricing: null,
      released_at: "2025-07-01",
      first_seen_at: "2026-10-01T00:00:00.000Z",
      connected: false,
      requires_key: true,
      enabled: true,
      pinned: false,
      alias: null,
      description: null,
    },
    {
      provider: "xai",
      model_id: "grok-4.1-mini",
      name: "Grok 4.1 Mini",
      display_name: "Grok 4.1 Mini",
      vendor: "xAI",
      family: "Grok 4",
      kind: "chat",
      status: "active",
      context_length: 131072,
      max_output_tokens: 16384,
      supports_tools: true,
      supports_reasoning: false,
      supports_vision: false,
      supports_json: false,
      is_free: true,
      recommended: false,
      pricing: { inputPerMTok: 0, outputPerMTok: 0, currency: "USD" },
      released_at: "2026-01-15",
      first_seen_at: "2026-10-01T00:00:00.000Z",
      connected: false,
      requires_key: true,
      enabled: true,
      pinned: false,
      alias: null,
      description: "Free-variant pricing row",
    },
    {
      provider: "gemini",
      model_id: "gemini-3-8-flash",
      name: "Gemini 3 Flash",
      display_name: "Gemini 3 Flash",
      vendor: "Google",
      family: "Gemini 3",
      kind: "chat",
      status: "active",
      context_length: 1000000,
      max_output_tokens: 65536,
      supports_tools: true,
      supports_reasoning: false,
      supports_vision: true,
      supports_json: false,
      is_free: false,
      recommended: false,
      pricing: { inputPerMTok: 0.3, outputPerMTok: 2.5, currency: "USD" },
      released_at: "2025-11-01",
      first_seen_at: "2026-10-01T00:00:00.000Z",
      connected: false,
      requires_key: true,
      enabled: true,
      pinned: false,
      alias: null,
      description: "Free-tier provider row",
    },
  ],
};

describe("Composer picker without connected keys", () => {
  const mockSetSettingsModalOpen = vi.fn();
  const mockOnSelectModel = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    mockSetSettingsModalOpen.mockClear();
    mockOnSelectModel.mockClear();

    vi.spyOn(ChatContextCore, "useChat").mockReturnValue({
      setSettingsModalOpen: mockSetSettingsModalOpen,
    } as any);

    vi.spyOn(global, "fetch").mockImplementation(async (input: any) => {
      const url = String(input);
      const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body } as any);
      if (url.endsWith("/api/providers")) {
        return json({
          providers: [
            { id: "openai", label: "OpenAI", connected: false },
            { id: "xai", label: "xAI", connected: false },
          ],
          credentials: [],
        });
      }
      if (url.includes("/api/catalog")) return json(CATALOG);
      if (url.includes("/api/models")) return json([]);
      return json({});
    });
  });

  it("lists every catalog model grouped per provider and flags the missing key", async () => {
    render(
      <ModelMenu
        model="openai:gpt-5"
        onSelectModel={mockOnSelectModel}
        effort="Medium"
        onSelectEffort={vi.fn()}
      />
    );

    // The pill states that the selected model still needs a provider key.
    await waitFor(() => expect(screen.getByText("GPT-5 · OpenAI · key needed")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /model options/i }));

    // Groups follow Recommended -> provider/vendor sections; unconnected rows
    // stay visible but carry a "Connect <provider> to use" hint.
    await waitFor(() => expect(screen.getByText("GPT-5")).toBeTruthy());
    expect(screen.getByText("Grok 4")).toBeTruthy();
    expect(screen.getByText("Connect OpenAI to use")).toBeTruthy();
    expect(screen.getAllByText("Connect xAI to use").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Dimmed models belong to providers/)).toBeTruthy();
    expect(screen.getByText("Flagship reasoning model")).toBeTruthy();
  });

  it("sends the user to provider setup instead of selecting an unusable model", async () => {
    render(
      <ModelMenu
        model="openai:gpt-5"
        onSelectModel={mockOnSelectModel}
        effort="Medium"
        onSelectEffort={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /model options/i }));
    fireEvent.click(await screen.findByText("Grok 4"));

    await waitFor(() => expect(mockSetSettingsModalOpen).toHaveBeenCalledWith(true));
    expect(mockOnSelectModel).not.toHaveBeenCalled();
    expect(localStorage.getItem("claude_clone_settings_tab")).toBe("providers");
  });

  it("filters the model list by vendor through the picker's filter chips", async () => {
    render(
      <ModelMenu
        model="openai:gpt-5"
        onSelectModel={mockOnSelectModel}
        effort="Medium"
        onSelectEffort={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText("GPT-5 · OpenAI · key needed")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /model options/i }));

    // One chip per vendor present in the catalog, plus "All".
    const group = await screen.findByRole("group", { name: "Filter by vendor" });
    await waitFor(() => expect(within(group).getByRole("button", { name: "OpenAI" })).toBeTruthy());
    expect(within(group).getByRole("button", { name: "xAI" })).toBeTruthy();
    expect(within(group).getByRole("button", { name: "All" })).toBeTruthy();
    expect(screen.getByText("Grok 4")).toBeTruthy();

    // Picking a vendor hides every model that does not belong to it.
    fireEvent.click(within(group).getByRole("button", { name: "xAI" }));
    await waitFor(() => expect(screen.queryByText("GPT-5")).toBeNull());
    expect(screen.getByText("Grok 4")).toBeTruthy();

    // "All" restores the full list.
    fireEvent.click(within(group).getByRole("button", { name: "All" }));
    await waitFor(() => expect(screen.getByText("GPT-5")).toBeTruthy());
    expect(screen.getByText("Grok 4")).toBeTruthy();
  });

  it("labels every model free/paid and filters with the Free chip", async () => {
    render(
      <ModelMenu
        model="openai:gpt-5"
        onSelectModel={mockOnSelectModel}
        effort="Medium"
        onSelectEffort={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText("GPT-5 · OpenAI · key needed")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /model options/i }));

    // Every row carries its free/paid label: Free pill, paid price, or free tier.
    await waitFor(() => expect(screen.getAllByText("Free").length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText("Free tier").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Variable").length).toBeGreaterThanOrEqual(1);

    // The Free chip keeps price-zero rows AND free-tier providers only.
    const group = await screen.findByRole("group", { name: "Filter by vendor" });
    fireEvent.click(within(group).getByRole("button", { name: "Free" }));
    await waitFor(() => expect(screen.queryByText("GPT-5")).toBeNull());
    expect(screen.getByText("Grok 4.1 Mini")).toBeTruthy();
    expect(screen.getByText("Gemini 3 Flash")).toBeTruthy();

    fireEvent.click(within(group).getByRole("button", { name: "Free" }));
    await waitFor(() => expect(screen.getByText("GPT-5")).toBeTruthy());
  });
});
