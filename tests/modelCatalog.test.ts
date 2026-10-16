import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  CATALOG_PROVIDERS,
  CATALOG_MODELS,
  CATALOG_SNAPSHOT,
  catalogProviderCounts,
  catalogTotals,
  filterCatalogModels,
  getCatalogModel,
  getCatalogModels,
  getCatalogProvider,
  inferKind,
} from "../src/shared/catalog";
import { buildCatalogAppModels, catalogModelToAppModel } from "../src/shared/catalog/appModels";
import { providers } from "../server/lib/providers";
import { mergeCatalogAndLive, bundledModelsFor, catalogModelToModelInfo } from "../server/lib/providers/catalogBridge";

const VALID_KINDS = ["chat", "embedding", "image", "audio", "video", "rerank", "moderation", "other"];
const ISO_DATE = /^\d{4}-\d{2}(-\d{2})?$/;

describe("Bundled model catalog", () => {
  it("ships many providers, each with a complete, detailed model list", () => {
    expect(CATALOG_PROVIDERS.length).toBeGreaterThanOrEqual(10);
    expect(CATALOG_MODELS.length).toBeGreaterThan(300);

    for (const provider of CATALOG_PROVIDERS) {
      expect(provider.modelCount).toBe(provider.models.length);
      expect(provider.models.length).toBeGreaterThan(0);
      expect(provider.label.length).toBeGreaterThan(0);
      expect(provider.vendor.length).toBeGreaterThan(0);
      expect(provider.docsUrl).toMatch(/^https:\/\//);
      expect(provider.keyHelpUrl).toMatch(/^https:\/\//);
      expect(provider.apiBase).toMatch(/^https:\/\//);
      expect(provider.keyEnv).toMatch(/KEY$/);
      expect(["gemini", "openai"]).toContain(provider.apiStyle);
    }
  });

  it("has unique model ids per provider and detailed, decodable entries", () => {
    for (const provider of CATALOG_PROVIDERS) {
      const ids = new Set<string>();
      for (const model of provider.models) {
        expect(ids.has(model.id)).toBe(false);
        ids.add(model.id);

        expect(model.provider).toBe(provider.id);
        expect(model.name.length).toBeGreaterThan(0);
        expect(VALID_KINDS).toContain(model.kind);
        expect(model.source).toBe("bundled");
        expect(model.inputModalities.length).toBeGreaterThan(0);
        expect(model.outputModalities.length).toBeGreaterThan(0);
        expect(model.supportsVision).toBe(model.inputModalities.includes("image"));
        if (model.contextLength !== null) expect(model.contextLength).toBeGreaterThan(0);
        if (model.maxOutputTokens !== null) expect(model.maxOutputTokens).toBeGreaterThan(0);
        if (model.releaseDate) expect(model.releaseDate).toMatch(ISO_DATE);
        if (model.pricing) {
          expect(model.pricing.currency).toBe("USD");
          expect(model.pricing.inputPerMTok).toBeGreaterThanOrEqual(0);
          expect(model.pricing.outputPerMTok).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("keeps pricing, context and capability detail for the flagship chat models", () => {
    const gpt5 = getCatalogModel("openai", "gpt-5");
    expect(gpt5).toBeDefined();
    expect(gpt5!.kind).toBe("chat");
    expect(gpt5!.contextLength).toBeGreaterThanOrEqual(200000);
    expect(gpt5!.supportsTools).toBe(true);
    expect(gpt5!.supportsReasoning).toBe(true);
    expect(gpt5!.pricing?.outputPerMTok).toBeGreaterThan(0);

    const llama = getCatalogModel("groq", "llama-3.3-70b-versatile");
    expect(llama?.contextLength).toBe(131072);
    expect(llama?.supportsTools).toBe(true);

    // Non-chat models are catalogued too, with their own kind.
    const embedding = getCatalogModels("gemini").find((m) => m.kind === "embedding");
    expect(embedding).toBeDefined();
  });

  it("never contains names excluded by the deployment naming policy", () => {
    const forbidden = /(\b(sonnet|opus|haiku)\b)|(anthropic)|(claude)/i;
    const catalogDir = path.resolve(__dirname, "..", "src", "shared", "catalog");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) walk(full);
        else files.push(full);
      }
    };
    walk(catalogDir);

    const violations: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      content.split("\n").forEach((line, index) => {
        if (forbidden.test(line)) violations.push(`${path.relative(catalogDir, file)}:${index + 1}`);
      });
    }
    expect(violations).toEqual([]);

    for (const model of CATALOG_MODELS) {
      expect(forbidden.test(`${model.id} ${model.name}`)).toBe(false);
    }
  });

  it("covers every provider registered on the server with a bundled catalog", () => {
    const registered = Object.keys(providers);
    expect(registered.length).toBeGreaterThanOrEqual(CATALOG_PROVIDERS.length);
    for (const id of registered) {
      const catalog = getCatalogProvider(id);
      expect(catalog, `provider '${id}' has no bundled catalog`).toBeDefined();
      expect(catalog!.models.length).toBeGreaterThan(0);
    }
    // The original three providers keep their bespoke adapters.
    expect(registered).toContain("gemini");
    expect(registered).toContain("groq");
    expect(registered).toContain("openrouter");
  });

  it("exposes totals, per-provider counts and filters", () => {
    const totals = catalogTotals();
    expect(totals.providers).toBe(CATALOG_PROVIDERS.length);
    expect(totals.models).toBe(CATALOG_MODELS.length);

    const counts = catalogProviderCounts();
    expect(counts).toHaveLength(CATALOG_PROVIDERS.length);
    expect(counts.every((c) => c.modelCount > 0 && c.label.length > 0)).toBe(true);

    const reasoning = filterCatalogModels(CATALOG_MODELS, { capability: "reasoning" });
    expect(reasoning.length).toBeGreaterThan(0);
    expect(reasoning.every((m) => m.supportsReasoning)).toBe(true);

    const openai = filterCatalogModels(CATALOG_MODELS, { provider: "openai" });
    expect(openai.every((m) => m.provider === "openai")).toBe(true);

    const searched = filterCatalogModels(CATALOG_MODELS, { provider: "openai", query: "gpt-5" });
    expect(searched.length).toBeGreaterThan(0);
    expect(searched.every((m) => m.id.includes("gpt-5") || m.name.toLowerCase().includes("gpt-5"))).toBe(true);

    expect(CATALOG_SNAPSHOT.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CATALOG_SNAPSHOT.totalModels).toBe(CATALOG_MODELS.length);
  });

  it("stays in sync with the generator's kind inference", async () => {
    const generator: any = await import("../scripts/generate-model-catalog.mjs");
    expect(typeof generator.inferKind).toBe("function");

    const samples = [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", out: ["text"] },
      { id: "gemini-embedding-001", name: "Gemini Embedding", out: ["text"] },
      { id: "gemini-2.5-flash-image", name: "Gemini Flash Image", out: ["text", "image"] },
      { id: "llama-guard-4-12b", name: "Llama Guard 4", out: ["text"] },
      { id: "whisper-large-v3", name: "Whisper Large v3", out: ["text"] },
      { id: "nvidia/rerank-qa-mistral-4b", name: "Rerank QA", out: ["text"] },
      { id: "gpt-5", name: "GPT-5", out: ["text"] },
    ];

    for (const sample of samples) {
      const fromScript = generator.inferKind({ id: sample.id, name: sample.name, modalities: { output: sample.out } });
      const fromRuntime = inferKind(sample.id, sample.name, sample.out);
      expect(fromRuntime).toBe(fromScript);
    }
  });
});

describe("Catalog-driven app models", () => {
  it("builds a fully populated app model list with exactly one default", () => {
    const rows = buildCatalogAppModels();
    expect(rows.length).toBeGreaterThan(10);

    const slugs = rows.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    const defaults = rows.filter((r) => r.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].slug).toBe("gemini-3-8-flash");

    const catalogRows = rows.filter((r) => r.catalog_source === "bundled");
    expect(catalogRows.length).toBeGreaterThan(0);
    expect(catalogRows.every((r) => r.enabled && r.api_model_id.length > 0)).toBe(true);
    expect(catalogRows.every((r) => r.kind === "chat" || r.kind === "embedding")).toBe(true);
    expect(catalogRows.every((r) => (r.description || "").length > 0)).toBe(true);
    // Catalog rows carry the detail columns used by the settings UI.
    expect(catalogRows.some((r) => Boolean(r.pricing) && Boolean(r.context_length))).toBe(true);
  });

  it("maps a catalog model to an app row without losing detail", () => {
    const model = getCatalogModel("gemini", "gemini-2.5-pro")!;
    const row = catalogModelToAppModel(model, 7);
    expect(row).toMatchObject({
      slug: "gemini-2.5-pro",
      api_model_id: "gemini-2.5-pro",
      provider: "google",
      kind: "chat",
      supports_tools: true,
      supports_thinking: true,
      supports_vision: true,
      context_length: model.contextLength,
      sort_order: 7,
      enabled: true,
      catalog_source: "bundled",
    });
  });
});

describe("Catalog bridge", () => {
  it("converts bundled models into the provider ModelInfo shape", () => {
    const models = bundledModelsFor("groq");
    expect(models.length).toBe(getCatalogModels("groq").length);
    const llama = models.find((m) => m.id === "llama-3.3-70b-versatile")!;
    expect(catalogModelToModelInfo(getCatalogModel("groq", llama.id)!).contextLength).toBe(llama.contextLength);
    expect(llama.provider).toBe("groq");
    expect(llama.kind).toBe("chat");
    expect(llama.pricing?.inputPerMTok).toBeGreaterThan(0);
  });

  it("returns bundled models when a provider has no live catalog", () => {
    const merged = mergeCatalogAndLive("openai", null);
    expect(merged.length).toBe(getCatalogModels("openai").length);
    expect(merged.every((m) => m.source === "bundled")).toBe(true);
  });

  it("prefers live values, keeps bundled detail and appends new live models", () => {
    const live = [
      { ...catalogModelToModelInfo(getCatalogModel("openai", "gpt-5")!), displayName: "GPT-5 (live)", contextLength: 123456 },
      { ...catalogModelToModelInfo(getCatalogModel("openai", "gpt-5")!), id: "gpt-6-preview", displayName: "GPT-6 Preview" },
    ];

    const merged = mergeCatalogAndLive("openai", live);
    const gpt5 = merged.find((m) => m.id === "gpt-5")!;
    expect(gpt5.displayName).toBe("GPT-5 (live)");
    expect(gpt5.contextLength).toBe(123456);
    expect(gpt5.source).toBe("live+bundled");
    expect(gpt5.pricing?.outputPerMTok).toBeGreaterThan(0);
    expect(gpt5.releaseDate).toBeTruthy();

    const gpt6 = merged.find((m) => m.id === "gpt-6-preview")!;
    expect(gpt6.source).toBe("live");

    const ids = merged.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
