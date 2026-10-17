import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const streamMock = vi.hoisted(() => ({
  calls: [] as Array<{ cbs: Record<string, (...args: unknown[]) => void> }>,
}));

// jsdom does not implement ResizeObserver (used by assistant-ui internals).
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  globalThis.ResizeObserver ?? (MockResizeObserver as unknown as typeof ResizeObserver);
// jsdom elements do not implement scrollTo (used by thread auto-scroll).
if (typeof Element.prototype.scrollTo !== "function") {
  Element.prototype.scrollTo = () => {};
}

vi.mock("../src/utils/streamResponse", () => ({
  streamRealResponse: (
    _prompt: string,
    _signal: AbortSignal,
    _options: unknown,
    cbs: Record<string, (...args: unknown[]) => void>
  ) => {
    streamMock.calls.push({ cbs });
    return () => {};
  },
}));

vi.mock("../src/hooks/useModels", () => ({
  useModels: () => ({
    models: [],
    loading: false,
    defaultModel: { slug: "gemini-3-8-flash", display_name: "Test Model" },
    normalizeSlug: (s: string) => s,
    refetch: () => {},
  }),
}));

vi.mock("../src/context/ChatContext", () => ({
  useChat: () => ({
    preferences: {
      responseStyle: "default",
      profileInstructions: "",
      language: "",
      memory_enabled: false,
    },
  }),
}));

vi.mock("../src/components/chat/MarkdownView", () => ({
  default: ({ content }: { content: string }) => <p>{content}</p>,
}));

import AssistantUiPage from "../src/components/assistantUi/AssistantUiPage";

describe("assistant-ui page (/assistant)", () => {
  it("streams a reply through the shared /api/chat client without duplicating messages", async () => {
    streamMock.calls.length = 0;
    render(
      <MemoryRouter>
        <AssistantUiPage />
      </MemoryRouter>
    );

    // Header shows the default model picked by useModels.
    expect(screen.getByText("gemini-3-8-flash")).toBeTruthy();

    // Empty state greeting before any message.
    expect(screen.getByText(/How can I help you today/)).toBeTruthy();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hi there" } });
    fireEvent.click(screen.getByLabelText("Send message"));

    // The user message appears exactly once (no optimistic duplicate).
    expect(await screen.findAllByText("Hi there")).toHaveLength(1);

    // Assistant placeholder is running before any token arrives.
    await waitFor(() => expect(streamMock.calls).toHaveLength(1));
    expect(screen.getByLabelText("Thinking")).toBeTruthy();
    // Send is hidden while running; stop control is available.
    expect(screen.getByLabelText("Stop response")).toBeTruthy();

    const { cbs } = streamMock.calls[0];
    act(() => {
      cbs.onToken?.("Hello from mock", "Hello from mock");
    });
    expect(await screen.findAllByText("Hello from mock")).toHaveLength(1);

    act(() => {
      cbs.onDone?.("Hello from mock");
    });
    await waitFor(() =>
      expect(screen.queryByLabelText("Thinking")).toBeNull()
    );
    expect(screen.getAllByText("Hello from mock")).toHaveLength(1);
    expect(screen.getAllByText("Hi there")).toHaveLength(1);
  });

  it("surfaces a failed stream as an error note on the assistant message", async () => {
    streamMock.calls.length = 0;
    render(
      <MemoryRouter>
        <AssistantUiPage />
      </MemoryRouter>
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Will fail" } });
    fireEvent.click(screen.getByLabelText("Send message"));
    await waitFor(() => expect(streamMock.calls).toHaveLength(1));

    const { cbs } = streamMock.calls[0];
    act(() => {
      cbs.onError?.(new Error("upstream exploded"));
    });

    expect(
      await screen.findByText(/The response was interrupted/)
    ).toBeTruthy();
  });
});
