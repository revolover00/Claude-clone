import { describe, it, expect, vi } from "vitest";

// Mock environment and dependencies
process.env.APP_NAME = "TestBot";
const mockDate = "2026-10-09";

import { buildThinkingConfig, getBaseSystemPrompt } from "../server/lib/gemini";

describe("Thinking Config Builder", () => {
  it("builds Gemini 3 thinking config", () => {
    const config = buildThinkingConfig("gemini-3.8-flash", "Medium");
    expect(config).toEqual({ includeThoughts: true, thinkingLevel: "medium" });
  });

  it("builds Gemini 2.5 thinking config", () => {
    const config = buildThinkingConfig("gemini-2.5-flash", "Medium");
    expect(config).toEqual({ includeThoughts: true, thinkingBudget: 4096 });
  });
});

describe("System Prompt Builder", () => {
  it("injects APP_NAME and DATE", () => {
    const prompt = getBaseSystemPrompt("TestBot", mockDate);
    expect(prompt).toContain("You are TestBot");
    expect(prompt).toContain(`Today's date is ${mockDate}.`);
  });
});
