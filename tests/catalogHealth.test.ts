import { beforeEach, describe, expect, it, vi } from "vitest";
import healthRouter from "../server/routes/health";
import { MemoryCatalogStore, setCatalogStore } from "../server/lib/catalog/store";
import { resetCatalogSchemaProbe, startCatalogSchemaProbe } from "../server/lib/catalog/schemaProbe";

function healthHandler() {
  const route = healthRouter.stack.find((layer: any) => layer.route?.path === "/health");
  expect(route).toBeDefined();
  return route!.route.stack[route!.route.stack.length - 1].handle;
}

async function callHealth() {
  let payload: any;
  const res: any = { json: (value: any) => { payload = value; return res; } };
  await healthHandler()({}, res);
  return payload;
}

describe("GET /api/health catalog payload", () => {
  let store: MemoryCatalogStore;

  beforeEach(() => {
    store = new MemoryCatalogStore();
    setCatalogStore(store);
    resetCatalogSchemaProbe();
  });

  it("returns the catalog database state, missing list, and last sync summaries", async () => {
    await store.insertRun({
      provider: "groq",
      trigger: "manual",
      status: "failed",
      started_at: "2026-10-19T10:00:00.000Z",
      finished_at: "2026-10-19T10:00:03.000Z",
      added: 0,
      updated: 0,
      removed: 0,
      total: 0,
      error: "provider timeout",
    });

    const payload = await callHealth();
    expect(payload.catalog).toEqual({
      db: "unreachable",
      missing: [],
      lastSync: [{ provider: "groq", status: "failed", at: "2026-10-19T10:00:03.000Z" }],
    });
  });

  it("surfaces a schema mismatch and the missing table in health", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = {
      from: (table: string) => ({
        select: () => ({
          limit: async () => table === "provider_catalog"
            ? { error: { code: "PGRST205", message: "table missing" } }
            : { data: [], error: null },
        }),
      }),
    };
    await startCatalogSchemaProbe(client);
    const payload = await callHealth();
    expect(payload.catalog).toMatchObject({ db: "schema_mismatch", missing: ["provider_catalog"], lastSync: [] });
    errorSpy.mockRestore();
  });
});
