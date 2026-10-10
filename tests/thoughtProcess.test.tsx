import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ThoughtProcess from "../src/components/chat/ThoughtProcess";

describe("ThoughtProcess", () => {
  it("renders 4 timeline nodes for 4 stages when expanded", () => {
    const thoughts = "**Stage 1**\n\nBody 1\n\n**Stage 2**\n\nBody 2\n\n**Stage 3**\n\nBody 3\n\n**Stage 4**\n\nBody 4";
    render(<ThoughtProcess isThinking={true} thoughts={thoughts} hasAnswerToken={false} />);

    expect(screen.getByText("Stage 1")).toBeDefined();
    expect(screen.getByText("Stage 2")).toBeDefined();
    expect(screen.getByText("Stage 3")).toBeDefined();
    expect(screen.getAllByText("Stage 4").length).toBeGreaterThan(0);
  });

  it("shows Thought for 4s instead of 1s for a 4-second thinking phase with persisted thinkingMs", () => {
    render(
      <ThoughtProcess
        isThinking={false}
        thoughts="**Planning**\n\nDone thinking"
        hasAnswerToken={true}
        thinkingStartedAt={Date.now() - 4000}
        thinkingMs={4000}
      />
    );

    expect(screen.getByText(/Thought for 4s/i)).toBeDefined();
  });

  it("correctly ticks the live timer during a 4-second thinking phase using fake timers", () => {
    vi.useFakeTimers();
    try {
      const startTime = Date.now();
      render(
        <ThoughtProcess
          isThinking={true}
          thoughts="**Planning the layout**\n\nDrafting..."
          thinkingStartedAt={startTime}
          hasAnswerToken={false}
        />
      );

      // Initial stage title is displayed
      expect(screen.getAllByText("Planning the layout").length).toBeGreaterThan(0);

      // Advance by 4 seconds
      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(screen.getByText(/· [45]s/)).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("formats longer duration nicely (1m 5s)", () => {
    render(
      <ThoughtProcess
        isThinking={false}
        thoughts="Deep thought"
        hasAnswerToken={true}
        thinkingStartedAt={Date.now() - 65000}
        thinkingMs={65000}
      />
    );

    expect(screen.getByText(/Thought for 1m 5s/i)).toBeDefined();
  });

  it("renders nothing when there is no thinking text produced", () => {
    const { container } = render(
      <ThoughtProcess isThinking={false} thoughts="" hasAnswerToken={true} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows correct duration when thinking arrives with toggle off (thinkingStartedAt set dynamically)", () => {
    vi.useFakeTimers();
    try {
      const startTime = Date.now();
      const { rerender } = render(
        <ThoughtProcess
          isThinking={true}
          thoughts=""
          hasAnswerToken={false}
        />
      );

      // Initially no thinkingStartedAt, so no duration shown
      expect(screen.queryByText(/s$/)).toBeNull();

      // Thinking arrives with toggle off (thinkingStartedAt populated)
      rerender(
        <ThoughtProcess
          isThinking={true}
          thoughts="**Thinking phase**\n\nProcessing..."
          thinkingStartedAt={startTime}
          hasAnswerToken={false}
        />
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByText(/· 3s/)).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows correct duration when thinking arrives with toggle on", () => {
    vi.useFakeTimers();
    try {
      const startTime = Date.now();
      render(
        <ThoughtProcess
          isThinking={true}
          thoughts="**Thinking phase**\n\nProcessing..."
          thinkingStartedAt={startTime}
          hasAnswerToken={false}
        />
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText(/· 5s/)).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("handles auto showThinking mode: expands while thinking, collapses on answer token", () => {
    const { rerender } = render(
      <ThoughtProcess
        isThinking={true}
        thoughts="**Phase 1**\n\nAnalyzing..."
        hasAnswerToken={false}
        showThinking="auto"
      />
    );

    // In auto mode while thinking, it is expanded
    expect(screen.getByText("Analyzing...")).toBeDefined();

    // When answer token arrives, it auto-collapses
    rerender(
      <ThoughtProcess
        isThinking={false}
        thoughts="**Phase 1**\n\nAnalyzing..."
        hasAnswerToken={true}
        showThinking="auto"
      />
    );

    expect(screen.queryByText("Analyzing...")).toBeNull();
  });

  it("handles expanded showThinking mode: remains open after finishing", () => {
    render(
      <ThoughtProcess
        isThinking={false}
        thoughts="**Phase 1**\n\nAlways visible body"
        hasAnswerToken={true}
        thinkingMs={3000}
        showThinking="expanded"
      />
    );

    expect(screen.getByText("Always visible body")).toBeDefined();
  });

  it("handles collapsed showThinking mode: stays closed while thinking", () => {
    render(
      <ThoughtProcess
        isThinking={true}
        thoughts="**Phase 1**\n\nHidden body"
        hasAnswerToken={false}
        showThinking="collapsed"
      />
    );

    expect(screen.queryByText("Hidden body")).toBeNull();
  });

  it("shows waiting state with shimmer and three skeleton lines before thoughts arrive", () => {
    render(
      <ThoughtProcess
        isThinking={true}
        thoughts=""
        thinkingStartedAt={Date.now() - 2000}
        hasAnswerToken={false}
        showThinking="expanded"
      />
    );

    // Waiting header shows Thinking · 2s
    expect(screen.getAllByText("Thinking").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/· 2s/)).toBeDefined();

    // When expanded, renders the 3 animated skeleton lines
    const skeletons = document.querySelectorAll(".animate-pulse.rounded");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it("renders a clickable pill with aria-label after finishing", () => {
    render(
      <ThoughtProcess
        isThinking={false}
        thoughts="**Planning**\n\nDetailed plan"
        hasAnswerToken={true}
        thinkingStartedAt={Date.now() - 4000}
        thinkingMs={4000}
      />
    );

    const pill = screen.getByRole("button", { name: "Show how I thought" });
    expect(pill).toBeDefined();

    // Click pill to open full timeline
    fireEvent.click(pill);
    expect(screen.getByText("Detailed plan")).toBeDefined();
  });

  it("persists and restores thinking text and duration from message data after reload", () => {
    const restoredMessage = {
      thinking: "**Restored Stage**\n\nPreserved thought body from storage.",
      thinkingMs: 7500,
    };

    render(
      <ThoughtProcess
        isThinking={false}
        thoughts={restoredMessage.thinking}
        thinkingMs={restoredMessage.thinkingMs}
        hasAnswerToken={true}
      />
    );

    expect(screen.getByText(/Thought for 8s/)).toBeDefined();

    const pill = screen.getByRole("button", { name: "Show how I thought" });
    fireEvent.click(pill);
    expect(screen.getByText("Restored Stage")).toBeDefined();
    expect(screen.getByText("Preserved thought body from storage.")).toBeDefined();
  });
});
