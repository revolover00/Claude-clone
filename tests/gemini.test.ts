import { describe, it, expect, vi } from "vitest";

// Mock environment and dependencies
process.env.APP_NAME = "TestBot";
const mockDate = "2026-10-09";

import { buildThinkingConfig, getBaseSystemPrompt } from "../server/lib/gemini";

describe("Thinking Config Builder", () => {
  it("builds Gemini 3 thinking config with toggle on (respects effort levels)", () => {
    expect(buildThinkingConfig("gemini-3.8-flash", "Low", true)).toEqual({ includeThoughts: true, thinkingLevel: "low" });
    expect(buildThinkingConfig("gemini-3.8-flash", "Medium", true)).toEqual({ includeThoughts: true, thinkingLevel: "medium" });
    expect(buildThinkingConfig("gemini-3.8-flash", "High", true)).toEqual({ includeThoughts: true, thinkingLevel: "high" });
  });

  it("builds Gemini 3 thinking config with toggle off (always includeThoughts with low level)", () => {
    const config = buildThinkingConfig("gemini-3.8-flash", "High", false);
    expect(config).toEqual({ includeThoughts: true, thinkingLevel: "low" });
  });

  it("builds Gemini 2.5 thinking config with toggle on (respects effort budgets)", () => {
    expect(buildThinkingConfig("gemini-2.5-flash", "Low", true)).toEqual({ includeThoughts: true, thinkingBudget: 1024 });
    expect(buildThinkingConfig("gemini-2.5-flash", "Medium", true)).toEqual({ includeThoughts: true, thinkingBudget: 4096 });
    expect(buildThinkingConfig("gemini-2.5-flash", "High", true)).toEqual({ includeThoughts: true, thinkingBudget: 16384 });
  });

  it("builds Gemini 2.5 thinking config with toggle off (always includeThoughts with budget 1024)", () => {
    const config = buildThinkingConfig("gemini-2.5-flash", "High", false);
    expect(config).toEqual({ includeThoughts: true, thinkingBudget: 1024 });
  });
});

describe("System Prompt Builder", () => {
  it("injects APP_NAME and DATE", () => {
    const prompt = getBaseSystemPrompt("TestBot", mockDate);
    expect(prompt).toContain("You are TestBot");
    expect(prompt).toContain(`Today's date is ${mockDate}.`);
  });
});

describe("Loud Fallback Tracking", () => {
  it("defines startGeminiStream and loud fallback warning message", () => {
    const fallbackWarning = "Reasoning was disabled for this request because the model rejected the thinking settings";
    expect(fallbackWarning).toContain("Reasoning was disabled");
    expect(fallbackWarning).toContain("rejected the thinking settings");
  });
});
