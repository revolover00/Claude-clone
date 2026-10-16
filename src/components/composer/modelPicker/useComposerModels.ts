import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useModels } from "../../../hooks/useModels";
import { authFetch } from "../../../utils/safeFetch";
import { composerSections, type PickerSection } from "../../../shared/catalog/grouping";
import type { UnifiedModel } from "./types";

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

function labelFor(labels: Record<string, string>, providerId: string): string {
  return labels[providerId] || getProviderLabel(providerId);
}

function pushUnique(list: UnifiedModel[], seen: Set<string>, model: UnifiedModel) {
  if (seen.has(model.uniqueKey)) return;
  seen.add(model.uniqueKey);
  list.push(model);
}

/** Flat GET /api/catalog row -> UnifiedModel (connected flag drives requiresKey). */
function fromCatalogRow(m: any, labels: Record<string, string>): UnifiedModel {
  const provider = String(m.provider || "unknown");
  return {
    id: m.model_id,
    uniqueKey: `${provider}:${m.model_id}`,
    provider,
    providerLabel: labelFor(labels, provider),
    displayName: m.alias || m.display_name || m.name || m.model_id,
    alias: m.alias || null,
    description: m.description || null,
    contextLength: m.context_length ?? null,
    family: m.family ?? null,
    vendor: m.vendor ?? null,
    status: m.status || "active",
    recommended: Boolean(m.recommended),
    releasedAt: m.released_at ?? null,
    firstSeenAt: m.first_seen_at ?? null,
    isFree: Boolean(m.is_free),
    supportsThinking: Boolean(m.supports_reasoning),
    supportsTools: Boolean(m.supports_tools),
    supportsVision: Boolean(m.supports_vision),
    supportsSearch: provider === "gemini" || provider === "google",
    pricing: m.pricing || null,
    isEnabled: m.enabled !== false,
    isPinned: Boolean(m.pinned),
    kind: m.kind || "chat",
    requiresKey: m.connected === false,
  };
}

/** Legacy grouped /api/catalog payload row -> UnifiedModel. */
function fromLegacyRow(providerId: string, label: string, m: any, requiresKey: boolean): UnifiedModel {
  return {
    id: m.id,
    uniqueKey: `${providerId}:${m.id}`,
    provider: providerId,
    providerLabel: label,
    displayName: m.displayName || m.name || m.id,
    alias: m.alias || null,
    description: m.description || null,
    contextLength: m.contextLength ?? null,
    family: m.family ?? null,
    vendor: m.vendor ?? null,
    status: m.status || "active",
    recommended: Boolean(m.recommended),
    supportsThinking: Boolean(m.supportsReasoning || m.supports_thinking),
    supportsTools: Boolean(m.supportsTools || m.supports_tools),
    supportsVision: Boolean(m.supportsVision || m.supports_vision),
    supportsSearch: Boolean(m.supportsSearch || m.supports_search),
    pricing: m.pricing || null,
    isEnabled: m.isEnabled !== false,
    isPinned: Boolean(m.isPinned),
    kind: m.kind || "chat",
    requiresKey,
  };
}

/**
 * Composer model picker data: live catalogs for connected providers, the full
 * catalog (every provider, connected or not) and the app's own Gemini list.
 * Sections are ordered Recommended -> pinned -> provider/vendor groups.
 */
export function useComposerModels(selectedModelId: string) {
  const { models: appModels, defaultModel, normalizeSlug } = useModels();
  const [liveModels, setLiveModels] = useState<UnifiedModel[]>([]);
  const [catalogModels, setCatalogModels] = useState<UnifiedModel[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const labelsRef = useRef<Record<string, string>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allModels;
    return allModels.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        (m.alias && m.alias.toLowerCase().includes(q)) ||
        m.id.toLowerCase().includes(q) ||
        m.providerLabel.toLowerCase().includes(q) ||
        (m.family || "").toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
    );
  }, [allModels, searchQuery]);

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
    sections,
    activeModelObj,
    pillLabel,
    searchQuery,
    setSearchQuery,
    loading,
    refresh: fetchAllProviderModels,
    labelFor: (providerId: string) => labelFor(labels, providerId),
  };
}
