import { describe, it, expect } from "vitest";
import providersRouter from "../server/routes/providers";
import { providers } from "../server/lib/providers";
import { getCatalogModels, CATALOG_PROVIDERS } from "../src/shared/catalog";

function getHandler(path: string, method: "get" | "post" | "delete") {
  const layer = providersRouter.stack.find((l: any) => l.route?.path === path && l.route.methods[method]);
  expect(layer, `route ${method.toUpperCase()} ${path} is not registered`).toBeDefined();
  return layer.route.stack[0].handle;
}

async function callRoute(handler: any, req: any) {
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
  await handler(req, res);
  return { payload, status };
}

describe("Provider routes served from the bundled catalog", () => {
  it("lists every bundled provider, connected or not, with catalog sizes", async () => {
    const handler = getHandler("/", "get");
    const { payload } = await callRoute(handler, { user: { id: "catalog-viewer" }, headers: {} });

    expect(payload.providers.length).toBe(Object.keys(providers).length);
    expect(payload.providers.length).toBeGreaterThanOrEqual(CATALOG_PROVIDERS.length);

    for (const provider of payload.providers) {
      expect(provider.bundledModelCount).toBeGreaterThan(0);
      expect(provider.connected).toBe(false);
      expect(provider.docsUrl).toMatch(/^https:\/\//);
      expect(provider.keyEnv).toMatch(/KEY$/);
    }

    expect(payload.catalog.models).toBeGreaterThan(300);
    expect(payload.catalog.snapshot.generatedAt).toBeTruthy();
  });

  it("serves the full bundled catalog for a provider with no API key connected", async () => {
    const handler = getHandler("/:provider/models", "get");

    for (const providerId of ["openai", "gemini", "openrouter"]) {
      const { payload, status } = await callRoute(handler, {
        user: { id: "catalog-viewer" },
        params: { provider: providerId },
        query: {},
      });

      expect(status).toBe(200);
      expect(payload.provider).toBe(providerId);
      expect(payload.source).toBe("bundled");
      expect(payload.liveModelCount).toBe(0);
      expect(payload.models.length).toBe(getCatalogModels(providerId).length);
      expect(payload.models.every((m: any) => m.requiresKey !== true)).toBe(true);

      const sample = payload.models.find((m: any) => m.kind === "chat");
      expect(sample.displayName.length).toBeGreaterThan(0);
      expect(sample.source).toBe("bundled");
      expect(sample.vendor).toBeTruthy();
      expect(sample.isEnabled).toBe(true);
      expect(sample.isPinned).toBe(false);
      expect(sample.contextLength).toBeGreaterThan(0);
    }
  });

  it("still rejects unknown providers", async () => {
    const handler = getHandler("/:provider/models", "get");
    const { status, payload } = await callRoute(handler, {
      user: { id: "catalog-viewer" },
      params: { provider: "not-a-provider" },
      query: {},
    });
    expect(status).toBe(404);
    expect(payload.error).toContain("not found");
  });
});
