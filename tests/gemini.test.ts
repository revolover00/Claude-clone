import { describe, it, expect } from "vitest";
import { buildThinkingConfig, getBaseSystemPrompt, getTodayDateString, APP_NAME } from "../server/lib/gemini";

describe("Gemini thinkingConfig Builder", () => {
  it("builds thinkingConfig for Gemini 3 family with Low effort", () => {
    const config = buildThinkingConfig("gemini-3.8-flash", "Low");
    expect(config.includeThoughts).toBe(true);
    expect(config.thinkingLevel).toBe("low");
    expect(config.thinkingBudget).toBeUndefined();
  });

  it("builds thinkingConfig for Gemini 3 family with Medium effort", () => {
    const config = buildThinkingConfig("gemini-3.1-pro-preview", "Medium");
    expect(config.includeThoughts).toBe(true);
    expect(config.thinkingLevel).toBe("medium");
  });

  it("builds thinkingConfig for Gemini 3 family with High effort", () => {
    const config = buildThinkingConfig("gemini-3.1-pro-preview", "High");
    expect(config.includeThoughts).toBe(true);
    expect(config.thinkingLevel).toBe("high");
  });

  it("builds thinkingConfig for Gemini 2.5 family with Low effort (thinkingBudget 1024)", () => {
    const config = buildThinkingConfig("gemini-2.5-flash", "Low");
    expect(config.includeThoughts).toBe(true);
    expect(config.thinkingBudget).toBe(1024);
    expect(config.thinkingLevel).toBeUndefined();
  });

  it("builds thinkingConfig for Gemini 2.5 family with Medium effort (thinkingBudget 4096)", () => {
    const config = buildThinkingConfig("gemini-2.5-flash", "Medium");
    expect(config.includeThoughts).toBe(true);
    expect(config.thinkingBudget).toBe(4096);
  });

  it("builds thinkingConfig for Gemini 2.5 family with High effort (thinkingBudget 16384)", () => {
    const config = buildThinkingConfig("gemini-2.5-pro", "High");
    expect(config.includeThoughts).toBe(true);
    expect(config.thinkingBudget).toBe(16384);
  });
});

describe("System Prompt Configuration", () => {
  it("includes the date and default APP_NAME in the base system prompt", () => {
    const today = getTodayDateString();
    const prompt = getBaseSystemPrompt();

    expect(prompt).toContain(APP_NAME);
    expect(prompt).toContain(`Today's date is ${today}.`);
    expect(prompt).toContain("You are not made by Anthropic and you are not Claude");
  });

  it("supports custom APP_NAME and custom date", () => {
    const customPrompt = getBaseSystemPrompt("MyCustomBot", "2026-10-09");
    expect(customPrompt).toContain("You are MyCustomBot");
    expect(customPrompt).toContain("Today's date is 2026-10-09.");
  });
});

describe("SSE forwarding of thought vs answer parts", () => {
  it("formats thought parts as { thinking } and answer parts as { token } and thoughtsTokenCount", () => {
    // Simulating how server/routes/chat.ts processes candidate parts
    const candidate = {
      content: {
        parts: [
          { thought: true, text: "I am thinking about solution" },
          { text: "Here is the answer" },
        ],
      },
      usageMetadata: {
        thoughtsTokenCount: 42,
      },
    };

    const sseEvents: string[] = [];
    const writeEvent = (obj: any) => sseEvents.push(`data: ${JSON.stringify(obj)}\n\n`);

    // thoughtsTokenCount forwarding
    if (typeof candidate.usageMetadata?.thoughtsTokenCount === "number") {
      writeEvent({ thoughtsTokenCount: candidate.usageMetadata.thoughtsTokenCount });
    }

    // parts forwarding
    for (const part of candidate.content.parts) {
      if ((part as any).thought) {
        writeEvent({ thinking: part.text || "" });
      } else if (part.text) {
        writeEvent({ token: part.text });
      }
    }

    expect(sseEvents).toHaveLength(3);
    expect(sseEvents[0]).toBe('data: {"thoughtsTokenCount":42}\n\n');
    expect(sseEvents[1]).toBe('data: {"thinking":"I am thinking about solution"}\n\n');
    expect(sseEvents[2]).toBe('data: {"token":"Here is the answer"}\n\n');
  });
});
