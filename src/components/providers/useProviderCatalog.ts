import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../../utils/safeFetch";
import type { CatalogProviderView, CatalogStats, ProviderModelItem } from "./types";

interface LoadOptions {
  refresh?: boolean;
}

/**
 * Loads the full provider catalog for the settings browser.
 *
 * Every bundled provider is listed with all of its models and details, whether or
 * not an API key is connected, so the browser is never empty and nothing has to be
 * added by hand.
 */
export function useProviderCatalog() {
  const [providers, setProviders] = useState<CatalogProviderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<any>(null);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);

  const load = useCallback(async ({ refresh = false }: LoadOptions = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await authFetch("/api/providers");
      if (!res.ok) throw new Error(`Failed to load providers (HTTP ${res.status})`);
      const data = await res.json();
      const registry: any[] = Array.isArray(data?.providers) ? data.providers : [];
      setSnapshotDate(data?.catalog?.snapshot?.generatedAt || null);

      const views = await Promise.all(
        registry.map(async (provider): Promise<CatalogProviderView> => {
          const view: CatalogProviderView = {
            id: provider.id,
            label: provider.label,
            vendor: provider.vendor || provider.label,
            docsUrl: provider.docsUrl || "",
            keyHelpUrl: provider.keyHelpUrl || provider.docsUrl || "",
            keyEnv: provider.keyEnv || null,
            apiStyle: provider.apiStyle,
            connected: Boolean(provider.connected),
            modelCount: provider.bundledModelCount || 0,
            bundledModelCount: provider.bundledModelCount || 0,
            source: "bundled",
            liveError: null,
            models: [],
          };

          try {
            const mRes = await authFetch(
              `/api/providers/${provider.id}/models${refresh && provider.connected ? "?refresh=1" : ""}`
            );
            if (!mRes.ok) return view;
            const mData = await mRes.json();
            const models: ProviderModelItem[] = Array.isArray(mData?.models) ? mData.models : [];
            return {
              ...view,
              models: models.map((m) => ({ ...m, requiresKey: !view.connected })),
              modelCount: models.length,
              bundledModelCount: mData?.bundledModelCount ?? view.bundledModelCount,
              source: mData?.source === "live" ? "live" : "bundled",
              liveError: mData?.liveError || null,
            };
          } catch {
            return view;
          }
        })
      );

      setProviders(views);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savePrefs = useCallback(
    async (items: Array<{ provider: string; model_id: string; enabled?: boolean; pinned?: boolean; alias?: string }>) => {
      try {
        await authFetch("/api/models/prefs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
      } catch {
        // Preferences are best-effort; the catalog itself is unaffected.
      }
    },
    []
  );

  const patchModel = useCallback((providerId: string, modelId: string, patch: Partial<ProviderModelItem>) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId
          ? { ...p, models: p.models.map((m) => (m.id === modelId ? { ...m, ...patch } : m)) }
          : p
      )
    );
  }, []);

  const toggleEnabled = useCallback(
    (model: ProviderModelItem) => {
      const enabled = !model.isEnabled;
      patchModel(model.provider, model.id, { isEnabled: enabled });
      void savePrefs([
        { provider: model.provider, model_id: model.id, enabled, pinned: model.isPinned, alias: model.alias || undefined },
      ]);
    },
    [patchModel, savePrefs]
  );

  const togglePinned = useCallback(
    (model: ProviderModelItem) => {
      const pinned = !model.isPinned;
      patchModel(model.provider, model.id, { isPinned: pinned });
      void savePrefs([
        { provider: model.provider, model_id: model.id, enabled: model.isEnabled, pinned, alias: model.alias || undefined },
      ]);
    },
    [patchModel, savePrefs]
  );

  const updateAlias = useCallback(
    (model: ProviderModelItem, alias: string) => {
      patchModel(model.provider, model.id, { alias: alias || null });
      void savePrefs([
        { provider: model.provider, model_id: model.id, enabled: model.isEnabled, pinned: model.isPinned, alias },
      ]);
    },
    [patchModel, savePrefs]
  );

  /** Bulk enable/disable for a list of visible models. */
  const bulkEnable = useCallback(
    (models: ProviderModelItem[], enabled: boolean) => {
      const items = models.map((m) => ({
        provider: m.provider,
        model_id: m.id,
        enabled,
        pinned: m.isPinned,
        alias: m.alias || undefined,
      }));
      setProviders((prev) => {
        const keys = new Set(items.map((i) => `${i.provider}:${i.model_id}`));
        return prev.map((p) => ({
          ...p,
          models: p.models.map((m) => (keys.has(`${m.provider}:${m.id}`) ? { ...m, isEnabled: enabled } : m)),
        }));
      });
      void savePrefs(items);
    },
    [savePrefs]
  );

  const allModels = useMemo(() => providers.flatMap((p) => p.models), [providers]);

  const stats: CatalogStats = useMemo(
    () => ({
      providerCount: providers.length,
      modelCount: allModels.length,
      connectedCount: providers.filter((p) => p.connected).length,
      snapshotDate,
    }),
    [providers, allModels, snapshotDate]
  );

  return {
    providers,
    allModels,
    stats,
    loading,
    refreshing,
    error,
    reload: load,
    toggleEnabled,
    togglePinned,
    updateAlias,
    bulkEnable,
  };
}
