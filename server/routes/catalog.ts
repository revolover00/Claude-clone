import { Router, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { getCatalogStore } from "../lib/catalog/store";
import { bundledCatalogRecords } from "../lib/catalog/bundled";
import { mergeCatalogRows } from "../lib/catalog/merge";
import {
  computeFacets,
  filterRecords,
  mergeOverrides,
  paginate,
  sortRecords,
  type CatalogQuery,
} from "../lib/catalog/query";
import { maybeSyncStaleCatalog } from "../lib/catalog/scheduler";
import { allCatalogFetchers } from "../lib/catalog/fetchers";
import { listUserCredentials } from "../lib/providers/credentialsStore";
import { getUserModelPrefsAll } from "../lib/providers/modelsCache";
import { checkIsAdmin } from "../lib/modelsStore";
import { CATALOG_PROVIDERS, providerLabel } from "../../src/shared/catalog";

const router = Router();

const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

function listParam(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => String(v).split(",")).map((v) => v.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((v) => v.trim()).filter(Boolean);
  return [];
}

function readQuery(req: AuthenticatedRequest): CatalogQuery {
  const q = req.query;
  const freeRaw = q.free;
  return {
    provider: typeof q.provider === "string" ? q.provider : undefined,
    kind: listParam(q.kind),
    vendor: listParam(q.vendor),
    family: listParam(q.family),
    capability: listParam(q.capability),
    status: listParam(q.status),
    free: freeRaw === "1" || freeRaw === "true" ? true : freeRaw === "0" || freeRaw === "false" ? false : undefined,
    q: typeof q.q === "string" ? q.q : "",
    sort: q.sort === "newest" || q.sort === "context" || q.sort === "price" || q.sort === "recommended" ? q.sort : "recommended",
    cursor: typeof q.cursor === "string" ? q.cursor : undefined,
    limit: q.limit !== undefined ? Number(q.limit) : undefined,
  };
}

async function loadContext(req: AuthenticatedRequest) {
  const store = getCatalogStore();
  const isAdmin = await checkIsAdmin(req.user?.id || "");
  const liveRecords = await store.list();
  const source: "catalog" | "bundled" = liveRecords.length > 0 ? "catalog" : "bundled";
  const records = mergeCatalogRows(bundledCatalogRecords(), liveRecords);
  const overrides = await store.getOverrides();
  const merged = mergeOverrides(records, overrides, isAdmin);

  const credentials = req.user?.id ? await listUserCredentials(req.user.id) : [];
  const connected = new Set(credentials.filter((c) => !c.status || c.status === "active").map((c) => c.provider));
  const prefs = req.user?.id ? await getUserModelPrefsAll(req.user.id) : [];
  const prefMap = new Map(prefs.map((p) => [`${p.provider}:${p.model_id}`, p]));
  return { store, isAdmin, source, merged, connected, prefMap };
}

function presentModel(row: any, connected: Set<string>, prefMap: Map<string, any>) {
  const pref = prefMap.get(`${row.provider}:${row.model_id}`);
  const alias = row.alias ?? pref?.alias ?? null;
  return {
    ...row,
    display_name: alias || row.name,
    alias,
    enabled: pref?.enabled ?? true,
    pinned: pref?.pinned ?? false,
    connected: connected.has(row.provider),
    requires_key: !connected.has(row.provider),
  };
}

function providerSummary(merged: any[], connected: Set<string>) {
  const counts = new Map<string, number>();
  merged.forEach((row) => counts.set(row.provider, (counts.get(row.provider) || 0) + 1));
  const ids = new Set([...counts.keys(), ...CATALOG_PROVIDERS.map((p) => p.id)]);
  return [...ids].map((id) => ({
    id,
    label: providerLabel(id),
    connected: connected.has(id),
    modelCount: counts.get(id) || 0,
  }));
}

/**
 * GET /api/catalog — the synced model catalog with server-side filters and
 * cursor pagination, merged with the caller's connected providers, per-user
 * model preferences and admin catalog_overrides. Falls back to the committed
 * snapshot when the catalog table is empty. A background sync is triggered
 * when the newest last_synced_at is older than 12 hours.
 */
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    maybeSyncStaleCatalog();
    const { isAdmin, source, merged, connected, prefMap } = await loadContext(req);
    const query = readQuery(req);
    const filtered = filterRecords(merged, query);
    const sorted = sortRecords(filtered, query.sort);
    const all = req.query.all === "1" || req.query.all === "true";
    const { page, total, nextCursor } = paginate(sorted, query, all);
    const store = getCatalogStore();
    const newest = await store.newestSyncedAt();

    res.json({
      source,
      is_admin: isAdmin,
      models: page.map((row) => presentModel(row, connected, prefMap)),
      total,
      nextCursor,
      limit: all ? total : Math.min(Number(query.limit) || 50, 200),
      providers: providerSummary(merged, connected),
      syncable: allCatalogFetchers().map((f) => f.provider),
      sync: {
        newest: newest || null,
        stale: !newest || Date.now() - Date.parse(newest) > STALE_AFTER_MS,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load the catalog" });
  }
});

/** GET /api/catalog/facets — counts by provider, vendor, family, kind, capability and status. */
router.get("/facets", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { merged, connected, isAdmin, source } = await loadContext(req);
    res.json({
      source,
      is_admin: isAdmin,
      total: merged.length,
      facets: computeFacets(merged),
      providers: providerSummary(merged, connected),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load facets" });
  }
});

/** GET /api/catalog/sync-runs — sync history from catalog_sync_runs (admin). */
router.get("/sync-runs", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = await checkIsAdmin(req.user?.id || "");
    if (!isAdmin) {
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return;
    }
    const provider = typeof req.query.provider === "string" ? req.query.provider : undefined;
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const runs = await getCatalogStore().listRuns(provider, limit);
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load sync history" });
  }
});

export default router;
