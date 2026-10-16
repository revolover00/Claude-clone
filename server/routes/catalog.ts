import { Router, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  CATALOG_PROVIDERS,
  CATALOG_SNAPSHOT,
  catalogTotals,
  filterCatalogModels,
} from "../../src/shared/catalog";

const router = Router();

/**
 * GET /api/catalog
 *
 * Returns the bundled model catalog: every provider the app supports with all of
 * its models and their details. It needs no API key and never touches a provider,
 * so the UI always has a complete, organized model list to show.
 *
 * Query params: provider, q, kind, capability (reasoning|tools|vision|structured), minContext
 */
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const providerFilter = String(req.query.provider || "all");
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const kindFilter = typeof req.query.kind === "string" ? req.query.kind.split(",").map((k) => k.trim()).filter(Boolean) : [];
  const capability = typeof req.query.capability === "string" ? (req.query.capability as any) : undefined;
  const minContext = Number(req.query.minContext || 0) || 0;

  const filter = { query, kinds: kindFilter, capability, minContext };

  const providers = CATALOG_PROVIDERS
    .filter((p) => providerFilter === "all" || p.id === providerFilter)
    .map((p) => {
      const models = filterCatalogModels(p.models, { ...filter, provider: undefined });
      return {
        id: p.id,
        label: p.label,
        vendor: p.vendor,
        docsUrl: p.docsUrl,
        keyHelpUrl: p.keyHelpUrl,
        apiBase: p.apiBase,
        apiStyle: p.apiStyle,
        keyEnv: p.keyEnv,
        modelCount: p.modelCount,
        matchedCount: models.length,
        kindCounts: countKinds(p.models),
        models,
      };
    });

  const matched = providers.reduce((sum, p) => sum + p.matchedCount, 0);

  res.json({
    snapshot: CATALOG_SNAPSHOT,
    totals: catalogTotals(),
    matched,
    providerCount: providers.length,
    providers,
  });
});

function countKinds(models: Array<{ kind: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const model of models) {
    counts[model.kind] = (counts[model.kind] || 0) + 1;
  }
  return counts;
}

export default router;
