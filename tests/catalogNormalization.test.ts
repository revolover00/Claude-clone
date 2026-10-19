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

  it("OpenRouter text-only fixture: modality string parses to text->text, no vision", () => {
    const textOnly = {
      id: "vendor/text-only",
      name: "Vendor Text Only",
      context_length: 32768,
      supported_parameters: ["tools", "response_format", "reasoning"],
      pricing: { prompt: "0.000002", completion: "0.000006" },
      architecture: { modality: "text->text" },
      created: 1735689600, // 2025-01-01
    };
    const norm = normalizeOpenRouterModel(textOnly);
    expect(norm.inputModalities).toEqual(["text"]);
    expect(norm.outputModalities).toEqual(["text"]);
    expect(norm.supportsVision).toBe(false);
    expect(norm.kind).toBe("chat");
    expect(norm.supportsTools).toBe(true);
    expect(norm.supportsJson).toBe(true);
    expect(norm.supportsReasoning).toBe(true);
    expect(norm.releasedAt).toBe("2025-01-01");
    expect(norm.pricing).toEqual({ inputPerMTok: 2, outputPerMTok: 6, currency: "USD" });
  });

  it("OpenRouter vision fixture: architecture.input_modalities drives supportsVision", () => {
    const vision = {
      id: "vendor/vision-model",
      name: "Vision Model",
      supported_parameters: ["include_reasoning", "tools"],
      pricing: { prompt: "0.000001", completion: "0.000002" },
      architecture: {
        modality: "text+image->text",
        input_modalities: ["text", "image"],
        output_modalities: ["text"],
      },
    };
    const norm = normalizeOpenRouterModel(vision);
    expect(norm.inputModalities).toEqual(["text", "image"]);
    expect(norm.supportsVision).toBe(true);
    expect(norm.kind).toBe("chat");
    expect(norm.supportsReasoning).toBe(true); // include_reasoning counts
    expect(norm.supportsJson).toBe(false);
    expect(norm.releasedAt).toBeNull();
  });

  it("OpenRouter image-output fixture: output modality decides kind", () => {
    const imageOut = {
      id: "vendor/image-out",
      name: "Image Out",
      supported_parameters: [],
      pricing: { prompt: "-1", completion: "-1" },
      architecture: { modality: "text->image" },
    };
    const norm = normalizeOpenRouterModel(imageOut);
    expect(norm.inputModalities).toEqual(["text"]);
    expect(norm.outputModalities).toEqual(["image"]);
    expect(norm.supportsVision).toBe(false); // vision = INPUT includes image
    expect(norm.kind).toBe("image");
    // "-1" pricing is variable -> null ("Variable" in the UI).
    expect(norm.pricing).toBeNull();
  });

  it("OpenRouter free fixture: zero pricing stays 0, not null", () => {
    const free = {
      id: "vendor/free-model",
      name: "Free Model",
      pricing: { prompt: "0", completion: "0" },
      architecture: { modality: "text->text" },
      supported_parameters: ["tools"],
    };
    const norm = normalizeOpenRouterModel(free);
    expect(norm.pricing).toEqual({ inputPerMTok: 0, outputPerMTok: 0, currency: "USD" });
    expect(norm.supportsTools).toBe(true);
    expect(norm.supportsJson).toBe(false);
  });

  it("Gemini embed-only fixture derives kind embedding", () => {
    const embed = {
      name: "models/text-embedding-004",
      displayName: "Text Embedding 004",
      supportedActions: ["embedContent"],
      inputTokenLimit: 2048,
      outputTokenLimit: 2048,
    };
    const norm = normalizeGeminiModel(embed);
    expect(norm.id).toBe("text-embedding-004");
    expect(norm.kind).toBe("embedding");

    const imagen = {
      name: "models/imagen-4",
      displayName: "Imagen 4",
      supportedActions: ["predict"],
      inputTokenLimit: 32768,
      outputTokenLimit: 8192,
    };
    expect(normalizeGeminiModel(imagen).kind).toBe("image");
  });

  it("Groq fixture exposes owned_by for vendor classification", () => {
    const groq = {
      id: "llama-3.3-70b-versatile",
      owned_by: "Meta",
      context_window: 131072,
      active: true,
    };
    const norm = normalizeGroqModel(groq);
    expect(norm.ownedBy).toBe("Meta");
    expect(norm.isActive).toBe(true);
  });
});
