import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useModels } from "../../../hooks/useModels";
import { authFetch } from "../../../utils/safeFetch";
import { hasFreeTier } from "../../../shared/providerTraits";
import type { PickerSection } from "../../../shared/catalog/grouping";
import type { UnifiedModel } from "./types";

type CatalogGrouping = typeof import("../../../shared/catalog/grouping");
import {
  PROVIDER_LABELS,
  getProviderLabel,
  labelFor,
  displayNameFromId,
  pushUnique,
  fromCatalogRow,
  fromLegacyRow,
} from "./adapters";

export { PROVIDER_LABELS, getProviderLabel };

export function useComposerModels(selectedModelId: string, enabled = true) {
  const { models: appModels, defaultModel, normalizeSlug } = useModels();
  const [catalogGrouping, setCatalogGrouping] = useState<Pick<CatalogGrouping, "composerSections" | "closestRecommendedModel"> | null>(null);
  const [liveModels, setLiveModels] = useState<UnifiedModel[]>([]);
  const [catalogModels, setCatalogModels] = useState<UnifiedModel[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [verifiedProviderIds, setVerifiedProviderIds] = useState<string[]>([]);
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
        const verified = credentials.filter((c) => (!c.status || c.status === "active") && c.last_verified_at).map((c) => c.provider);
        setVerifiedProviderIds([...new Set(verified)]);
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
      setVerifiedProviderIds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void import("../../../shared/catalog/grouping").then((grouping) => {
      if (!active) return;
      setCatalogGrouping({
        composerSections: grouping.composerSections,
        closestRecommendedModel: grouping.closestRecommendedModel,
      });
    }).catch(() => undefined);
    void fetchAllProviderModels();
    return () => { active = false; };
  }, [enabled, fetchAllProviderModels]);

  // A provider key was saved: refresh only while the picker is open.
  useEffect(() => {
    const onProvidersChanged = () => { if (enabled) void fetchAllProviderModels(); };
    const onProviderVerified = (event: Event) => {
      const provider = String((event as CustomEvent).detail?.provider || "");
      if (provider) setVerifiedProviderIds((current) => current.includes(provider) ? current : [...current, provider]);
    };
    window.addEventListener("claude:provider-connected", onProvidersChanged);
    window.addEventListener("claude:providers-changed", onProvidersChanged);
    window.addEventListener("claude:provider-verified", onProviderVerified);
    return () => {
      window.removeEventListener("claude:provider-connected", onProvidersChanged);
      window.removeEventListener("claude:providers-changed", onProvidersChanged);
      window.removeEventListener("claude:provider-verified", onProviderVerified);
    };
  }, [enabled, fetchAllProviderModels]);

  const allModels = useMemo<UnifiedModel[]>(() => {
    const list: UnifiedModel[] = [];
    const seen = new Set<string>();
    const verified = new Set(verifiedProviderIds);
    liveModels.forEach((m) => pushUnique(list, seen, { ...m, isProviderVerified: verified.has(m.provider) }));
    catalogModels.forEach((m) => pushUnique(list, seen, {
      ...m, providerLabel: labelFor(labels, m.provider), isProviderVerified: verified.has(m.provider),
    }));

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
          isProviderVerified: verified.has(pKey),
          kind: m.kind,
          requiresKey: false,
        });
      });

    return list;
  }, [liveModels, catalogModels, appModels, labels, verifiedProviderIds]);

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
    () => catalogGrouping?.composerSections(filteredModels, (p) => labelFor(labels, p), order) || [],
    [catalogGrouping, filteredModels, labels, order]
  );

  const activeModelObj = useMemo<UnifiedModel | null>(() => {
    if (!selectedModelId) return allModels.find((m) => m.isDefault) || allModels[0] || null;
    const norm = normalizeSlug(selectedModelId);
    const match = allModels.find((m) => m.uniqueKey === selectedModelId) ||
      allModels.find((m) => m.uniqueKey === norm) ||
      allModels.find((m) => m.id === selectedModelId || m.id === norm) ||
      allModels.find((m) => m.uniqueKey.endsWith(`:${norm}`));
    if (match) return match;
    const separator = selectedModelId.indexOf(":");
    if (separator > 0 && separator < selectedModelId.length - 1) {
      const provider = selectedModelId.slice(0, separator);
      const id = selectedModelId.slice(separator + 1);
      return {
        id, uniqueKey: selectedModelId, provider, providerLabel: labelFor(labels, provider),
        displayName: displayNameFromId(id), supportsThinking: false, supportsTools: false,
        supportsVision: false, supportsSearch: false, isEnabled: true, isPinned: false,
        isProviderVerified: verifiedProviderIds.includes(provider),
      };
    }
    return allModels.find((m) => m.isDefault) || allModels[0] || null;
  }, [allModels, selectedModelId, normalizeSlug, labels, verifiedProviderIds]);

  const pillLabel = useMemo(() => {
    if (!activeModelObj) return defaultModel?.display_name || "Gemini 3.8 Flash";
    return activeModelObj.alias || activeModelObj.displayName;
  }, [activeModelObj, defaultModel]);
  const chooseClosestRecommended = useCallback(
    (target: UnifiedModel | null, candidates: UnifiedModel[]) =>
      (catalogGrouping?.closestRecommendedModel(target as any, candidates as any) as UnifiedModel | null) || null,
    [catalogGrouping]
  );

  return {
    allModels,
    sections,
    activeModelObj,
    closestRecommendedModel: chooseClosestRecommended,
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
