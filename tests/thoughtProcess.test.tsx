import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ThoughtProcess from "../src/components/chat/ThoughtProcess";

describe("ThoughtProcess", () => {
  it("renders 4 timeline nodes for 4 stages when expanded", () => {
    const thoughts = "**Stage 1**\n\nBody 1\n\n**Stage 2**\n\nBody 2\n\n**Stage 3**\n\nBody 3\n\n**Stage 4**\n\nBody 4";
    render(<ThoughtProcess isThinking={true} thoughts={thoughts} hasAnswerToken={false} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

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
});
