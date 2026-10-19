import { describe, it, expect, beforeEach } from "vitest";
import catalogRouter from "../server/routes/catalog";
import catalogAdminRouter from "../server/routes/catalogAdmin";
import modelsRouter from "../server/routes/models";
import { MemoryCatalogStore, setCatalogStore } from "../server/lib/catalog/store";
import type { CatalogRecord } from "../server/lib/catalog/types";
import { CATALOG_MODELS, CATALOG_PROVIDERS } from "../src/shared/catalog";

let store: MemoryCatalogStore;

function getHandler(router: any, path: string, method: "get" | "post" | "put") {
  const layer = router.stack.find((l: any) => l.route?.path === path && l.route.methods[method]);
  expect(layer, `route ${method.toUpperCase()} ${path} is not registered`).toBeDefined();
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

async function callRoute(handler: any, req: any = {}) {
  let payload: any = null;
  let status = 200;
  const res: any = {
    json: (data: any) => {
      payload = data;
      return res;
    },
    status: (code: number) => {
      status = code;
      return res;
    },
  };
  await handler({ ...req, query: req.query || {}, body: req.body || {} }, res);
  return { payload, status };
}

function record(overrides: Partial<CatalogRecord>): CatalogRecord {
  return {
    provider: "groq",
    model_id: "model-1",
    name: "Model One",
    description: null,
    vendor: "Meta",
    family: "Llama 3.3",
    kind: "chat",
    status: "active",
    context_length: 131072,
    max_output_tokens: null,
    input_modalities: ["text"],
    output_modalities: ["text"],
    supports_tools: true,
    supports_vision: false,
    supports_reasoning: false,
    supports_json: false,
    is_free: false,
    is_recommended: false,
    pricing: { inputPerMTok: 0.5, outputPerMTok: 0.8, currency: "USD" },
    released_at: "2025-01-01",
    source: "groq-key",
    first_seen_at: "2026-10-01T00:00:00.000Z",
    last_seen_at: "2026-10-01T00:00:00.000Z",
    last_synced_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  store = new MemoryCatalogStore();
  setCatalogStore(store);
});

describe("GET /api/catalog", () => {
  it("serves the bundled snapshot when the synced catalog is empty", async () => {
    const handler = getHandler(catalogRouter, "/", "get");
    const { payload } = await callRoute(handler, { user: { id: "u1" }, query: { all: "1" } });

    expect(payload.source).toBe("bundled");
    expect(payload.models.length).toBe(CATALOG_MODELS.length);
    // Every registered provider is syncable: the three builtins first, then
    // the rest through whatever user key is connected (no server secrets).
    expect(payload.syncable.slice(0, 3)).toEqual(["openrouter", "gemini", "groq"]);
    expect(payload.syncable).toContain("openai");
    expect(payload.syncable.length).toBeGreaterThan(3);
    expect(payload.providers.length).toBeGreaterThanOrEqual(CATALOG_PROVIDERS.length);
    expect(payload.nextCursor).toBeNull();
    expect(payload.sync.stale).toBe(true);
  });

  it("serves synced rows with connected flags, prefs and overrides merged", async () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await store.upsert([
      record({ provider: "gemini", model_id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", vendor: "google", family: "Gemini 3.8 Flash", is_recommended: true, last_seen_at: recent, last_synced_at: recent }),
      record({ provider: "groq", model_id: "llama-3.3-70b", name: "Llama 3.3 70B" }),
    ]);
    const handler = getHandler(catalogRouter, "/", "get");
    const { payload } = await callRoute(handler, {
      user: { id: "u1" },
      query: { all: "1" },
    });

    expect(payload.source).toBe("catalog");
    expect(payload.models.length).toBeGreaterThan(CATALOG_MODELS.length);
    expect(new Set(payload.models.map((m: any) => `${m.provider}:${m.model_id}`)).size).toBe(payload.models.length);
    const gemini = payload.models.find((m: any) => m.model_id === "gemini-3.8-flash");
    expect(gemini.connected).toBe(false);
    expect(gemini.requires_key).toBe(true);
    expect(gemini.recommended).toBe(true);
    expect(gemini.source).toBe("groq-key");
    expect(payload.sync.newest).toBe(recent);
    expect(payload.sync.stale).toBe(false);
  });

  it("applies server-side filters, sorting and cursor pagination", async () => {
    const rows: CatalogRecord[] = [];
    for (let i = 0; i < 7; i++) {
      rows.push(
        record({
          provider: i % 2 === 0 ? "unit-a" : "unit-b",
          model_id: `m-${i}`,
          name: `Model ${i}`,
          vendor: "Synthetic",
          kind: i === 3 ? "embedding" : "chat",
          context_length: 8192 * (i + 1),
          released_at: `2025-01-0${i + 1}`,
          is_free: i === 5,
          supports_reasoning: i >= 4,
        })
      );
    }
    await store.upsert(rows);
    const handler = getHandler(catalogRouter, "/", "get");

    const byProvider = await callRoute(handler, { query: { provider: "unit-a", all: "1" } });
    expect(byProvider.payload.models.every((m: any) => m.provider === "unit-a")).toBe(true);
    expect(byProvider.payload.models.length).toBe(4);

    const byKind = await callRoute(handler, { query: { vendor: "Synthetic", kind: "embedding", all: "1" } });
    expect(byKind.payload.models.length).toBe(1);
    expect(byKind.payload.models[0].kind).toBe("embedding");

    const byCapability = await callRoute(handler, { query: { vendor: "Synthetic", capability: "reasoning", all: "1" } });
    expect(byCapability.payload.models.every((m: any) => m.supports_reasoning)).toBe(true);
    expect(byCapability.payload.models.length).toBe(3);

    const freeOnly = await callRoute(handler, { query: { vendor: "Synthetic", free: "1", all: "1" } });
    expect(freeOnly.payload.models.length).toBe(1);
    expect(freeOnly.payload.models[0].is_free).toBe(true);

    const byQuery = await callRoute(handler, { query: { q: "Model 6", vendor: "Synthetic" } });
    expect(byQuery.payload.total).toBe(1);

    const newest = await callRoute(handler, { query: { vendor: "Synthetic", sort: "newest", all: "1" } });
    expect(newest.payload.models[0].model_id).toBe("m-6");

    const oldest = await callRoute(handler, { query: { vendor: "Synthetic", sort: "context", all: "1" } });
    expect(oldest.payload.models[0].model_id).toBe("m-6");

    const page1 = await callRoute(handler, { query: { vendor: "Synthetic", limit: "3" } });
    expect(page1.payload.models.length).toBe(3);
    expect(page1.payload.total).toBe(7);
    expect(page1.payload.nextCursor).toBeTruthy();
    const page2 = await callRoute(handler, { query: { vendor: "Synthetic", limit: "3", cursor: page1.payload.nextCursor } });
    expect(page2.payload.models.length).toBe(3);
    const ids1 = page1.payload.models.map((m: any) => m.model_id);
    const ids2 = page2.payload.models.map((m: any) => m.model_id);
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false);
  });

  it("excludes hidden models for non-admins and applies admin aliases", async () => {
    await store.upsert([
      record({ model_id: "visible-1", name: "Visible One" }),
      record({ model_id: "hidden-1", name: "Hidden One" }),
      record({ model_id: "aliased-1", name: "Aliased One" }),
    ]);
    await store.saveOverride({ provider: "groq", model_id: "hidden-1", hidden: true, force_recommended: false, alias: null });
    await store.saveOverride({ provider: "groq", model_id: "aliased-1", hidden: false, force_recommended: true, alias: "Friendly Name" });

    const handler = getHandler(catalogRouter, "/", "get");

    // No user id -> not an admin in this environment.
    const asUser = await callRoute(handler, { user: { id: "" }, query: { all: "1" } });
    expect(asUser.payload.is_admin).toBe(false);
    expect(asUser.payload.models.map((m: any) => m.model_id)).not.toContain("hidden-1");
    const aliased = asUser.payload.models.find((m: any) => m.model_id === "aliased-1");
    expect(aliased.alias).toBe("Friendly Name");
    expect(aliased.display_name).toBe("Friendly Name");
    expect(aliased.recommended).toBe(true); // force_recommended wins

    const asAdmin = await callRoute(handler, { user: { id: "admin-1" }, query: { all: "1" } });
    expect(asAdmin.payload.is_admin).toBe(true);
    const hidden = asAdmin.payload.models.find((m: any) => m.model_id === "hidden-1");
    expect(hidden).toBeTruthy();
    expect(hidden.hidden).toBe(true);
  });
});

describe("GET /api/catalog/facets", () => {
  it("returns counts by provider, vendor, family, kind, capability and status", async () => {
    await store.upsert([
      record({ provider: "unit-facets", model_id: "a", vendor: "Unit Vendor", family: "Unit Family", supports_reasoning: true, status: "active" }),
      record({ provider: "unit-facets", model_id: "b", vendor: "Unit Vendor", family: "Unit Family", status: "preview", context_length: 1000000 }),
      record({ provider: "unit-facets", model_id: "c", vendor: "Unit Vendor", family: "Unit Family", kind: "embedding", supports_tools: false }),
      record({ provider: "unit-facets", model_id: "d", vendor: "Unit Vendor", family: "Unit Family", status: "deprecated" }),
    ]);
    const handler = getHandler(catalogRouter, "/facets", "get");
    const { payload } = await callRoute(handler, { user: { id: "u1" } });

    expect(payload.total).toBeGreaterThan(CATALOG_MODELS.length);
    expect(payload.facets.provider["unit-facets"]).toBe(4);
    expect(payload.facets.vendor["Unit Vendor"]).toBe(4);
    expect(payload.facets.family["Unit Family"]).toBe(4);
    expect(payload.facets.kind.embedding).toBeGreaterThan(0);
    expect(payload.facets.status.preview).toBeGreaterThan(0);
    expect(payload.facets.status.deprecated).toBeGreaterThan(0);
    expect(payload.providers.find((p: any) => p.id === "unit-facets").connected).toBe(false);
  });
});

describe("Admin catalog routes", () => {
  it("registers sync and override routes and rejects non-admins", async () => {
    const paths = catalogAdminRouter.stack
      .filter((l: any) => l.route)
      .map((l: any) => `${Object.keys(l.route.methods)[0]}:${l.route.path}`);
    expect(paths).toContain("post:/sync");
    expect(paths).toContain("put:/overrides");

    const sync = getHandler(catalogAdminRouter, "/sync", "post");
    const denied = await callRoute(sync, { user: { id: "" }, body: { provider: "groq" } });
    expect(denied.status).toBe(403);

    const putOverride = getHandler(catalogAdminRouter, "/overrides", "put");
    const deniedOverride = await callRoute(putOverride, { user: { id: "" }, body: { provider: "groq", model_id: "a", hidden: true } });
    expect(deniedOverride.status).toBe(403);
  });

  it("stores admin overrides through PUT /overrides", async () => {
    const putOverride = getHandler(catalogAdminRouter, "/overrides", "put");
    const { payload, status } = await callRoute(putOverride, {
      user: { id: "admin-1" },
      body: { provider: "groq", model_id: "a", hidden: true, force_recommended: true, alias: "Nick" },
    });
    expect(status).toBe(200);
    expect(payload.override).toMatchObject({ hidden: true, force_recommended: true, alias: "Nick" });

    const overrides = await store.getOverrides();
    expect(overrides).toHaveLength(1);

    const runsHandler = getHandler(catalogRouter, "/sync-runs", "get");
    const denied = await callRoute(runsHandler, { user: { id: "" } });
    expect(denied.status).toBe(403);
  });
});

describe("Manual model routes", () => {
  it("keeps GET /api/models read-only: no POST/PATCH/DELETE or discover", () => {
    const paths = modelsRouter.stack
      .filter((l: any) => l.route)
      .map((l: any) => `${Object.keys(l.route.methods)[0]}:${l.route.path}`);
    expect(paths).toContain("get:/");
    expect(paths).not.toContain("post:/");
    expect(paths).not.toContain("patch/:id");
    expect(paths).not.toContain("delete/:id");
    expect(paths).not.toContain("get:/discover");
    expect(paths.every((p: string) => p.startsWith("get:"))).toBe(true);
  });
});
