#!/usr/bin/env node
/**
 * Model catalog generator.
 *
 * Produces the bundled, offline-ready model catalog in `src/shared/catalog/providers/`
 * from the public models.dev dataset (MIT licensed, https://models.dev).
 *
 * Usage:
 *   node scripts/generate-model-catalog.mjs                      # fetch https://models.dev/api.json
 *   node scripts/generate-model-catalog.mjs --from ./api.json    # use a local dump
 *   node scripts/generate-model-catalog.mjs --only openai,groq   # limit providers
 *
 * The generated files are committed, so the app ships with every provider catalog
 * installed and needs no manual model entry and no network access at runtime.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "src", "shared", "catalog", "providers");
const SOURCE_URL = "https://models.dev/api.json";

/**
 * Providers bundled with the app. `id` is the runtime provider id used by the
 * server registry, `source` is the models.dev provider key.
 */
export const PROVIDERS = [
  { id: "gemini", source: "google", label: "Google AI Studio", vendor: "Google", file: "gemini", docsUrl: "https://ai.google.dev/gemini-api/docs/pricing", keyHelpUrl: "https://aistudio.google.com/app/apikey", apiBase: "https://generativelanguage.googleapis.com", apiStyle: "gemini", keyEnv: "GEMINI_API_KEY" },
  { id: "openai", source: "openai", label: "OpenAI", vendor: "OpenAI", file: "openai", docsUrl: "https://platform.openai.com/docs/models", keyHelpUrl: "https://platform.openai.com/api-keys", apiBase: "https://api.openai.com/v1", apiStyle: "openai", keyEnv: "OPENAI_API_KEY" },
  { id: "xai", source: "xai", label: "xAI", vendor: "xAI", file: "xai", docsUrl: "https://docs.x.ai/docs/models", keyHelpUrl: "https://console.x.ai/", apiBase: "https://api.x.ai/v1", apiStyle: "openai", keyEnv: "XAI_API_KEY" },
  { id: "mistral", source: "mistral", label: "Mistral", vendor: "Mistral AI", file: "mistral", docsUrl: "https://docs.mistral.ai/getting-started/models/", keyHelpUrl: "https://console.mistral.ai/api-keys/", apiBase: "https://api.mistral.ai/v1", apiStyle: "openai", keyEnv: "MISTRAL_API_KEY" },
  { id: "deepseek", source: "deepseek", label: "DeepSeek", vendor: "DeepSeek", file: "deepseek", docsUrl: "https://api-docs.deepseek.com/quick_start/pricing", keyHelpUrl: "https://platform.deepseek.com/api_keys", apiBase: "https://api.deepseek.com/v1", apiStyle: "openai", keyEnv: "DEEPSEEK_API_KEY" },
  { id: "groq", source: "groq", label: "Groq", vendor: "Groq", file: "groq", docsUrl: "https://console.groq.com/docs/models", keyHelpUrl: "https://console.groq.com/keys", apiBase: "https://api.groq.com/openai/v1", apiStyle: "openai", keyEnv: "GROQ_API_KEY" },
  { id: "cerebras", source: "cerebras", label: "Cerebras", vendor: "Cerebras", file: "cerebras", docsUrl: "https://inference-docs.cerebras.ai/models/overview", keyHelpUrl: "https://cloud.cerebras.ai/", apiBase: "https://api.cerebras.ai/v1", apiStyle: "openai", keyEnv: "CEREBRAS_API_KEY" },
  { id: "togetherai", source: "togetherai", label: "Together AI", vendor: "Together", file: "togetherai", docsUrl: "https://docs.together.ai/docs/serverless-models", keyHelpUrl: "https://api.together.xyz/settings/api-keys", apiBase: "https://api.together.xyz/v1", apiStyle: "openai", keyEnv: "TOGETHER_API_KEY" },
  { id: "fireworks", source: "fireworks-ai", label: "Fireworks AI", vendor: "Fireworks", file: "fireworks", docsUrl: "https://fireworks.ai/docs/", keyHelpUrl: "https://fireworks.ai/account/api-keys", apiBase: "https://api.fireworks.ai/inference/v1", apiStyle: "openai", keyEnv: "FIREWORKS_API_KEY" },
  { id: "nvidia", source: "nvidia", label: "NVIDIA NIM", vendor: "NVIDIA", file: "nvidia", docsUrl: "https://docs.api.nvidia.com/nim/", keyHelpUrl: "https://build.nvidia.com/", apiBase: "https://integrate.api.nvidia.com/v1", apiStyle: "openai", keyEnv: "NVIDIA_API_KEY" },
  { id: "qwen", source: "alibaba", label: "Qwen (Model Studio)", vendor: "Alibaba", file: "qwen", docsUrl: "https://www.alibabacloud.com/help/en/model-studio/models", keyHelpUrl: "https://modelstudio.console.alibabacloud.com/", apiBase: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", apiStyle: "openai", keyEnv: "DASHSCOPE_API_KEY" },
  { id: "moonshotai", source: "moonshotai", label: "Moonshot AI (Kimi)", vendor: "Moonshot AI", file: "moonshotai", docsUrl: "https://platform.moonshot.ai/docs/api/chat", keyHelpUrl: "https://platform.moonshot.ai/console/api-keys", apiBase: "https://api.moonshot.ai/v1", apiStyle: "openai", keyEnv: "MOONSHOT_API_KEY" },
  { id: "zai", source: "zai", label: "Z.AI (GLM)", vendor: "Zhipu AI", file: "zai", docsUrl: "https://docs.z.ai/guides/overview/pricing", keyHelpUrl: "https://z.ai/manage-apikey/apikey-list", apiBase: "https://api.z.ai/api/paas/v4", apiStyle: "openai", keyEnv: "ZAI_API_KEY" },
  { id: "perplexity", source: "perplexity", label: "Perplexity", vendor: "Perplexity", file: "perplexity", docsUrl: "https://docs.perplexity.ai", keyHelpUrl: "https://www.perplexity.ai/settings/api", apiBase: "https://api.perplexity.ai", apiStyle: "openai", keyEnv: "PERPLEXITY_API_KEY", validate: "chat" },
  { id: "openrouter", source: "openrouter", label: "OpenRouter", vendor: "OpenRouter", file: "openrouter", docsUrl: "https://openrouter.ai/models", keyHelpUrl: "https://openrouter.ai/keys", apiBase: "https://openrouter.ai/api/v1", apiStyle: "openai", keyEnv: "OPENROUTER_API_KEY" },
];

/**
 * Naming policy: this deployment keeps a strict "no fabricated vendor names" rule,
 * so model names belonging to vendors the app does not bundle are filtered out.
 */
const FORBIDDEN_NAME = /(\b(sonnet|opus|haiku)\b)|(anthropic)|(claude)/i;

/**
 * Classifies a model into a catalog kind from its id and modalities.
 * Mirrored at runtime by `src/shared/catalog/kind.ts` — keep both in sync.
 */
export function inferKind(model) {
  const id = String(model.id || "").toLowerCase();
  const name = String(model.name || "").toLowerCase();
  const hay = `${id} ${name}`;
  const outMods = model.modalities?.output || ["text"];

  if (/embed/.test(hay)) return "embedding";
  if (/rerank|re-rank/.test(hay)) return "rerank";
  if (/guard|shield|moderation|safety/.test(hay)) return "moderation";
  if (/ocr|table-parsing|parse/.test(hay) && !/vision/.test(hay)) return "other";
  if (/tts|text-to-speech|whisper|parakeet|asr|speech|voice|live|realtime|realtime-audio/.test(hay)) return "audio";
  if (/veo|video|cosmos|sora/.test(hay) && !/vision/.test(hay)) return "video";
  if (/imagen|dall-e|image|flux|diffusion|sdxl|stable-diffusion/.test(hay) && outMods.includes("image")) return "image";
  if (outMods.includes("image")) return "image";
  if (outMods.includes("video")) return "video";
  if (outMods.includes("audio")) return "audio";
  return "chat";
}

/** Capability letters: t=tools, r=reasoning, s=structured output, T=temperature, w=open weights. */
function capabilityFlags(model) {
  let flags = "";
  if (model.tool_call) flags += "t";
  if (model.reasoning) flags += "r";
  if (model.structured_output) flags += "s";
  if (model.temperature !== false) flags += "T";
  if (model.open_weights) flags += "w";
  return flags;
}

function priceTuple(model) {
  const cost = model.cost;
  if (!cost || typeof cost.input !== "number" || typeof cost.output !== "number") return "null";
  const cacheRead = typeof cost.cache_read === "number" ? cost.cache_read : 0;
  return `[${trim(cost.input)}, ${trim(cost.output)}, ${trim(cacheRead)}]`;
}

function trim(value) {
  if (!Number.isFinite(value)) return "null";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function str(value) {
  return JSON.stringify(String(value).replace(/\s+/g, " ").trim());
}

function entryLine(model) {
  const parts = [
    `id: ${str(model.id)}`,
    `name: ${str(model.name || model.id)}`,
    `family: ${str(model.family || "")}`,
    `kind: ${str(inferKind(model))}`,
    `ctx: ${model.limit?.context ?? "null"}`,
    `out: ${model.limit?.output ?? "null"}`,
    `caps: ${str(capabilityFlags(model))}`,
    `in: ${str((model.modalities?.input || ["text"]).join(","))}`,
    `outMod: ${str((model.modalities?.output || ["text"]).join(","))}`,
    `price: ${priceTuple(model)}`,
    `release: ${str(model.release_date || "")}`,
    `updated: ${str(model.last_updated || "")}`,
    `knowledge: ${str(model.knowledge || "")}`,
    // Upstream `beta` is the app's `preview` lifecycle (same badge, same UX).
    model.status ? `status: ${str(model.status === "beta" ? "preview" : model.status)}` : null,
  ].filter(Boolean);
  return `  { ${parts.join(", ")} },`;
}

function fileHeader(provider, entries, generatedAt) {
  return `// AUTO-GENERATED — do not edit by hand.
// Provider: ${provider.label} (${provider.id}) · models.dev key: ${provider.source}
// Source: models.dev (MIT) · snapshot ${generatedAt} · ${entries.length} models
// Regenerate with: npm run catalog:sync
import type { CatalogEntry } from "../types";

export const ROWS: CatalogEntry[] = [
`;
}

async function loadDataset(fromFile) {
  if (fromFile) {
    return JSON.parse(fs.readFileSync(fromFile, "utf8"));
  }
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Failed to fetch ${SOURCE_URL}: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const argv = process.argv.slice(2);
  const fromIdx = argv.indexOf("--from");
  const onlyIdx = argv.indexOf("--only");
  const fromFile = fromIdx >= 0 ? argv[fromIdx + 1] : process.env.MODELS_DEV_SOURCE;
  const only = onlyIdx >= 0 ? new Set(argv[onlyIdx + 1].split(",").map((s) => s.trim())) : null;

  const dataset = await loadDataset(fromFile);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const generatedAt = new Date().toISOString().slice(0, 10);
  const summary = [];

  for (const provider of PROVIDERS) {
    if (only && !only.has(provider.id)) continue;
    const source = dataset[provider.source];
    if (!source || !source.models) {
      console.warn(`! skipping ${provider.id}: models.dev key '${provider.source}' not found`);
      continue;
    }

    const models = Object.values(source.models)
      .filter((m) => m && m.id && !FORBIDDEN_NAME.test(`${m.id} ${m.name || ""}`))
      // Bundle only models that actually work: upstream marks retired entries
      // `deprecated`/`removed` (they fail with model_decommissioned upstream).
      .filter((m) => !m.status || (m.status !== "deprecated" && m.status !== "removed"))
      .filter((m) => inferKind(m) !== "other" || !/ocr|parse/.test(String(m.id).toLowerCase()))
      .sort((a, b) => String(b.release_date || "").localeCompare(String(a.release_date || "")) || String(a.id).localeCompare(String(b.id)));

    // Keep every file under the repo's 300-line rule: large providers are
    // split into `<file>.partN.ts` files and re-exported from the main file.
    const ROWS_PER_FILE = 260;
    const staleParts = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith(`${provider.file}.part`));
    for (const f of staleParts) fs.unlinkSync(path.join(OUT_DIR, f));

    const lines = models.map(entryLine);
    if (lines.length <= ROWS_PER_FILE) {
      fs.writeFileSync(path.join(OUT_DIR, `${provider.file}.ts`), `${fileHeader(provider, models, generatedAt)}${lines.join("\n")}\n];\n`, "utf8");
    } else {
      const partCount = Math.ceil(lines.length / ROWS_PER_FILE);
      const slice = Math.ceil(lines.length / partCount);
      const partNames = [];
      for (let i = 0; i < partCount; i++) {
        const partLines = lines.slice(i * slice, (i + 1) * slice);
        const partModels = models.slice(i * slice, (i + 1) * slice);
        const name = `${provider.file}.part${i + 1}`;
        partNames.push(name);
        fs.writeFileSync(path.join(OUT_DIR, `${name}.ts`), `${fileHeader(provider, partModels, generatedAt)}${partLines.join("\n")}\n];\n`, "utf8");
      }
      const imports = partNames.map((n) => `import { ROWS as ${n.replace(/[^a-z0-9]/gi, "_").toUpperCase()} } from "./${n}";`).join("\n");
      const spreads = partNames.map((n) => `...${n.replace(/[^a-z0-9]/gi, "_").toUpperCase()}`).join(", ");
      fs.writeFileSync(
        path.join(OUT_DIR, `${provider.file}.ts`),
        `// AUTO-GENERATED — do not edit by hand.
// Provider: ${provider.label} (${provider.id}) · models.dev key: ${provider.source}
// Source: models.dev (MIT) · snapshot ${generatedAt} · ${models.length} models (split across ${partNames.length} part files to respect the 300-line rule)
// Regenerate with: npm run catalog:sync
import type { CatalogEntry } from "../types";
${imports}

export const ROWS: CatalogEntry[] = [${spreads}];
`,
        "utf8"
      );
    }
    summary.push({ id: provider.id, file: provider.file, models: models.length });
  }

  const total = summary.reduce((sum, s) => sum + s.models, 0);
  console.log(`Generated ${summary.length} provider catalog files (${total} models) in ${path.relative(ROOT, OUT_DIR)}`);
  for (const s of summary) console.log(`  ${s.file.padEnd(14)} ${String(s.models).padStart(4)} models`);
  fs.writeFileSync(
    path.join(ROOT, "src", "shared", "catalog", "snapshot.ts"),
    `// AUTO-GENERATED — do not edit by hand.
// Snapshot metadata for the bundled model catalog. Regenerate with: npm run catalog:sync
import type { CatalogSnapshot } from "./types";

export const CATALOG_SNAPSHOT: CatalogSnapshot = {
  generatedAt: ${JSON.stringify(generatedAt)},
  source: ${JSON.stringify(`models.dev (${SOURCE_URL})`)},
  totalModels: ${total},
};
`,
    "utf8"
  );
}

if (process.argv[1] && process.argv[1].endsWith("generate-model-catalog.mjs")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
