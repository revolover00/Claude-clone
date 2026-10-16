import { useState, useEffect, useMemo, useCallback } from "react";
import { useModels } from "../../../hooks/useModels";
import { authFetch } from "../../../utils/safeFetch";
import type { UnifiedModel, ProviderGroup } from "./types";

export const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Google AI Studio",
  google: "Google AI Studio",
  groq: "Groq",
  openrouter: "OpenRouter",
  app: "App models",
};

export function getProviderLabel(providerId?: string): string {
  if (!providerId) return "App models";
  const lower = providerId.toLowerCase();
  return PROVIDER_LABELS[lower] || providerId;
}

interface ProviderBootstrap {
  labels: Record<string, string>;
  connected: Set<string>;
  /** Registry order, so provider groups stay in a stable, meaningful order. */
  order: string[];
}

function toUnified(providerId: string, label: string, m: any, requiresKey: boolean): UnifiedModel {
  return {
    id: m.id,
    uniqueKey: `${providerId}:${m.id}`,
    provider: providerId,
    providerLabel: label,
    displayName: m.displayName || m.name || m.id,
    alias: m.alias || null,
    description: m.description || null,
    contextLength: m.contextLength ?? null,
    supportsThinking: Boolean(m.supportsReasoning || m.supports_thinking),
    supportsTools: Boolean(m.supportsTools || m.supports_tools),
    supportsVision: Boolean(m.supportsVision || m.supports_vision),
    supportsSearch: Boolean(m.supportsSearch || m.supports_search),
    pricing: m.pricing || null,
    isEnabled: true,
    isPinned: Boolean(m.isPinned),
    isDefault: Boolean(m.is_default),
    kind: m.kind,
    vendor: m.vendor,
    requiresKey,
  };
}

/**
 * Builds the composer model picker list.
 *
 * Sources, in priority order:
 *  1. live provider catalogs (connected providers),
 *  2. the bundled catalog shipped with the app (every provider, every model),
 *  3. the app's own enabled chat models (Google, served with the server key).
 * Models whose provider has no key yet are still listed and flagged as needing one.
 */
