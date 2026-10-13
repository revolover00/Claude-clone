import { describe, it, expect } from "vitest";
import { normalizeGeminiModel } from "../server/lib/providers/gemini";
import { normalizeGroqModel } from "../server/lib/providers/groq";
import { normalizeOpenRouterModel } from "../server/lib/providers/openrouter";

describe("Catalog Normalization - Fixture Tests", () => {
  it("normalizes Gemini model fixtures correctly (stripping models/ prefix and mapping fields)", () => {
    const fixtureGemini3 = {
      name: "models/gemini-3.8-flash",
      displayName: "Gemini 3.8 Flash",
      description: "Fast reasoning model",
      inputTokenLimit: 1048576,
      outputTokenLimit: 65536,
      supportedActions: ["generateContent", "functionCalling"],
    };

    const norm3 = normalizeGeminiModel(fixtureGemini3);
    expect(norm3.provider).toBe("gemini");
    expect(norm3.id).toBe("gemini-3.8-flash");
    expect(norm3.displayName).toBe("Gemini 3.8 Flash");
    expect(norm3.contextLength).toBe(1048576);
    expect(norm3.maxOutputTokens).toBe(65536);
    expect(norm3.supportsTools).toBe(true);
    expect(norm3.supportsReasoning).toBe(true);
    expect(norm3.supportsVision).toBe(true);

    const fixtureGeminiLegacy = {
      name: "models/gemini-1.5-flash",
      displayName: "Gemini 1.5 Flash",
      inputTokenLimit: 1000000,
      outputTokenLimit: 8192,
      supportedGenerationMethods: ["generateContent"],
    };

    const normLegacy = normalizeGeminiModel(fixtureGeminiLegacy);
    expect(normLegacy.id).toBe("gemini-1.5-flash");
    expect(normLegacy.supportsReasoning).toBe(false);
  });

  it("normalizes Groq model fixtures correctly", () => {
    const fixtureGroq = {
      id: "deepseek-r1-distill-llama-70b",
      context_window: 128000,
      active: true,
    };

    const norm = normalizeGroqModel(fixtureGroq);
    expect(norm.provider).toBe("groq");
    expect(norm.id).toBe("deepseek-r1-distill-llama-70b");
    expect(norm.contextLength).toBe(128000);
    expect(norm.supportsReasoning).toBe(true);
    expect(norm.supportsTools).toBe(true);
    expect(norm.isActive).toBe(true);
  });

  it("normalizes OpenRouter model fixtures correctly", () => {
    const fixtureOpenRouter = {
      id: "anthropic/claude-3.7-sonnet",
      name: "Anthropic: Claude 3.7 Sonnet",
      description: "Hybrid reasoning model",
      context_length: 200000,
      top_provider: { max_completion_tokens: 64000 },
      supported_parameters: ["tools", "reasoning"],
      pricing: { prompt: "0.000003", completion: "0.000015" },
      architecture: { modality: ["text", "image"] },
    };

    const norm = normalizeOpenRouterModel(fixtureOpenRouter);
    expect(norm.provider).toBe("openrouter");
    expect(norm.id).toBe("anthropic/claude-3.7-sonnet");
    expect(norm.displayName).toBe("Anthropic: Claude 3.7 Sonnet");
    expect(norm.contextLength).toBe(200000);
    expect(norm.maxOutputTokens).toBe(64000);
    expect(norm.supportsTools).toBe(true);
    expect(norm.supportsReasoning).toBe(true);
    expect(norm.supportsVision).toBe(true);
    expect(norm.pricing).toEqual({
      inputPerMTok: 3,
      outputPerMTok: 15,
      currency: "USD",
    });
  });
});
