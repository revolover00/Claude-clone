import { describe, it, expect } from "vitest";
import { familyOf, kindOf, releasedAtOf, statusOf, stripVersionSuffix, vendorOf } from "../server/lib/catalog/classify";

describe("vendor classification", () => {
  it("uses the OpenRouter id prefix before the slash", () => {
    expect(vendorOf("openrouter", "mistralai/devstral-2")).toBe("mistralai");
    expect(vendorOf("openrouter", "qwen/qwen3-coder")).toBe("qwen");
    expect(vendorOf("openrouter", "grok-4")).toBe("xAI"); // inferVendorFromId fallback
  });

  it("maps Gemini to google and Groq to owned_by", () => {
    expect(vendorOf("gemini", "gemini-3.8-flash")).toBe("google");
    expect(vendorOf("groq", "llama-3.3-70b-versatile", "Meta")).toBe("Meta");
    expect(vendorOf("groq", "deepseek-r1-distill-llama-70b")).toBe("DeepSeek");
    expect(vendorOf("groq", "llama-3.1-8b-instant")).toBe("Meta");
  });
});

describe("family classification", () => {
  it("groups Gemini 3.x Flash / Pro / Flash-Lite", () => {
    expect(familyOf("gemini", "gemini-3.8-flash", "Gemini 3.8 Flash")).toBe("Gemini 3.8 Flash");
    expect(familyOf("gemini", "gemini-3.1-flash", "Gemini 3.1 Flash")).toBe("Gemini 3.1 Flash");
    expect(familyOf("gemini", "gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite")).toBe("Gemini 3.1 Flash-Lite");
    expect(familyOf("gemini", "gemini-3.1-pro-preview", "Gemini 3.1 Pro (Preview)")).toBe("Gemini 3.1 Pro");
    expect(familyOf("gemini", "gemini-2.5-flash", "Gemini 2.5 Flash")).toBe("Gemini 2.5 Flash");
  });

  it("groups Gemma, Llama 4 / 3.x, GPT-OSS, DeepSeek R1 / V3, Qwen and Mistral", () => {
    expect(familyOf("groq", "gemma-3n-e4b-it", "Gemma 3n")).toBe("Gemma 3");
    expect(familyOf("groq", "llama-4-scout-17b-16e-instruct", "Llama 4 Scout")).toBe("Llama 4");
    expect(familyOf("groq", "llama-3.3-70b-versatile", "Llama 3.3 70B")).toBe("Llama 3.3");
    expect(familyOf("groq", "groq-oss-120b", "GPT OSS 120B")).toBe("GPT-OSS");
    expect(familyOf("groq", "deepseek-r1-distill-llama-70b", "DeepSeek R1")).toBe("DeepSeek R1");
    expect(familyOf("openrouter", "deepseek/deepseek-v3-0324", "DeepSeek V3 0324")).toBe("DeepSeek V3");
    expect(familyOf("groq", "qwen3-32b", "Qwen 3 32B")).toBe("Qwen 3");
    expect(familyOf("groq", "mixtral-8x7b-32768", "Mixtral 8x7B")).toBe("Mistral");
  });

  it("falls back to the display name without the version suffix", () => {
    expect(familyOf("openrouter", "cohere/command-r-08-2024", "Command R 08-2024")).toBe("Command R");
    expect(stripVersionSuffix("Command R+")).toBe("Command R+");
    expect(stripVersionSuffix("Nemotron 49B")).toBe("Nemotron");
  });
});

describe("kind classification", () => {
  it("detects embeddings by name or embedContent-only generation", () => {
    expect(kindOf({ name: "Gemini Embedding 001", model_id: "gemini-embedding-001", output_modalities: ["text"], generation_methods: ["generateContent"] })).toBe("embedding");
    expect(kindOf({ name: "text-embedding-004", model_id: "text-embedding-004", output_modalities: ["text"] })).toBe("embedding");
    expect(kindOf({ name: "Universal Embedder", model_id: "universal-embedder", output_modalities: ["text"], generation_methods: ["embedContent"] })).toBe("embedding");
  });

  it("detects image/audio/video from output modalities or names", () => {
    expect(kindOf({ name: "Gemini Flash Image", model_id: "gemini-2.5-flash-image", output_modalities: ["image"] })).toBe("image");
    expect(kindOf({ name: "Imagen 4", model_id: "imagen-4", output_modalities: ["text"] })).toBe("image");
    expect(kindOf({ name: "Whisper Large v3", model_id: "whisper-large-v3", output_modalities: ["text"] })).toBe("audio");
    expect(kindOf({ name: "TTS Model", model_id: "tts-1", output_modalities: ["audio"] })).toBe("audio");
    expect(kindOf({ name: "Veo 3 Video", model_id: "veo-3", output_modalities: ["video"] })).toBe("video");
  });

  it("detects moderation for guard/moderation models and defaults to chat", () => {
    expect(kindOf({ name: "Llama Guard 4", model_id: "llama-guard-4", output_modalities: ["text"] })).toBe("moderation");
    expect(kindOf({ name: "Content Moderation", model_id: "moderation-latest", output_modalities: ["text"] })).toBe("moderation");
    expect(kindOf({ name: "Gemini 3.8 Flash", model_id: "gemini-3.8-flash", output_modalities: ["text"] })).toBe("chat");
  });
});

describe("status classification", () => {
  it("marks preview when the id or name contains preview/beta/exp", () => {
    expect(statusOf({ name: "GPT 5 Preview", model_id: "openai/gpt-5-preview" })).toBe("preview");
    expect(statusOf({ name: "Some Beta Model", model_id: "some-beta-model" })).toBe("preview");
    expect(statusOf({ name: "Gemini Experimental", model_id: "gemini-pro-exp" })).toBe("preview");
    expect(statusOf({ name: "Stable Model", model_id: "stable-model-1" })).toBe("active");
  });

  it("marks deprecated when the API reports an expiration date or a known deprecation", () => {
    expect(statusOf({ name: "Old Model", model_id: "old-model", expires_at: "2026-01-01" })).toBe("deprecated");
    expect(statusOf({ name: "GPT 3.5 Turbo", model_id: "gpt-3.5-turbo" })).toBe("deprecated");
    expect(statusOf({ name: "Legacy PaLM", model_id: "palm-001" })).toBe("deprecated");
  });
});

describe("released_at", () => {
  it("converts the OpenRouter created unix seconds to an ISO date", () => {
    const iso = releasedAtOf("openrouter", {
      name: "Any",
      model_id: "vendor/any",
      raw: { created: 1735689600 }, // 2025-01-01T00:00:00Z
    });
    expect(iso).toBe("2025-01-01");

    expect(releasedAtOf("openrouter", { name: "Any", model_id: "vendor/any", raw: {} })).toBeNull();
    expect(releasedAtOf("gemini", { name: "Any", model_id: "gemini-3.8-flash", released_at: "2026-06-01" })).toBe("2026-06-01");
  });
});
