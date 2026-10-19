import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ToolActivityView from "../src/components/chat/ToolActivityView";
import type { ToolActivityEvent } from "../src/types/chat";

const finishedEvent: ToolActivityEvent = {
  id: "call-1",
  name: "load_skill",
  skill: "writing-guidance",
  status: "completed",
};

describe("ToolActivityView", () => {
  it("shows a compact summary and expandable completed tool history", () => {
    render(<ToolActivityView events={[finishedEvent]} isStreaming={false} isArabic={false} />);
    const toggle = screen.getByRole("button", { name: /tool activity/i });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("1 step")).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.getByText("Using skill · writing guidance")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("marks unfinished activity as stopped instead of claiming it is still running", () => {
    render(
      <ToolActivityView
        events={[{ ...finishedEvent, status: "executing" }]}
        isStreaming={false}
        isArabic={false}
      />
    );

    expect(screen.getByText("A step needs attention")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Stopped before completion")).toBeTruthy();
  });

  it("auto-expands a live tool and uses Arabic activity labels", () => {
    render(
      <ToolActivityView
        events={[{ ...finishedEvent, status: "executing" }]}
        isStreaming
        isArabic
      />
    );

    expect(screen.getByText("نشاط الأدوات")).toBeTruthy();
    expect(screen.getByText("جارٍ العمل")).toBeTruthy();
    expect(screen.getByText("جارٍ التنفيذ")).toBeTruthy();
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("true");
  });
});
