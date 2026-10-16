import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../../utils/safeFetch";
import type { CatalogBrowserData, CatalogBrowserModel } from "./types";

interface LoadOptions {
  refresh?: boolean;
}

/**
 * Loads GET /api/catalog?all=1 for the Providers > Models browser: every
 * catalog model (connected or not) plus per-user preferences, with optimistic
 * pref toggles persisted to /api/models/prefs.
 */
export function useCatalogBrowser() {
  const [models, setModels] = useState<CatalogBrowserModel[]>([]);
  const [providers, setProviders] = useState<CatalogBrowserData["providers"]>([]);
  const [source, setSource] = useState<"catalog" | "bundled">("catalog");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<any>(null);

  const load = useCallback(async ({ refresh = false }: LoadOptions = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/catalog?all=1");
      if (!res.ok) throw new Error(`Failed to load the model catalog (HTTP ${res.status})`);
      const data = await res.json();
      setModels(Array.isArray(data.models) ? data.models : []);
      setProviders(Array.isArray(data.providers) ? data.providers : []);
      setSource(data.source === "bundled" ? "bundled" : "catalog");
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A provider key was saved/removed: refetch so its rows un-dim instantly.
  useEffect(() => {
    const onProvidersChanged = () => void load({ refresh: true });
    window.addEventListener("claude:provider-connected", onProvidersChanged);
    window.addEventListener("claude:providers-changed", onProvidersChanged);
    return () => {
      window.removeEventListener("claude:provider-connected", onProvidersChanged);
      window.removeEventListener("claude:providers-changed", onProvidersChanged);
    };
  }, [load]);

  const patchModel = useCallback((model: CatalogBrowserModel, patch: Partial<CatalogBrowserModel>) => {
    setModels((prev) => prev.map((m) => (m.provider === model.provider && m.model_id === model.model_id ? { ...m, ...patch } : m)));
  }, []);

  const savePrefs = useCallback((model: CatalogBrowserModel, patch: { enabled?: boolean; pinned?: boolean; alias?: string }) => {
    void authFetch("/api/models/prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            provider: model.provider,
            model_id: model.model_id,
            enabled: patch.enabled ?? model.enabled,
            pinned: patch.pinned ?? model.pinned,
            alias: patch.alias ?? model.alias ?? undefined,
          },
        ],
      }),
    }).catch(() => {
      /* Preferences are best-effort; the catalog itself is unaffected. */
    });
  }, []);

  const toggleEnabled = useCallback(
    (model: CatalogBrowserModel) => {
      const enabled = !model.enabled;
      patchModel(model, { enabled });
      savePrefs(model, { enabled });
    },
    [patchModel, savePrefs]
  );

  const togglePinned = useCallback(
    (model: CatalogBrowserModel) => {
      const pinned = !model.pinned;
      patchModel(model, { pinned });
      savePrefs(model, { pinned });
    },
    [patchModel, savePrefs]
  );

  const updateAlias = useCallback(
    (model: CatalogBrowserModel, alias: string) => {
      patchModel(model, { alias: alias || null });
      savePrefs(model, { alias });
    },
    [patchModel, savePrefs]
  );

  return {
    models,
    providers,
    source,
    loading,
    refreshing,
    error,
    reload: load,
    toggleEnabled,
    togglePinned,
    updateAlias,
  };
}
