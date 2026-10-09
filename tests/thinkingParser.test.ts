import { describe, it, expect } from "vitest";
import { parseThinkingStages, formatThinkingDuration, isRtlText } from "../src/utils/thinkingStages";

describe("parseThinkingStages", () => {
  it("parses multiple stages and marks all earlier as done and last as current when thinking", () => {
    const text = "**Planning the layout**\n\nI need to plan the layout.\n\n**Executing**\n\nExecuting now.";
    const stages = parseThinkingStages(text, true);
    expect(stages.length).toBe(2);
    expect(stages[0].title).toBe("Planning the layout");
    expect(stages[0].done).toBe(true);
    expect(stages[1].title).toBe("Executing");
    expect(stages[1].done).toBe(false);
  });

  it("marks all stages as done when thinking has completed", () => {
    const text = "**Planning**\n\nPlan body.\n\n**Executing**\n\nDone body.";
    const stages = parseThinkingStages(text, false);
    expect(stages.length).toBe(2);
    expect(stages[0].done).toBe(true);
    expect(stages[1].done).toBe(true);
  });

  it("turns text before the first heading into a stage titled Thinking", () => {
    const text = "Initial thinking here.\n\n**Planning**\n\nPlan body.";
    const stages = parseThinkingStages(text, true);
    expect(stages.length).toBe(2);
    expect(stages[0].title).toBe("Thinking");
    expect(stages[0].body).toBe("Initial thinking here.");
    expect(stages[0].done).toBe(true);
    expect(stages[1].title).toBe("Planning");
    expect(stages[1].done).toBe(false);
  });

  it("does not show an unclosed **title at the end until it closes", () => {
    const text = "**Stage 1**\n\nBody 1\n\n**Incomplete next title";
    const stages = parseThinkingStages(text, true);
    expect(stages.length).toBe(1);
    expect(stages[0].title).toBe("Stage 1");
    expect(stages[0].body).toBe("Body 1");
    expect(stages[0].done).toBe(false);

    // Now close it
    const closedText = "**Stage 1**\n\nBody 1\n\n**Incomplete next title**\n\nBody 2";
    const closedStages = parseThinkingStages(closedText, true);
    expect(closedStages.length).toBe(2);
    expect(closedStages[1].title).toBe("Incomplete next title");
  });

  it("handles Arabic titles correctly", () => {
    const text = "**التخطيط للواجهة**\n\nسنقوم بتجهيز المكونات الأساسية.\n\n**بناء المكونات**\n\nجاري البناء...";
    const stages = parseThinkingStages(text, true);
    expect(stages.length).toBe(2);
    expect(stages[0].title).toBe("التخطيط للواجهة");
    expect(stages[1].title).toBe("بناء المكونات");
    expect(isRtlText(stages[0].title)).toBe(true);
  });

  it("handles repeated titles as distinct stages", () => {
    const text = "**Refining code**\n\nFirst pass.\n\n**Refining code**\n\nSecond pass.";
    const stages = parseThinkingStages(text, true);
    expect(stages.length).toBe(2);
    expect(stages[0].title).toBe("Refining code");
    expect(stages[0].body).toBe("First pass.");
    expect(stages[0].done).toBe(true);
    expect(stages[1].title).toBe("Refining code");
    expect(stages[1].body).toBe("Second pass.");
    expect(stages[1].done).toBe(false);
  });

  it("handles text with no headings at all", () => {
    const text = "Just pondering some logic without any bold markdown headers.";
    const stages = parseThinkingStages(text, true);
    expect(stages.length).toBe(1);
    expect(stages[0].title).toBe("Thinking");
    expect(stages[0].body).toBe(text);
    expect(stages[0].done).toBe(false);
  });

  it("handles trailing partial markdown like single asterisks", () => {
    const text = "**Stage 1**\n\nBody text with partial *italic";
    const stages = parseThinkingStages(text, true);
    expect(stages.length).toBe(1);
    expect(stages[0].title).toBe("Stage 1");
    expect(stages[0].body).toBe("Body text with partial *italic");
  });
});

describe("formatThinkingDuration", () => {
  it("formats seconds and minutes correctly", () => {
    expect(formatThinkingDuration(4000)).toBe("4s");
    expect(formatThinkingDuration(8000)).toBe("8s");
    expect(formatThinkingDuration(65000)).toBe("1m 5s");
    expect(formatThinkingDuration(120000)).toBe("2m 0s");
  });
});
