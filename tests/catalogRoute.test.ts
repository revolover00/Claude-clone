import { describe, it, expect } from "vitest";
import catalogRouter from "../server/routes/catalog";
import modelsRouter from "../server/routes/models";
import { CATALOG_PROVIDERS, CATALOG_MODELS } from "../src/shared/catalog";

function getHandler(router: any, path: string, method: "get" | "post") {
  const layer = router.stack.find((l: any) => l.route?.path === path && l.route.methods[method]);
  expect(layer, `route ${method.toUpperCase()} ${path} is not registered`).toBeDefined();
  // The last handler in the stack is the route itself (auth middleware runs first).
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
  await handler({ ...req, query: req.query || {} }, res);
  return { payload, status };
}

describe("GET /api/catalog", () => {
  it("returns every bundled provider with all of its models and details", async () => {
    const handler = getHandler(catalogRouter, "/", "get");
    const { payload } = await callRoute(handler, { user: { id: "catalog-user" } });

    expect(payload.providers).toHaveLength(CATALOG_PROVIDERS.length);
    expect(payload.totals.models).toBe(CATALOG_MODELS.length);
    expect(payload.snapshot.generatedAt).toBeTruthy();

    const totalModels = payload.providers.reduce((sum: number, p: any) => sum + p.models.length, 0);
    expect(totalModels).toBe(CATALOG_MODELS.length);
    expect(payload.matched).toBe(CATALOG_MODELS.length);

    const openai = payload.providers.find((p: any) => p.id === "openai");
    expect(openai.vendor).toBe("OpenAI");
    expect(openai.keyHelpUrl).toMatch(/^https:\/\//);
    expect(openai.kindCounts.chat).toBeGreaterThan(0);
    expect(openai.models[0].contextLength).not.toBeUndefined();
    expect(openai.models[0].pricing).not.toBeUndefined();
  });

  it("filters by provider, kind and capability", async () => {
    const handler = getHandler(catalogRouter, "/", "get");

    const byProvider = await callRoute(handler, { query: { provider: "groq" } });
    expect(byProvider.payload.providers).toHaveLength(1);
    expect(byProvider.payload.providers[0].id).toBe("groq");
    expect(byProvider.payload.providers[0].matchedCount).toBe(byProvider.payload.providers[0].modelCount);

    const byKind = await callRoute(handler, { query: { kind: "embedding" } });
    expect(byKind.payload.matched).toBeGreaterThan(0);
    for (const provider of byKind.payload.providers) {
      expect(provider.models.every((m: any) => m.kind === "embedding")).toBe(true);
    }

    const byCapability = await callRoute(handler, { query: { capability: "tools" } });
    for (const provider of byCapability.payload.providers) {
      expect(provider.models.every((m: any) => m.supportsTools)).toBe(true);
    }

    const byQuery = await callRoute(handler, { query: { q: "kimi" } });
    expect(byQuery.payload.matched).toBeGreaterThan(0);
  });
});

describe("Model catalog admin routes", () => {
  it("registers a catalog summary and an import endpoint that cannot be shadowed by :id routes", () => {
    const paths = modelsRouter.stack.filter((l: any) => l.route).map((l: any) => `${Object.keys(l.route.methods)[0]}:${l.route.path}`);
    expect(paths).toContain("get:/catalog");
    expect(paths).toContain("post:/catalog/import");
    // Two-segment catalog paths are matched before any single-segment :id handler.
    expect(paths.indexOf("post:/catalog/import")).toBeLessThan(paths.indexOf("post:/:id/test"));
  });

  it("reports catalog totals and per-provider import status", async () => {
    const handler = getHandler(modelsRouter, "/catalog", "get");
    const { payload } = await callRoute(handler, { user: { id: "admin-user" } });

    expect(payload.totals.models).toBe(CATALOG_MODELS.length);
    expect(payload.providers.length).toBe(CATALOG_PROVIDERS.length);
    expect(payload.appModelCount).toBeGreaterThan(10);
    expect(payload.providers.every((p: any) => p.modelCount > 0)).toBe(true);
  });
});
