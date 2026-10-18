import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useModels } from "../../../hooks/useModels";
import { authFetch } from "../../../utils/safeFetch";
import { composerSections, type PickerSection } from "../../../shared/catalog/grouping";
import type { UnifiedModel } from "./types";

import { hasFreeTier } from "../../../shared/catalog/freeTier";
import {
  PROVIDER_LABELS,
  getProviderLabel,
  labelFor,
  pushUnique,
  fromCatalogRow,
  fromLegacyRow,
} from "./adapters";

export { PROVIDER_LABELS, getProviderLabel };

export function useComposerModels(selectedModelId: string) {
  const { models: appModels, defaultModel, normalizeSlug } = useModels();
  const [liveModels, setLiveModels] = useState<UnifiedModel[]>([]);
  const [catalogModels, setCatalogModels] = useState<UnifiedModel[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const labelsRef = useRef<Record<string, string>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [freeOnly, setFreeOnly] = useState(false);

  const fetchAllProviderModels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/providers");
      if (res.ok) {
        const data = await res.json();
        const credentials: any[] = Array.isArray(data.credentials) ? data.credentials : [];
        const registry: any[] = Array.isArray(data.providers) ? data.providers : [];
        const nextLabels: Record<string, string> = {};
        registry.forEach((p) => {
          nextLabels[p.id] = p.label || getProviderLabel(p.id);
        });
        setLabels(nextLabels);
        labelsRef.current = nextLabels;
        setOrder(registry.map((p) => p.id));
        const connectedIds = credentials.filter((c) => !c.status || c.status === "active").map((c) => c.provider);

        // Live catalogs for connected providers (keys may expose extra models).
        const live: UnifiedModel[] = [];
        await Promise.all(
          registry
            .map((p) => p.id)
            .filter((id: string) => connectedIds.includes(id))
            .map(async (providerId: string) => {
              try {
                const mRes = await authFetch(`/api/providers/${providerId}/models`);
                if (!mRes.ok) return;
                const mData = await mRes.json();
                const list: any[] = Array.isArray(mData.models) ? mData.models : [];
                list.forEach((m) => {
                  if (m.isEnabled === false) return;
                  live.push(fromLegacyRow(providerId, nextLabels[providerId] || getProviderLabel(providerId), m, false));
                });
              } catch {
                // individual provider failures must not empty the picker
              }
            })
        );
        setLiveModels(live);
      }

      // Full catalog: flat rows (new shape) or the legacy grouped payload.
      try {
        const cRes = await authFetch("/api/catalog?all=1");
        if (cRes.ok) {
          const cData = await cRes.json();
          const rows: UnifiedModel[] = [];
          if (Array.isArray(cData.models)) {
            cData.models.forEach((m: any) => rows.push(fromCatalogRow(m, labelsRef.current)));
          } else if (Array.isArray(cData.providers)) {
            cData.providers.forEach((p: any) => {
              const label = p.label || getProviderLabel(p.id);
              const requiresKey = p.connected === false;
              (p.models || []).forEach((m: any) => rows.push(fromLegacyRow(p.id, label, m, requiresKey)));
            });
          }
          setCatalogModels(rows);
        }
      } catch {
        setCatalogModels([]);
      }
    } catch {
      setLiveModels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllProviderModels();
  }, [fetchAllProviderModels]);

  // A provider key was saved: refetch catalogs so its models unlock live.
  useEffect(() => {
    const onProvidersChanged = () => void fetchAllProviderModels();
    window.addEventListener("claude:provider-connected", onProvidersChanged);
    window.addEventListener("claude:providers-changed", onProvidersChanged);
    return () => {
      window.removeEventListener("claude:provider-connected", onProvidersChanged);
      window.removeEventListener("claude:providers-changed", onProvidersChanged);
    };
  }, [fetchAllProviderModels]);

  const allModels = useMemo<UnifiedModel[]>(() => {
    const list: UnifiedModel[] = [];
    const seen = new Set<string>();
    liveModels.forEach((m) => pushUnique(list, seen, m));
    catalogModels.forEach((m) => pushUnique(list, seen, { ...m, providerLabel: labelFor(labels, m.provider) }));

    appModels
      .filter((m) => m.enabled && m.kind === "chat")
      .forEach((m) => {
        const pKey = m.provider === "google" ? "gemini" : m.provider || "gemini";
        pushUnique(list, seen, {
          id: m.api_model_id || m.slug,
          uniqueKey: `${pKey}:${m.api_model_id || m.slug}`,
          provider: pKey,
          providerLabel: labelFor(labels, pKey),
          displayName: m.display_name,
          alias: null,
          description: m.description,
          contextLength: (m as any).context_length ?? null,
          family: (m as any).family ?? null,
          vendor: (m as any).vendor ?? null,
          status: (m as any).status || "active",
          recommended: Boolean((m as any).recommended),
          releasedAt: (m as any).release_date ?? null,
          supportsThinking: Boolean(m.supports_thinking),
          supportsTools: Boolean(m.supports_tools),
          supportsVision: Boolean(m.supports_vision),
          supportsSearch: Boolean(m.supports_search),
          pricing: (m as any).pricing || null,
          isEnabled: true,
          isPinned: false,
          isDefault: Boolean(m.is_default),
          kind: m.kind,
          requiresKey: false,
        });
      });

    return list;
  }, [liveModels, catalogModels, appModels, labels]);

  const vendorOf = (m: UnifiedModel) => m.vendor || m.providerLabel;

  /** Vendors present in the catalog, for the picker's vendor filter chips. */
  const availableVendors = useMemo(
    () => [...new Set(allModels.map(vendorOf).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [allModels]
  );

  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = allModels;
    if (vendorFilter !== "all") list = list.filter((m) => vendorOf(m) === vendorFilter);
    if (freeOnly) list = list.filter((m) => m.isFree || hasFreeTier(m.provider));
    if (!q) return list;
    return list.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        (m.alias && m.alias.toLowerCase().includes(q)) ||
        m.id.toLowerCase().includes(q) ||
        m.providerLabel.toLowerCase().includes(q) ||
        (m.family || "").toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
    );
  }, [allModels, searchQuery, vendorFilter, freeOnly]);

  const sections = useMemo<PickerSection[]>(
    () => composerSections(filteredModels, (p) => labelFor(labels, p), order),
    [filteredModels, labels, order]
  );

  const activeModelObj = useMemo<UnifiedModel | null>(() => {
    if (!selectedModelId) {
      return allModels.find((m) => m.isDefault) || allModels[0] || null;
    }
    const norm = normalizeSlug(selectedModelId);
    return (
      allModels.find((m) => m.uniqueKey === selectedModelId) ||
      allModels.find((m) => m.uniqueKey === norm) ||
      allModels.find((m) => m.id === selectedModelId || m.id === norm) ||
      allModels.find((m) => m.uniqueKey.endsWith(`:${norm}`)) ||
      allModels.find((m) => m.isDefault) ||
      allModels[0] ||
      null
    );
  }, [allModels, selectedModelId, normalizeSlug]);

  const pillLabel = useMemo(() => {
    if (!activeModelObj) return defaultModel?.display_name || "Gemini 3.8 Flash";
    return activeModelObj.alias || activeModelObj.displayName;
  }, [activeModelObj, defaultModel]);

  return {
    allModels,
    sections,
    activeModelObj,
    pillLabel,
    searchQuery,
    setSearchQuery,
    vendorFilter,
    setVendorFilter,
    freeOnly,
    setFreeOnly,
    availableVendors,
    loading,
    refresh: fetchAllProviderModels,
    labelFor: (providerId: string) => labelFor(labels, providerId),
  };
}
