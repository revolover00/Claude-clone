import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import ModelMenu from "../src/components/composer/ModelMenu";
import * as ChatContextCore from "../src/context/ChatContextCore";

const CATALOG = {
  snapshot: { generatedAt: "2026-10-16", source: "models.dev", totalModels: 2 },
  totals: { providers: 2, models: 2 },
  providers: [
    {
      id: "openai",
      label: "OpenAI",
      vendor: "OpenAI",
      models: [
        {
          id: "gpt-5",
          name: "GPT-5",
          kind: "chat",
          contextLength: 400000,
          out: 128000,
          supportsTools: true,
          supportsReasoning: true,
          inputModalities: ["text", "image"],
          pricing: { inputPerMTok: 1.25, outputPerMTok: 10, currency: "USD" },
        },
      ],
    },
    {
      id: "xai",
      label: "xAI",
      vendor: "xAI",
      models: [
        { id: "grok-4", name: "Grok 4", kind: "chat", contextLength: 256000, supportsTools: true },
      ],
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
            { id: "openai", label: "OpenAI", connected: false, bundledModelCount: 1 },
            { id: "xai", label: "xAI", connected: false, bundledModelCount: 1 },
          ],
          credentials: [],
        });
      }
      if (url === "/api/catalog") return json(CATALOG);
      if (url === "/api/models") return json([]);
      return json({});
    });
  });

  it("lists bundled catalog models grouped per provider and flags the missing key", async () => {
    render(
      <ModelMenu
        model="openai:gpt-5"
        onSelectModel={mockOnSelectModel}
        effort="Medium"
        onSelectEffort={vi.fn()}
      />
    );

    // The pill states that the selected model still needs a provider key.
    await waitFor(() => expect(screen.getByText(/GPT-5 · OpenAI/)).toBeTruthy());
    expect(screen.getByText(/key needed/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /model options/i }));

    await waitFor(() => expect(screen.getByText("OpenAI")).toBeTruthy());
    expect(screen.getByText("xAI")).toBeTruthy();
    expect(screen.getByText("GPT-5")).toBeTruthy();
    expect(screen.getByText("Grok 4")).toBeTruthy();
    expect(screen.getAllByText("Key required").length).toBe(2);
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
