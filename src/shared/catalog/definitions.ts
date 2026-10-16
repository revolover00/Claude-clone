import type { CatalogEntry, CatalogProvider, CatalogProviderDefinition } from "./types";
import { decodeEntry } from "./decode";

import { ROWS as GEMINI_ROWS } from "./providers/gemini";
import { ROWS as OPENAI_ROWS } from "./providers/openai";
import { ROWS as XAI_ROWS } from "./providers/xai";
import { ROWS as MISTRAL_ROWS } from "./providers/mistral";
import { ROWS as DEEPSEEK_ROWS } from "./providers/deepseek";
import { ROWS as GROQ_ROWS } from "./providers/groq";
import { ROWS as CEREBRAS_ROWS } from "./providers/cerebras";
import { ROWS as TOGETHER_ROWS } from "./providers/togetherai";
import { ROWS as FIREWORKS_ROWS } from "./providers/fireworks";
import { ROWS as NVIDIA_ROWS } from "./providers/nvidia";
import { ROWS as QWEN_ROWS } from "./providers/qwen";
import { ROWS as MOONSHOT_ROWS } from "./providers/moonshotai";
import { ROWS as ZAI_ROWS } from "./providers/zai";
import { ROWS as PERPLEXITY_ROWS } from "./providers/perplexity";
import { ROWS as OPENROUTER_ROWS } from "./providers/openrouter";

/**
 * Provider definitions bundled with the app.
 *
 * Tuple order: [id, label, vendor, sourceId, docsUrl, keyHelpUrl, apiBase, apiStyle, keyEnv, validate?]
 */
type DefinitionTuple = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  "gemini" | "openai",
  string,
  ("models" | "chat")?,
];

const DEFINITIONS: DefinitionTuple[] = [
  ["gemini", "Google AI Studio", "Google", "google", "https://ai.google.dev/gemini-api/docs/pricing", "https://aistudio.google.com/app/apikey", "https://generativelanguage.googleapis.com", "gemini", "GEMINI_API_KEY"],
  ["openai", "OpenAI", "OpenAI", "openai", "https://platform.openai.com/docs/models", "https://platform.openai.com/api-keys", "https://api.openai.com/v1", "openai", "OPENAI_API_KEY"],
  ["xai", "xAI", "xAI", "xai", "https://docs.x.ai/docs/models", "https://console.x.ai/", "https://api.x.ai/v1", "openai", "XAI_API_KEY"],
  ["mistral", "Mistral", "Mistral AI", "mistral", "https://docs.mistral.ai/getting-started/models/", "https://console.mistral.ai/api-keys/", "https://api.mistral.ai/v1", "openai", "MISTRAL_API_KEY"],
  ["deepseek", "DeepSeek", "DeepSeek", "deepseek", "https://api-docs.deepseek.com/quick_start/pricing", "https://platform.deepseek.com/api_keys", "https://api.deepseek.com/v1", "openai", "DEEPSEEK_API_KEY"],
  ["groq", "Groq", "Groq", "groq", "https://console.groq.com/docs/models", "https://console.groq.com/keys", "https://api.groq.com/openai/v1", "openai", "GROQ_API_KEY"],
  ["cerebras", "Cerebras", "Cerebras", "cerebras", "https://inference-docs.cerebras.ai/models/overview", "https://cloud.cerebras.ai/", "https://api.cerebras.ai/v1", "openai", "CEREBRAS_API_KEY"],
  ["togetherai", "Together AI", "Together", "togetherai", "https://docs.together.ai/docs/serverless-models", "https://api.together.xyz/settings/api-keys", "https://api.together.xyz/v1", "openai", "TOGETHER_API_KEY"],
  ["fireworks", "Fireworks AI", "Fireworks", "fireworks-ai", "https://fireworks.ai/docs/", "https://fireworks.ai/account/api-keys", "https://api.fireworks.ai/inference/v1", "openai", "FIREWORKS_API_KEY"],
  ["nvidia", "NVIDIA NIM", "NVIDIA", "nvidia", "https://docs.api.nvidia.com/nim/", "https://build.nvidia.com/", "https://integrate.api.nvidia.com/v1", "openai", "NVIDIA_API_KEY"],
  ["qwen", "Qwen (Model Studio)", "Alibaba", "alibaba", "https://www.alibabacloud.com/help/en/model-studio/models", "https://modelstudio.console.alibabacloud.com/", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", "openai", "DASHSCOPE_API_KEY"],
  ["moonshotai", "Moonshot AI (Kimi)", "Moonshot AI", "moonshotai", "https://platform.moonshot.ai/docs/api/chat", "https://platform.moonshot.ai/console/api-keys", "https://api.moonshot.ai/v1", "openai", "MOONSHOT_API_KEY"],
  ["zai", "Z.AI (GLM)", "Zhipu AI", "zai", "https://docs.z.ai/guides/overview/pricing", "https://z.ai/manage-apikey/apikey-list", "https://api.z.ai/api/paas/v4", "openai", "ZAI_API_KEY"],
  ["perplexity", "Perplexity", "Perplexity", "perplexity", "https://docs.perplexity.ai", "https://www.perplexity.ai/settings/api", "https://api.perplexity.ai", "openai", "PERPLEXITY_API_KEY", "chat"],
  ["openrouter", "OpenRouter", "OpenRouter", "openrouter", "https://openrouter.ai/models", "https://openrouter.ai/keys", "https://openrouter.ai/api/v1", "openai", "OPENROUTER_API_KEY"],
];

const ROWS_BY_ID: Record<string, CatalogEntry[]> = {
  gemini: GEMINI_ROWS,
  openai: OPENAI_ROWS,
  xai: XAI_ROWS,
  mistral: MISTRAL_ROWS,
  deepseek: DEEPSEEK_ROWS,
  groq: GROQ_ROWS,
  cerebras: CEREBRAS_ROWS,
  togetherai: TOGETHER_ROWS,
  fireworks: FIREWORKS_ROWS,
  nvidia: NVIDIA_ROWS,
  qwen: QWEN_ROWS,
  moonshotai: MOONSHOT_ROWS,
  zai: ZAI_ROWS,
  perplexity: PERPLEXITY_ROWS,
  openrouter: OPENROUTER_ROWS,
};

export function buildCatalogProviders(): CatalogProvider[] {
  return DEFINITIONS.map((tuple): CatalogProviderDefinition => {
    const [id, label, vendor, sourceId, docsUrl, keyHelpUrl, apiBase, apiStyle, keyEnv, validate] = tuple;
    return { id, label, vendor, sourceId, docsUrl, keyHelpUrl, apiBase, apiStyle, keyEnv, validate };
  }).map((def): CatalogProvider => {
    const rows = ROWS_BY_ID[def.id] || [];
    const models = rows.map((row) => decodeEntry(def.id, row));
    return { ...def, models, modelCount: models.length };
  });
}
