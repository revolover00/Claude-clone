import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
    expect(screen.getByText("Connect xAI to use")).toBeTruthy();
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
});
