import { Provider, ModelInfo, ValidationResult, ProviderStreamParams } from "./types";
import { GoogleGenAI } from "@google/genai";

export function normalizeGeminiModel(m: any): ModelInfo {
  const rawId = m.name || "";
  const id = rawId.replace(/^models\//, "");
  const actions: string[] = m.supportedActions || m.supportedGenerationMethods || [];

  const supportsGen = actions.length === 0 || actions.includes("generateContent") || /gemini/i.test(id);
  const supportsTools = actions.includes("functionCalling") || actions.includes("tools") || /gemini/i.test(id);
  const isReasoning = /gemini-3/i.test(id) || /gemini-2\.5/i.test(id) || /thinking/i.test(id);
  const displayName = m.displayName || id;

  // Embedding: name contains "embed" or the only generation method is embedContent.
  const kind =
    (actions.length > 0 && actions.every((a) => a === "embedContent")) ||
    /embed/i.test(id) ||
    /embed/i.test(displayName)
      ? "embedding"
      : /imagen|diffusion/.test(id) || /imagen/.test(displayName)
        ? "image"
        : /tts|whisper|transcribe/.test(id)
          ? "audio"
          : "chat";

  return {
    provider: "gemini",
    id,
    displayName,
    description: m.description || null,
    contextLength: m.inputTokenLimit || null,
    maxOutputTokens: m.outputTokenLimit || null,
    inputModalities: ["text", "image"],
    outputModalities: ["text"],
    supportsTools,
    supportsReasoning: isReasoning,
    supportsVision: supportsGen,
    supportsJson: supportsGen,
    pricing: null,
    isActive: true,
    kind,
    raw: m,
  };
}

export const geminiProvider: Provider = {
  id: "gemini",
  label: "Google AI Studio",
  docsUrl: "https://aistudio.google.com/",
  keyHelpUrl: "https://aistudio.google.com/app/apikey",

  async validateKey(key: string): Promise<ValidationResult> {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      // Request list with small page to verify credentials
      const pager = await ai.models.list({ config: { pageSize: 1 } });
      // Fetch at least one item from pager
      for await (const _item of pager) {
        break;
      }
      return { valid: true };
    } catch (err: any) {
      const msg = err?.message || String(err);
      const status = err?.status || err?.statusCode;
      if (status === 401 || status === 403 || /api.?key.*invalid|permission_denied/i.test(msg)) {
        return {
          valid: false,
          status: 400,
          code: "KEY_INVALID",
          message: "The provided Google AI Studio API key is invalid",
        };
      }
      return {
        valid: false,
        status: 502,
        code: "PROVIDER_UNAVAILABLE",
        message: "Unable to reach Google AI Studio service",
      };
    }
  },

  async listModels(key: string): Promise<ModelInfo[]> {
    const ai = new GoogleGenAI({ apiKey: key });
    const pager = await ai.models.list();
    const models: ModelInfo[] = [];

    // Iterate through SDK pager with for-await
    for await (const m of pager) {
      const actions: string[] = (m as any).supportedActions || (m as any).supportedGenerationMethods || [];
      if (actions.length === 0 || actions.includes("generateContent") || /gemini/i.test(m.name || "")) {
        models.push(normalizeGeminiModel(m));
      }
    }

    return models;
  },

  async streamChat(_params: ProviderStreamParams): Promise<any> {
    // Handled in chat route through startGeminiStream
    return null;
  },
};
