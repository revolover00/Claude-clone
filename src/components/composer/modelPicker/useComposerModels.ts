import { useState, useEffect, useMemo, useCallback } from "react";
import { useModels } from "../../../hooks/useModels";
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

export function useComposerModels(selectedModelId: string) {
  const { models: appModels, defaultModel, normalizeSlug } = useModels();
  const [providerModels, setProviderModels] = useState<UnifiedModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAllProviderModels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/providers", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("supabase_token") || "mock-jwt-token-guest"}`,
        },
      });

      if (!res.ok) {
        setProviderModels([]);
        return;
      }

      const data = await res.json();
      const credentials: any[] = Array.isArray(data.credentials) ? data.credentials : [];
      const connectedProviderIds = Array.from(
        new Set(
          credentials
            .filter((c) => !c.status || c.status === "active")
            .map((c) => c.provider)
        )
      );

      if (connectedProviderIds.length === 0) {
        setProviderModels([]);
        return;
      }

      const results: UnifiedModel[] = [];

      await Promise.all(
        connectedProviderIds.map(async (providerId) => {
          try {
            const mRes = await fetch(`/api/providers/${providerId}/models`, {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("supabase_token") || "mock-jwt-token-guest"}`,
              },
            });
            if (!mRes.ok) return;
            const mData = await mRes.json();
            const list: any[] = Array.isArray(mData.models) ? mData.models : [];

            list.forEach((m) => {
              if (m.isEnabled === false) return;
              results.push({
                id: m.id,
                uniqueKey: `${providerId}:${m.id}`,
                provider: providerId,
                providerLabel: getProviderLabel(providerId),
                displayName: m.displayName || m.name || m.id,
                alias: m.alias || null,
                description: m.description || null,
                contextLength: m.contextLength,
                supportsThinking: Boolean(m.supportsReasoning || m.supports_thinking),
                supportsTools: Boolean(m.supportsTools || m.supports_tools),
                supportsVision: Boolean(m.supportsVision || m.supports_vision),
                supportsSearch: Boolean(m.supportsSearch || m.supports_search),
                pricing: m.pricing || null,
                isEnabled: true,
                isPinned: Boolean(m.isPinned),
                isDefault: false,
              });
            });
          } catch {
            // ignore individual provider error
          }
        })
      );

      setProviderModels(results);
    } catch {
      setProviderModels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllProviderModels();
  }, [fetchAllProviderModels]);

  // Combine provider models with App models
  const allModels = useMemo<UnifiedModel[]>(() => {
    const list: UnifiedModel[] = [...providerModels];
    const existingKeys = new Set(list.map((m) => m.uniqueKey));

    // Convert appModels to UnifiedModel under "App models"
    const enabledAppModels = appModels.filter((m) => m.enabled && m.kind === "chat");
    enabledAppModels.forEach((m) => {
      const pKey = m.provider === "google" ? "gemini" : (m.provider || "gemini");
      const uniqueKey = `${pKey}:${m.api_model_id || m.slug}`;
      if (!existingKeys.has(uniqueKey)) {
        list.push({
          id: m.api_model_id || m.slug,
          uniqueKey,
          provider: pKey,
          providerLabel: getProviderLabel(list.length > 0 ? pKey : "app"),
          displayName: m.display_name,
          alias: null,
          description: m.description,
          contextLength: null,
          supportsThinking: Boolean(m.supports_thinking),
          supportsTools: Boolean(m.supports_tools),
          supportsVision: Boolean(m.supports_vision),
          supportsSearch: Boolean(m.supports_search),
          pricing: null,
          isEnabled: true,
          isPinned: false,
          isDefault: Boolean(m.is_default),
        });
      }
    });

    return list;
  }, [providerModels, appModels]);

  // Filtered by search query
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

  // Grouped under provider headers, pinned first within each group
  const groupedProviders = useMemo<ProviderGroup[]>(() => {
    const map = new Map<string, UnifiedModel[]>();

    filteredModels.forEach((m) => {
      const groupKey = m.providerLabel;
      if (!map.has(groupKey)) {
        map.set(groupKey, []);
      }
      map.get(groupKey)!.push(m);
    });

    const groups: ProviderGroup[] = [];
    map.forEach((models, providerLabel) => {
      // Sort pinned models first
      const sorted = [...models].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return a.displayName.localeCompare(b.displayName);
      });
      groups.push({
        providerId: sorted[0]?.provider || "app",
        providerLabel,
        models: sorted,
      });
    });

    return groups;
  }, [filteredModels]);

  // Find active model object
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

  // Display label for pill: "<alias or display name> · <provider label>"
  const pillLabel = useMemo(() => {
    if (!activeModelObj) {
      const defaultName = defaultModel?.display_name || "Gemini 3.8 Flash";
      return `${defaultName} · Google AI Studio`;
    }
    const name = activeModelObj.alias || activeModelObj.displayName;
    return `${name} · ${activeModelObj.providerLabel}`;
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
