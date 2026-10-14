import { Provider, ModelInfo, ValidationResult, ProviderStreamParams } from "./types";
import { streamOpenAICompatibleChat } from "./streamChat";

export function normalizeGroqModel(m: any): ModelInfo {
  const isReasoning = /deepseek-r1|qwen-2\.5-32b|gpt-oss/i.test(m.id || "") || Boolean(m.supports_reasoning || m.supportsReasoning);
  const isVision = /vision|llava/i.test(m.id || "");

  return {
    provider: "groq",
    id: m.id,
    displayName: m.id,
    description: null,
    contextLength: m.context_window || null,
    maxOutputTokens: null,
    inputModalities: isVision ? ["text", "image"] : ["text"],
    outputModalities: ["text"],
    supportsTools: true,
    supportsReasoning: isReasoning,
    supportsVision: isVision,
    pricing: null,
    isActive: m.active !== false,
    raw: m,
  };
}

export const groqProvider: Provider = {
  id: "groq",
  label: "Groq",
  docsUrl: "https://console.groq.com/",
  keyHelpUrl: "https://console.groq.com/keys",

  async validateKey(key: string): Promise<ValidationResult> {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (response.status === 401 || response.status === 403) {
        return {
          valid: false,
          status: 400,
          code: "KEY_INVALID",
          message: "Invalid Groq API key",
        };
      }
      if (!response.ok) {
        return {
          valid: false,
          status: 502,
          code: "PROVIDER_UNAVAILABLE",
          message: `Groq error (status ${response.status})`,
        };
      }
      return { valid: true };
    } catch {
      return {
        valid: false,
        status: 502,
        code: "PROVIDER_UNAVAILABLE",
        message: "Unable to reach Groq service",
      };
    }
  },

  async listModels(key: string): Promise<ModelInfo[]> {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }
    const data = await response.json();
    return (data.data || []).map(normalizeGroqModel);
  },

  async streamChat(params: ProviderStreamParams): Promise<any> {
    return streamOpenAICompatibleChat({
      ...params,
      provider: "groq",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
    });
  },
};
