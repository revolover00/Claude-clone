import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock `@supabase/supabase-js` at the top level to guarantee no external connections are attempted
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => null,
}));

import { getModelsFromDB, invalidateModelCache } from "../server/lib/modelsStore";
import { MemoryCatalogStore, setCatalogStore } from "../server/lib/catalog/store";
import { refreshRecommendations } from "../server/lib/catalog/recommend";
import { FALLBACK_MODELS } from "../src/shared/fallbackModels";
import type { CatalogRecord } from "../server/lib/catalog/types";

function catalogRecord(overrides: Partial<CatalogRecord>): CatalogRecord {
  return {
    provider: "gemini",
    model_id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    description: null,
    vendor: "google",
    family: "Gemini 3.8 Flash",
    kind: "chat",
    status: "active",
    context_length: 1000000,
    max_output_tokens: 65536,
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    supports_tools: true,
    supports_vision: true,
    supports_reasoning: true,
    supports_json: true,
    is_free: false,
    is_recommended: false,
    pricing: null,
    released_at: "2026-06-01",
    source: "app-key",
    first_seen_at: "2026-10-01T00:00:00.000Z",
    last_seen_at: "2026-10-01T00:00:00.000Z",
    last_synced_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

let store: MemoryCatalogStore;

describe("App models derived from provider_catalog", () => {
  beforeEach(() => {
    store = new MemoryCatalogStore();
    setCatalogStore(store);
    invalidateModelCache();
    localStorage.clear();
  });

  it("falls back to the shared fallback list when catalog and live fetch both fail", async () => {
    // Empty catalog, no GEMINI_API_KEY -> live fetch impossible -> fallback.
    const models = await getModelsFromDB(false);

    expect(models.length).toBe(FALLBACK_MODELS.length);
    const defaults = models.filter((m) => m.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].slug).toBe("gemini-3-8-flash");
    expect(models.every((m) => m.enabled)).toBe(true);
  });

  it("derives chat rows from provider_catalog with canonical ids and one default", async () => {
    await store.upsert([
      catalogRecord({ model_id: "gemini-3.8-flash", family: "Gemini 3.8 Flash", is_recommended: true }),
      catalogRecord({ model_id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite", family: "Gemini 3.1 Flash-Lite", released_at: "2026-03-01" }),
      catalogRecord({ model_id: "gemma-3n", name: "Gemma 3n", family: "Gemma 3", status: "preview" }),
      catalogRecord({ model_id: "text-embedding-004", name: "Gemini Embedding", kind: "embedding" }),
      catalogRecord({ model_id: "retired-model", status: "removed" }),
    ]);
    await refreshRecommendations(store, "gemini");
    invalidateModelCache();

    const models = await getModelsFromDB(true);
    const slugs = models.map((m) => m.slug);
    // Chat + preview only: embeddings and removed models are excluded.
    expect(slugs).toContain("gemini-3.8-flash");
    expect(slugs).toContain("gemma-3n");
    expect(slugs).not.toContain("text-embedding-004");
    expect(slugs).not.toContain("retired-model");

    expect(models.every((m) => m.id === `gemini:${m.api_model_id}`)).toBe(true);
    expect(models.every((m) => m.provider === "google")).toBe(true);
    expect(models.every((m) => m.catalog_source === "catalog")).toBe(true);

    const defaults = models.filter((m) => m.is_default);
    expect(defaults).toHaveLength(1);
    // Best recommended Gemini Flash model wins the default.
    expect(defaults[0].api_model_id).toBe("gemini-3.8-flash");
  });

  it("lets an admin default via catalog_overrides.is_default win", async () => {
    await store.upsert([
      catalogRecord({ model_id: "gemini-3.8-flash" }),
      catalogRecord({ model_id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite" }),
    ]);
    await store.saveOverride({ provider: "gemini", model_id: "gemini-3.1-flash-lite", hidden: false, force_recommended: false, alias: null, is_default: true });
    invalidateModelCache();

    const models = await getModelsFromDB(true);
    const defaults = models.filter((m) => m.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].api_model_id).toBe("gemini-3.1-flash-lite");
  });

  it("caches the derived list until invalidated", async () => {
    await store.upsert([catalogRecord({ model_id: "gemini-3.8-flash" })]);
    invalidateModelCache();

    const first = await getModelsFromDB(false);
    expect(first[0].slug).toBe("gemini-3.8-flash");

    // A second call inside the cache window returns the same array.
    const second = await getModelsFromDB(false);
    expect(second).toBe(first);

    // Simulate the catalog being emptied, then invalidate.
    store.reset();
    const stillCached = await getModelsFromDB(false);
    expect(stillCached).toBe(first);

    invalidateModelCache();
    const fresh = await getModelsFromDB(false);
    expect(fresh).not.toBe(first);
    expect(fresh).toHaveLength(FALLBACK_MODELS.length);
  });

  it("maps legacy stored slugs onto canonical provider:modelId ids", async () => {
    const models = await getModelsFromDB(true);
    const fallback = models.find((m) => m.slug === "gemini-3-8-flash");
    expect(fallback).toBeTruthy();
    // The legacy row still resolves through api_model_id for the chat route.
    expect(fallback!.api_model_id).toBe("gemini-3.8-flash");
  });
});
