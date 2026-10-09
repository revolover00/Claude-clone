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
});