export function useComposerModels(selectedModelId: string) {
  const { models: appModels, defaultModel, normalizeSlug } = useModels();
  const [providerModels, setProviderModels] = useState<UnifiedModel[]>([]);
  const [catalogModels, setCatalogModels] = useState<UnifiedModel[]>([]);
  const [bootstrap, setBootstrap] = useState<ProviderBootstrap>({ labels: {}, connected: new Set(), order: [] });
  // Starts as loading: the picker must not resolve a default model before every
  // catalog source has been fetched, otherwise a saved pick would be overwritten.
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAllProviderModels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/providers");
      if (!res.ok) {
        setProviderModels([]);
        return;
      }

      const data = await res.json();
      const credentials: any[] = Array.isArray(data.credentials) ? data.credentials : [];
      const registry: any[] = Array.isArray(data.providers) ? data.providers : [];

      const labels: Record<string, string> = {};
      registry.forEach((p) => {
        labels[p.id] = p.label || getProviderLabel(p.id);
      });

      const connectedIds = Array.from(
        new Set(
          credentials
            .filter((c) => !c.status || c.status === "active")
            .map((c) => c.provider)
        )
      );
      const connected = new Set<string>(connectedIds);
      setBootstrap({ labels, connected, order: registry.map((p) => p.id) });

      // 1. Live catalogs for connected providers.
      const liveResults: UnifiedModel[] = [];
      await Promise.all(
        registry
          .map((p) => p.id)
          .filter((id: string) => connected.has(id))
          .map(async (providerId: string) => {
            try {
              const mRes = await authFetch(`/api/providers/${providerId}/models`);
              if (!mRes.ok) return;
              const mData = await mRes.json();
              const list: any[] = Array.isArray(mData.models) ? mData.models : [];
              list.forEach((m) => {
                if (m.isEnabled === false) return;
                liveResults.push(toUnified(providerId, labels[providerId] || getProviderLabel(providerId), m, false));
              });
            } catch {
              // ignore individual provider error
            }
          })
      );
      setProviderModels(liveResults);

      // 2. Bundled catalog for every provider (fills the gaps, flags key needs).
      try {
        const cRes = await authFetch("/api/catalog");
        if (cRes.ok) {
          const cData = await cRes.json();
          const bundled: UnifiedModel[] = [];
          (cData?.providers || []).forEach((provider: any) => {
            const label = labels[provider.id] || getProviderLabel(provider.id);
            (provider.models || []).forEach((m: any) => {
              bundled.push(toUnified(provider.id, label, { ...m, vendor: provider.vendor }, !connected.has(provider.id)));
            });
          });
          setCatalogModels(bundled);
        }
      } catch {
        setCatalogModels([]);
      }
    } catch {
      setProviderModels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllProviderModels();
  }, [fetchAllProviderModels]);

  // Combine live provider models, bundled catalog models and App models.
  const allModels = useMemo<UnifiedModel[]>(() => {
    const list: UnifiedModel[] = [];
    const seen = new Set<string>();

    const push = (model: UnifiedModel) => {
      if (seen.has(model.uniqueKey)) return;
      seen.add(model.uniqueKey);
      list.push(model);
    };

    providerModels.forEach(push);
    catalogModels.forEach(push);

    const enabledAppModels = appModels.filter((m) => m.enabled && m.kind === "chat");
    enabledAppModels.forEach((m) => {
      const pKey = m.provider === "google" ? "gemini" : (m.provider || "gemini");
      push({
        id: m.api_model_id || m.slug,
        uniqueKey: `${pKey}:${m.api_model_id || m.slug}`,
        provider: pKey,
        providerLabel: labelsFor(pKey, bootstrap.labels),
        displayName: m.display_name,
        alias: null,
        description: m.description,
        contextLength: (m as any).context_length ?? null,
        supportsThinking: Boolean(m.supports_thinking),
        supportsTools: Boolean(m.supports_tools),
        supportsVision: Boolean(m.supports_vision),
        supportsSearch: Boolean(m.supports_search),
        pricing: null,
        isEnabled: true,
        isPinned: false,
        isDefault: Boolean(m.is_default),
        kind: m.kind,
        vendor: (m as any).vendor,
        requiresKey: false,
      });
    });

    return list;
  }, [providerModels, catalogModels, appModels, bootstrap.labels]);

  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allModels;
    return allModels.filter((m) => {
      return (
        m.displayName.toLowerCase().includes(q) ||
        (m.alias && m.alias.toLowerCase().includes(q)) ||
        m.id.toLowerCase().includes(q) ||
        m.providerLabel.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
      );
    });
  }, [allModels, searchQuery]);

  const groupedProviders = useMemo<ProviderGroup[]>(() => {
    const map = new Map<string, UnifiedModel[]>();
    filteredModels.forEach((m) => {
      const groupKey = `${providerOrderIndex(m.provider, bootstrap.order)}::${m.providerLabel}`;
      if (!map.has(groupKey)) map.set(groupKey, []);
      map.get(groupKey)!.push(m);
    });

    const groups: ProviderGroup[] = [];
    [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
      .forEach(([, models]) => {
        const sorted = [...models].sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          const kindRank = (m: UnifiedModel) => (m.kind && m.kind !== "chat" ? 1 : 0);
          if (kindRank(a) !== kindRank(b)) return kindRank(a) - kindRank(b);
          return a.displayName.localeCompare(b.displayName);
        });
        groups.push({
          providerId: sorted[0]?.provider || "app",
          providerLabel: sorted[0]?.providerLabel || "App models",
          models: sorted,
        });
      });

    return groups;
  }, [filteredModels, bootstrap.order]);

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
    if (!activeModelObj) {
      const defaultName = defaultModel?.display_name || "Gemini 3.8 Flash";
      return `${defaultName} · Google AI Studio`;
    }
    const name = activeModelObj.alias || activeModelObj.displayName;
    const suffix = activeModelObj.requiresKey ? " · key needed" : "";
    return `${name} · ${activeModelObj.providerLabel}${suffix}`;
  }, [activeModelObj, defaultModel]);

  return {
    allModels,
    groupedProviders,
    activeModelObj,
    pillLabel,
    searchQuery,
    setSearchQuery,
    loading,
    refresh: fetchAllProviderModels,
  };
}

function labelsFor(providerId: string, labels: Record<string, string>): string {
  return labels[providerId] || getProviderLabel(providerId);
}

/** Numeric sort prefix so provider groups follow the registry order. */
function providerOrderIndex(providerId: string, order: string[]): string {
  const index = order.indexOf(providerId);
  return String(index >= 0 ? index : 900 + order.length).padStart(4, "0");
}
