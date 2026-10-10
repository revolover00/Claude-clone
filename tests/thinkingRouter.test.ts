import { describe, it, expect } from "vitest";
import {
  routeThinking,
  buildThinkingConfigFromLevel,
  getThinkingPlanAndConfig,
} from "../server/lib/thinkingRouter";

describe("thinkingRouter - classification", () => {
  describe("Trivial messages (low level)", () => {
    it("classifies simple English greetings as low", () => {
      const res = routeThinking({ content: "hello" });
      expect(res.level).toBe("low");
    });

    it("classifies English thanks and pleasantries under 12 words as low", () => {
      const res = routeThinking({ content: "Thank you so much for the help!" });
      expect(res.level).toBe("low");
    });

    it("classifies Arabic greetings as low", () => {
      const res = routeThinking({ content: "مرحبا" });
      expect(res.level).toBe("low");
    });

    it("classifies Arabic thanks as low", () => {
      const res = routeThinking({ content: "شكراً جزيلاً" });
      expect(res.level).toBe("low");
    });
  });

  describe("Normal questions and writing tasks (medium level)", () => {
    it("classifies general questions as medium", () => {
      const res = routeThinking({ content: "What is the capital of Australia?" });
      expect(res.level).toBe("medium");
    });

    it("classifies creative writing without complex indicators as medium", () => {
      const res = routeThinking({ content: "Write a short poem about an autumn morning." });
      expect(res.level).toBe("medium");
    });
  });

  describe("Complex tasks (high level)", () => {
    it("classifies code generation and debugging as high", () => {
      expect(routeThinking({ content: "Can you debug this TypeScript function?" }).level).toBe("high");
      expect(routeThinking({ content: "Write a python script to parse CSV files." }).level).toBe("high");
    });

    it("classifies math, logic, and puzzles as high", () => {
      expect(routeThinking({ content: "Solve this logic puzzle with three mislabeled boxes." }).level).toBe("high");
      expect(routeThinking({ content: "Calculate the probability of drawing three red balls." }).level).toBe("high");
    });

    it("classifies planning, architecture, trade-offs, and comparisons as high", () => {
      expect(routeThinking({ content: "Compare postgresql vs mysql and discuss the tradeoffs." }).level).toBe("high");
      expect(routeThinking({ content: "Please architect a high-scale microservice system." }).level).toBe("high");
      expect(routeThinking({ content: "Optimize this SQL query for high read throughput." }).level).toBe("high");
    });

    it("classifies Arabic complex keywords as high", () => {
      expect(routeThinking({ content: "ضع خطة عمل لمشروع تجارة إلكترونية" }).level).toBe("high");
      expect(routeThinking({ content: "صمم بنية قاعدة بيانات لنظام إدارة المخزون" }).level).toBe("high");
      expect(routeThinking({ content: "قارن بين React و Vue بالتفصيل" }).level).toBe("high");
      expect(routeThinking({ content: "اشرح خطوة بخطوة كيفية حل المسألة" }).level).toBe("high");
      expect(routeThinking({ content: "حل المسألة الرياضية التالية" }).level).toBe("high");
    });

    it("classifies messages with attachments as high", () => {
      const res = routeThinking({
        content: "hi",
        attachments: [{ id: "1", name: "data.csv", size: 100, type: "text/csv", url: "" }],
      });
      expect(res.level).toBe("high");
      expect(res.reason).toContain("attachments");
    });

    it("classifies long inputs over 1500 characters as high", () => {
      const longText = "a ".repeat(800); // 1600 characters
      const res = routeThinking({ content: longText });
      expect(res.level).toBe("high");
      expect(res.reason).toContain("1500");
    });
  });

  describe("Toggle ON (user effort override)", () => {
    it("respects user Low effort", () => {
      const res = routeThinking({ content: "optimize this code" }, { extendedThinking: true, effort: "Low" });
      expect(res.level).toBe("low");
    });

    it("respects user Medium effort", () => {
      const res = routeThinking({ content: "hi" }, { extendedThinking: true, effort: "Medium" });
      expect(res.level).toBe("medium");
    });

    it("defaults to High effort when extended thinking is on without specified effort", () => {
      const res = routeThinking({ content: "hi" }, { extendedThinking: true });
      expect(res.level).toBe("high");
    });

    it("never uses minimal; low is the floor", () => {
      const res = routeThinking({ content: "hi" }, { extendedThinking: true, effort: "minimal" as any });
      expect(res.level).toBe("high"); // Falls back to high default
    });
  });
});

describe("thinkingRouter - level mapping", () => {
  it("maps Gemini 3 models to thinkingLevel strings with includeThoughts", () => {
    const low = buildThinkingConfigFromLevel("gemini-3.1-pro-preview", "low");
    expect(low).toEqual({ includeThoughts: true, thinkingLevel: "low" });

    const med = buildThinkingConfigFromLevel("gemini-3.8-flash", "medium");
    expect(med).toEqual({ includeThoughts: true, thinkingLevel: "medium" });

    const high = buildThinkingConfigFromLevel("gemini-3.1-pro-preview", "high");
    expect(high).toEqual({ includeThoughts: true, thinkingLevel: "high" });
  });

  it("maps Gemini 2.5 models to thinkingBudget numeric values with includeThoughts", () => {
    const low = buildThinkingConfigFromLevel("gemini-2.5-pro", "low");
    expect(low).toEqual({ includeThoughts: true, thinkingBudget: 1024 });

    const med = buildThinkingConfigFromLevel("gemini-2.5-flash", "medium");
    expect(med).toEqual({ includeThoughts: true, thinkingBudget: 4096 });

    const high = buildThinkingConfigFromLevel("gemini-2.5-pro", "high");
    expect(high).toEqual({ includeThoughts: true, thinkingBudget: 16384 });
  });

  it("getThinkingPlanAndConfig coordinates plan and config together", () => {
    const result = getThinkingPlanAndConfig("gemini-3.1-pro-preview", { content: "debug this function" });
    expect(result.plan.level).toBe("high");
    expect(result.config.thinkingLevel).toBe("high");
    expect(result.config.includeThoughts).toBe(true);
  });
});
