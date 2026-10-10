import { describe, it, expect, vi } from "vitest";
import {
  computeThinkingVerdict,
  runThinkingDiagnostic,
  THREE_BOXES_PUZZLE,
  type LevelDiagnosticResult,
} from "../server/lib/testThinking";

describe("testThinking diagnostic verdict logic", () => {
  it("returns 'Returns thought summaries' when thought parts or text exist", () => {
    const results: LevelDiagnosticResult[] = [
      {
        level: "low",
        accepted: true,
        error: null,
        timeToFirstThoughtMs: 800,
        thoughtParts: 2,
        thoughtChars: 120,
        thoughtsTokenCount: 50,
        totalMs: 1500,
        fallbackApplied: false,
        firstThoughtPreview: "Let's check box 1...",
      },
      {
        level: "medium",
        accepted: true,
        error: null,
        timeToFirstThoughtMs: 900,
        thoughtParts: 4,
        thoughtChars: 250,
        thoughtsTokenCount: 110,
        totalMs: 2000,
        fallbackApplied: false,
        firstThoughtPreview: "Box labeled Apples & Oranges...",
      },
      {
        level: "high",
        accepted: true,
        error: null,
        timeToFirstThoughtMs: 1100,
        thoughtParts: 6,
        thoughtChars: 450,
        thoughtsTokenCount: 200,
        totalMs: 2800,
        fallbackApplied: false,
        firstThoughtPreview: "Deducing labels step by step...",
      },
    ];

    expect(computeThinkingVerdict(results)).toBe("Returns thought summaries");
  });

  it("returns 'Thinks but returns no summary' when thoughtsTokenCount > 0 but 0 thought text chunks", () => {
    const results: LevelDiagnosticResult[] = [
      {
        level: "low",
        accepted: true,
        error: null,
        timeToFirstThoughtMs: null,
        thoughtParts: 0,
        thoughtChars: 0,
        thoughtsTokenCount: 128,
        totalMs: 1200,
        fallbackApplied: false,
        firstThoughtPreview: "",
      },
      {
        level: "medium",
        accepted: true,
        error: null,
        timeToFirstThoughtMs: null,
        thoughtParts: 0,
        thoughtChars: 0,
        thoughtsTokenCount: 256,
        totalMs: 1800,
        fallbackApplied: false,
        firstThoughtPreview: "",
      },
      {
        level: "high",
        accepted: true,
        error: null,
        timeToFirstThoughtMs: null,
        thoughtParts: 0,
        thoughtChars: 0,
        thoughtsTokenCount: 512,
        totalMs: 2400,
        fallbackApplied: false,
        firstThoughtPreview: "",
      },
    ];

    expect(computeThinkingVerdict(results)).toBe("Thinks but returns no summary");
  });

  it("returns 'Does not think' when accepted but no thought tokens and no thought parts", () => {
    const results: LevelDiagnosticResult[] = [
      {
        level: "low",
        accepted: true,
        error: null,
        timeToFirstThoughtMs: null,
        thoughtParts: 0,
        thoughtChars: 0,
        thoughtsTokenCount: 0,
        totalMs: 900,
        fallbackApplied: false,
        firstThoughtPreview: "",
      },
      {
        level: "medium",
        accepted: true,
        error: null,
        timeToFirstThoughtMs: null,
        thoughtParts: 0,
        thoughtChars: 0,
        thoughtsTokenCount: 0,
        totalMs: 950,
        fallbackApplied: false,
        firstThoughtPreview: "",
      },
      {
        level: "high",
        accepted: true,
        error: null,
        timeToFirstThoughtMs: null,
        thoughtParts: 0,
        thoughtChars: 0,
        thoughtsTokenCount: 0,
        totalMs: 1000,
        fallbackApplied: false,
        firstThoughtPreview: "",
      },
    ];

    expect(computeThinkingVerdict(results)).toBe("Does not think");
  });

  it("returns 'Rejected the config' when all levels failed or had fallback applied", () => {
    const results: LevelDiagnosticResult[] = [
      {
        level: "low",
        accepted: false,
        error: "Invalid thinkingConfig for model",
        timeToFirstThoughtMs: null,
        thoughtParts: 0,
        thoughtChars: 0,
        thoughtsTokenCount: 0,
        totalMs: 300,
        fallbackApplied: true,
        firstThoughtPreview: "",
      },
      {
        level: "medium",
        accepted: false,
        error: "Invalid thinkingConfig for model",
        timeToFirstThoughtMs: null,
        thoughtParts: 0,
        thoughtChars: 0,
        thoughtsTokenCount: 0,
        totalMs: 310,
        fallbackApplied: true,
        firstThoughtPreview: "",
      },
      {
        level: "high",
        accepted: false,
        error: "Invalid thinkingConfig for model",
        timeToFirstThoughtMs: null,
        thoughtParts: 0,
        thoughtChars: 0,
        thoughtsTokenCount: 0,
        totalMs: 305,
        fallbackApplied: true,
        firstThoughtPreview: "",
      },
    ];

    expect(computeThinkingVerdict(results)).toBe("Rejected the config");
  });
});

describe("runThinkingDiagnostic with mocked client", () => {
  it("runs the fixed 3-boxes reasoning puzzle across low, medium, and high levels", async () => {
    const mockGenerateContentStream = vi.fn().mockImplementation(async ({ model, contents, config }) => {
      expect(contents[0].parts[0].text).toBe(THREE_BOXES_PUZZLE);
      expect(config.thinkingConfig.includeThoughts).toBe(true);

      async function* streamGenerator() {
        yield {
          usageMetadata: { thoughtsTokenCount: 42 },
          candidates: [
            {
              content: {
                parts: [
                  { thought: true, text: "I pick from the box labeled Apples and Oranges." },
                ],
              },
            },
          ],
        };
        yield {
          candidates: [
            {
              content: {
                parts: [
                  { text: "Because every box is mislabeled, this box cannot have both." },
                ],
              },
            },
          ],
        };
      }

      return streamGenerator();
    });

    const mockAi = {
      models: {
        generateContentStream: mockGenerateContentStream,
      },
    };

    const result = await runThinkingDiagnostic(mockAi, "gemini-3.1-pro-preview");

    expect(mockGenerateContentStream).toHaveBeenCalledTimes(3);
    expect(result.verdict).toBe("Returns thought summaries");
    expect(result.levels.low.accepted).toBe(true);
    expect(result.levels.low.thoughtParts).toBe(1);
    expect(result.levels.low.firstThoughtPreview).toContain("I pick from the box labeled Apples");
    expect(result.levels.medium.accepted).toBe(true);
    expect(result.levels.high.accepted).toBe(true);
  });
});
