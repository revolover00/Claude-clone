import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ThoughtProcess from "../src/components/chat/ThoughtProcess";
import { SSEParser } from "../src/utils/sseParser";

describe("Honest UI Conditions in ThoughtProcess", () => {
  it("shows nothing when toggle is OFF and prompt is trivial (thinkingPlan: low and no thoughts)", () => {
    const { container } = render(
      <ThoughtProcess
        isThinking={true}
        thoughts=""
        extendedThinking={false}
        thinkingPlan={{ level: "low", reason: "Trivial greeting" }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows waiting shimmer when toggle is OFF but server sent thinkingPlan with level high", () => {
    render(
      <ThoughtProcess
        isThinking={true}
        thoughts=""
        extendedThinking={false}
        thinkingPlan={{ level: "high", reason: "Complex logic detected" }}
      />
    );
    expect(screen.getAllByText("Thinking").length).toBeGreaterThan(0);
  });

  it("shows waiting shimmer when toggle is OFF but server sent thinkingPlan with level medium", () => {
    render(
      <ThoughtProcess
        isThinking={true}
        thoughts=""
        extendedThinking={false}
        thinkingPlan={{ level: "medium", reason: "Standard question" }}
      />
    );
    expect(screen.getAllByText("Thinking").length).toBeGreaterThan(0);
  });

  it("shows waiting shimmer when toggle is ON even before thoughts arrive", () => {
    render(
      <ThoughtProcess
        isThinking={true}
        thoughts=""
        extendedThinking={true}
      />
    );
    expect(screen.getAllByText("Thinking").length).toBeGreaterThan(0);
  });

  it("renders 'Thought for Ns · no summary available' non-expandable pill when toggle was ON and model finished without thoughts", () => {
    render(
      <ThoughtProcess
        isThinking={false}
        thoughts=""
        extendedThinking={true}
        thinkingMs={3500}
      />
    );
    expect(screen.getByText(/Thought for 4s · no summary available/i)).toBeDefined();
    // Non-expandable: should NOT be an interactive button or have chevron
    expect(screen.queryByRole("button", { name: /show how i thought/i })).toBeNull();
  });

  it("renders nothing when toggle was OFF and model finished without returning thought text", () => {
    const { container } = render(
      <ThoughtProcess
        isThinking={false}
        thoughts=""
        extendedThinking={false}
        thinkingPlan={{ level: "high", reason: "Complex logic detected" }}
        hasAnswerToken={true}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders stages when thoughts are returned regardless of toggle", () => {
    render(
      <ThoughtProcess
        isThinking={false}
        thoughts={"**Analysis**\nStep 1 complete"}
        extendedThinking={false}
        thinkingMs={2000}
      />
    );
    expect(screen.getByText(/Thought for 2s/i)).toBeDefined();
  });
});

describe("Fallback warning emission in SSEParser", () => {
  it("dispatches warning event when server emits thinking fallback warning", () => {
    let receivedWarning = "";
    let receivedPlan: any = null;

    const parser = new SSEParser({
      onWarning: (w) => {
        receivedWarning = w;
      },
      onThinkingPlan: (p) => {
        receivedPlan = p;
      },
    });

    parser.feed(`data: ${JSON.stringify({ thinkingPlan: { level: "high", reason: "Complex query" } })}\n\n`);
    expect(receivedPlan).toEqual({ level: "high", reason: "Complex query" });

    parser.feed(`data: ${JSON.stringify({ warning: "Reasoning was disabled for this request because the model rejected the thinking settings" })}\n\n`);
    expect(receivedWarning).toBe("Reasoning was disabled for this request because the model rejected the thinking settings");
  });
});
