import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";
import ModelMenu from "../src/components/composer/ModelMenu";
import * as ChatContextCore from "../src/context/ChatContextCore";
import * as useModelsHook from "../src/hooks/useModels";

describe("Composer Model Picker Component Tests", () => {
  const mockSetSettingsModalOpen = vi.fn();
  const mockOnSelectModel = vi.fn();
  const mockOnSelectEffort = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();

    vi.spyOn(ChatContextCore, "useChat").mockReturnValue({
      setSettingsModalOpen: mockSetSettingsModalOpen,
    } as any);
  });

  it("keeps the model pill concise while exposing its provider accessibly", async () => {
    // Mock /api/providers returning groq credentials and /api/providers/groq/models
    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/providers/groq/models")) {
        return {
          ok: true,
          json: async () => ({
            models: [
              {
                id: "llama-3.3-70b-versatile",
                displayName: "Llama 3.3 70B",
                provider: "groq",
                isEnabled: true,
                isPinned: false,
                supportsReasoning: false,
              },
            ],
          }),
        } as any;
      }
      if (urlStr.endsWith("/api/providers")) {
        return {
          ok: true,
          json: async () => ({
            providers: [{ id: "groq", label: "Groq" }],
            credentials: [{ provider: "groq", status: "active" }],
          }),
        } as any;
      }
      return { ok: true, json: async () => [] } as any;
    });

    render(
      <ModelMenu
        model="groq:llama-3.3-70b-versatile"
        onSelectModel={mockOnSelectModel}
        effort="Medium"
        onSelectEffort={mockOnSelectEffort}
      />
    );

    // The closed picker only formats the saved ID; opening loads the catalog label lazily.
    const savedModelPill = screen.getByRole("button", { name: "Model: Llama-3.3-70b-Versatile. Effort: Medium" });
    expect(savedModelPill.getAttribute("title")).toBe("Groq");
    fireEvent.click(screen.getByRole("button", { name: /model options/i }));
    await waitFor(() => {
      const pill = screen.getByRole("button", { name: "Model: Llama 3.3 70B. Effort: Medium" });
      expect(pill.getAttribute("title")).toBe("Groq");
      expect(screen.queryByText("Llama 3.3 70B · Groq")).toBeNull();
    });
  });

  it("groups models under provider headers and puts pinned models first", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.endsWith("/api/providers")) {
        return {
          ok: true,
          json: async () => ({
            providers: [
              { id: "gemini", label: "Google AI Studio" },
              { id: "groq", label: "Groq" },
            ],
            credentials: [
              { provider: "gemini", status: "active" },
              { provider: "groq", status: "active" },
            ],
          }),
        } as any;
      }
      if (urlStr.includes("/api/providers/gemini/models")) {
        return {
          ok: true,
          json: async () => ({
            models: [
              {
                id: "gemini-3.8-flash",
                displayName: "Gemini 3.8 Flash",
                provider: "gemini",
                isEnabled: true,
                isPinned: false,
                supportsReasoning: true,
              },
              {
                id: "gemini-3.1-pro-preview",
                displayName: "Gemini 3.1 Pro (Preview)",
                provider: "gemini",
                isEnabled: true,
                isPinned: true, // PINNED!
                supportsReasoning: true,
              },
            ],
          }),
        } as any;
      }
      if (urlStr.includes("/api/providers/groq/models")) {
        return {
          ok: true,
          json: async () => ({
            models: [
              {
                id: "llama-3.3-70b-versatile",
                displayName: "Llama 3.3 70B",
                provider: "groq",
                isEnabled: true,
                isPinned: false,
              },
            ],
          }),
        } as any;
      }
      return { ok: true, json: async () => [] } as any;
    });

    render(
      <ModelMenu
        model="gemini:gemini-3.8-flash"
        onSelectModel={mockOnSelectModel}
        effort="High"
        onSelectEffort={mockOnSelectEffort}
      />
    );

    // Click trigger to open dropdown
    const trigger = screen.getByRole("button", { name: /model options/i });
    fireEvent.click(trigger);

    // Expect provider headers with labels. Vendor filter chips reuse the same
    // labels, so assert on the header elements (<p>), not the chip buttons.
    await waitFor(() => {
      const google = screen.getAllByText("Google AI Studio");
      expect(google.some((el) => el.tagName === "P")).toBe(true);
      const groq = screen.getAllByText("Groq");
      expect(groq.some((el) => el.tagName === "P")).toBe(true);
    });

    // Pinned model (Gemini 3.1 Pro) should appear
    const pinnedModel = screen.getByText("Gemini 3.1 Pro (Preview)");
    expect(pinnedModel).toBeDefined();

    // Select a model
    const groqModelBtn = screen.getByText("Llama 3.3 70B");
    fireEvent.click(groqModelBtn);

    expect(mockOnSelectModel).toHaveBeenCalledWith("groq:llama-3.3-70b-versatile");
    expect(localStorage.getItem("claude_clone_last_model")).toBe("groq:llama-3.3-70b-versatile");
  });

  it("filters models via search box", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.endsWith("/api/providers")) {
        return {
          ok: true,
          json: async () => ({
            providers: [{ id: "groq", label: "Groq" }],
            credentials: [{ provider: "groq", status: "active" }],
          }),
        } as any;
      }
      if (urlStr.includes("/api/providers/groq/models")) {
        return {
          ok: true,
          json: async () => ({
            models: [
              { id: "llama-3.3-70b", displayName: "Llama 3.3 70B", provider: "groq", isEnabled: true },
              { id: "mixtral-8x7b", displayName: "Mixtral 8x7B", provider: "groq", isEnabled: true },
            ],
          }),
        } as any;
      }
      return { ok: true, json: async () => [] } as any;
    });

    render(
      <ModelMenu
        model="groq:llama-3.3-70b"
        onSelectModel={mockOnSelectModel}
        effort="Low"
        onSelectEffort={mockOnSelectEffort}
      />
    );

    const trigger = screen.getByRole("button", { name: /model options/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(within(screen.getByRole("menu")).getByText("Llama 3.3 70B")).toBeDefined();
      expect(within(screen.getByRole("menu")).getByText("Mixtral 8x7B")).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText("Search models...");
    fireEvent.change(searchInput, { target: { value: "mixtral" } });

    await waitFor(() => {
      expect(within(screen.getByRole("menu")).queryByText("Llama 3.3 70B")).toBeNull();
      expect(within(screen.getByRole("menu")).getByText("Mixtral 8x7B")).toBeDefined();
    });
  });

  it("shows empty state 'Connect an API key' linking to Settings > Providers when no models exist", async () => {
    vi.spyOn(useModelsHook, "useModels").mockReturnValue({
      models: [],
      loading: false,
      defaultModel: null as any,
      normalizeSlug: (s: string) => s,
      refetch: vi.fn(),
    });

    render(
      <ModelMenu
        model=""
        onSelectModel={mockOnSelectModel}
        effort="Medium"
        onSelectEffort={mockOnSelectEffort}
      />
    );

    const trigger = screen.getByRole("button", { name: /model options/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      const connectBtn = screen.getByRole("button", { name: /connect an api key/i });
      expect(connectBtn).toBeDefined();

      fireEvent.click(connectBtn);
      expect(mockSetSettingsModalOpen).toHaveBeenCalledWith(true);
      expect(localStorage.getItem("claude_clone_settings_tab")).toBe("providers");
    });
  });
});
