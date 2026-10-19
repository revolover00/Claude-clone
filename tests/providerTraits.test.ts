import { describe, expect, it } from "vitest";
import { isExperimentalProvider } from "../src/shared/providerTraits";

describe("Experimental provider classification", () => {
  it("marks OpenAI-compatible integrations and exempts Google AI Studio, Groq, and OpenRouter", () => {
    for (const provider of ["openai", "xai", "mistral", "deepseek", "cerebras", "togetherai", "fireworks", "nvidia", "qwen", "moonshotai", "zai", "perplexity"]) {
      expect(isExperimentalProvider(provider), provider).toBe(true);
    }
    for (const provider of ["gemini", "google", "groq", "openrouter", "unknown"]) {
      expect(isExperimentalProvider(provider), provider).toBe(false);
    }
  });
});
