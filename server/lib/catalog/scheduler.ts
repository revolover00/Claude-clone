/**
 * Background sync scheduling.
 *
 * - Runs once in the background at startup, then every 6 hours.
 * - A database check skips a run when another started less than 5 minutes ago,
 *   so several instances never sync at the same time.
 * - GET /api/catalog calls `maybeSyncStaleCatalog` to trigger a background
 *   sync when the newest last_synced_at is older than 12 hours.
 */
import { CATALOG_FETCHERS, type CatalogFetcher } from "./fetchers";
import { syncProviderFetching } from "./syncEngine";
import { getCatalogStore } from "./store";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const LOCK_WINDOW_MS = 5 * 60 * 1000;
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

let started = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

/** Syncing is disabled under vitest so route tests never hit provider APIs. */
export function catalogSyncEnabled(): boolean {
  if (process.env.CATALOG_SYNC === "off") return false;
  return !process.env.VITEST;
}

export async function runProviderSync(provider: string, trigger: string, fetcher?: CatalogFetcher["fetch"]): Promise<any> {
  const store = getCatalogStore();
  const entry = fetcher ? { provider, fetch: fetcher } : CATALOG_FETCHERS.find((f) => f.provider === provider);
  if (!entry) throw new Error(`No catalog fetcher for provider '${provider}'`);
  return syncProviderFetching(store, provider, entry.fetch, { trigger });
}

/**
 * Runs every provider sync through the database lock. Returns the outcomes,
 * or null when the run was skipped (another instance synced < 5 min ago).
 */
export async function runCatalogSync(trigger: string): Promise<any[] | null> {
  if (inFlight) return null;
  inFlight = true;
  try {
    const store = getCatalogStore();
    if (await store.recentRunWithin(LOCK_WINDOW_MS)) return null;
    const results: any[] = [];
    for (const fetcher of CATALOG_FETCHERS) {
      results.push(await syncProviderFetching(store, fetcher.provider, fetcher.fetch, { trigger }));
    }
    return results;
  } finally {
    inFlight = false;
  }
}

/** Background trigger used by GET /api/catalog when the catalog is stale. */
export function maybeSyncStaleCatalog(): void {
  if (!catalogSyncEnabled() || inFlight) return;
  void (async () => {
    try {
      const store = getCatalogStore();
      const newest = await store.newestSyncedAt();
      if (newest && Date.now() - Date.parse(newest) < STALE_AFTER_MS) return;
      await runCatalogSync("catalog");
    } catch (err: any) {
      console.warn("[Catalog] background sync failed:", err?.message || err);
    }
  })();
}

/** Startup + 6-hour interval scheduling (no-op under vitest). */
export function startCatalogScheduler(): void {
  if (started || !catalogSyncEnabled()) return;
  started = true;
  setTimeout(() => {
    void runCatalogSync("startup").catch((err) => console.warn("[Catalog] startup sync failed:", err?.message || err));
  }, 1500);
  intervalHandle = setInterval(() => {
    void runCatalogSync("interval").catch((err) => console.warn("[Catalog] interval sync failed:", err?.message || err));
  }, SIX_HOURS_MS);
  intervalHandle.unref?.();
}

/** Test helper: stop the interval. */
export function stopCatalogScheduler(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  started = false;
}
