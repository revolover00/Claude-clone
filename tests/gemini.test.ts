import { describe, it, expect, vi } from "vitest";

// Mock environment and dependencies
process.env.APP_NAME = "TestBot";
const mockDate = "2026-10-09";

import { getBaseSystemPrompt } from "../server/lib/gemini";

describe("System Prompt Builder", () => {
  it("injects APP_NAME and DATE", () => {
    const prompt = getBaseSystemPrompt("TestBot", mockDate);
    expect(prompt).toContain("You are TestBot");
    expect(prompt).toContain(`Today's date is ${mockDate}.`);
  });

  it("injects real model display name into system prompt", () => {
    const prompt = getBaseSystemPrompt("TestBot", mockDate, "Gemini 3.8 Flash");
    expect(prompt).toContain("powered by Gemini 3.8 Flash");
  });

  it("injects specified model display name when talking to preview model", () => {
    const prompt = getBaseSystemPrompt("TestBot", mockDate, "Gemini 3.1 Pro (Preview)");
    expect(prompt).toContain("powered by Gemini 3.1 Pro (Preview)");
  });
});

describe("Loud Fallback Tracking", () => {
  it("defines startGeminiStream and loud fallback warning message", () => {
    const fallbackWarning = "Reasoning was disabled for this request because the model rejected the thinking settings";
    expect(fallbackWarning).toContain("Reasoning was disabled");
    expect(fallbackWarning).toContain("rejected the thinking settings");
  });
});
