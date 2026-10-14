import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { ModelRow, type ProviderModelItem } from "./ModelRow";
import { ModelBrowserFilters } from "./ModelBrowserFilters";
import { useToast } from "../../context/ToastContext";

interface Props {
  onModelsChanged?: () => void;
}

const PROVIDERS = [
  { id: "all", label: "All Providers" },
  { id: "gemini", label: "Google" },
  { id: "groq", label: "Groq" },
  { id: "openrouter", label: "OpenRouter" },
];

const ROW_HEIGHT = 80;
const VIEWPORT_HEIGHT = 440;

export const ModelBrowser: React.FC<Props> = ({ onModelsChanged }) => {
  const [models, setModels] = useState<ProviderModelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("all");
  const [filterReasoning, setFilterReasoning] = useState(false);
  const [filterTools, setFilterTools] = useState(false);
  const [filterVision, setFilterVision] = useState(false);
  const [filterEnabledOnly, setFilterEnabledOnly] = useState(false);
  const [filterPinnedOnly, setFilterPinnedOnly] = useState(false);

  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const fetchProviderModels = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const providersToFetch = ["gemini", "groq", "openrouter"];
      const allResults: ProviderModelItem[] = [];

      await Promise.all(
        providersToFetch.map(async (pId) => {
          try {
            const url = `/api/providers/${pId}/models${refresh ? "?refresh=1" : ""}`;
            const res = await fetch(url, {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("supabase_token") || "mock-jwt-token-guest"}`,
              },
            });
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.models)) {
                allResults.push(...data.models);
              }
            }
          } catch {
            // Ignore individual provider errors
          }
        })
      );

      setModels(allResults);
      if (refresh) {
        showToast("Model catalogs refreshed successfully", "success");
      }
    } catch (err: any) {
      showToast(`Failed to load models: ${err.message}`, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchProviderModels(false);
  }, [fetchProviderModels]);

  const savePrefs = async (items: Array<{ provider: string; model_id: string; enabled?: boolean; pinned?: boolean; alias?: string }>) => {
    try {
      const res = await fetch("/api/models/prefs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("supabase_token") || "mock-jwt-token-guest"}`,
        },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      onModelsChanged?.();
    } catch (err: any) {
      showToast(`Error saving preferences: ${err.message}`, "error");
    }
  };

  const handleToggleEnabled = (item: ProviderModelItem) => {
    const nextState = !item.isEnabled;
    setModels((prev) =>
      prev.map((m) => (m.provider === item.provider && m.id === item.id ? { ...m, isEnabled: nextState } : m))
    );
    savePrefs([{ provider: item.provider, model_id: item.id, enabled: nextState, pinned: item.isPinned, alias: item.alias || undefined }]);
  };

  const handleTogglePinned = (item: ProviderModelItem) => {
    const nextState = !item.isPinned;
    setModels((prev) =>
      prev.map((m) => (m.provider === item.provider && m.id === item.id ? { ...m, isPinned: nextState } : m))
    );
    savePrefs([{ provider: item.provider, model_id: item.id, enabled: item.isEnabled, pinned: nextState, alias: item.alias || undefined }]);
  };

  const handleUpdateAlias = (item: ProviderModelItem, alias: string) => {
    setModels((prev) =>
      prev.map((m) => (m.provider === item.provider && m.id === item.id ? { ...m, alias: alias || null } : m))
    );
    savePrefs([{ provider: item.provider, model_id: item.id, enabled: item.isEnabled, pinned: item.isPinned, alias }]);
  };

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      if (selectedProvider !== "all" && m.provider !== selectedProvider) return false;
      if (filterReasoning && !m.supportsReasoning) return false;
      if (filterTools && !m.supportsTools) return false;
      if (filterVision && !m.supportsVision) return false;
      if (filterEnabledOnly && !m.isEnabled) return false;
      if (filterPinnedOnly && !m.isPinned) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = m.displayName?.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
        const matchesAlias = m.alias?.toLowerCase().includes(q);
        const matchesDesc = m.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesAlias && !matchesDesc) return false;
      }
      return true;
    });
  }, [models, selectedProvider, filterReasoning, filterTools, filterVision, filterEnabledOnly, filterPinnedOnly, search]);

  const handleBulkEnable = (enable: boolean) => {
    const targetItems = filteredModels.map((m) => ({
      provider: m.provider,
      model_id: m.id,
      enabled: enable,
      pinned: m.isPinned,
      alias: m.alias || undefined,
    }));
    setModels((prev) => {
      const ids = new Set(targetItems.map((t) => `${t.provider}:${t.model_id}`));
      return prev.map((m) => (ids.has(`${m.provider}:${m.id}`) ? { ...m, isEnabled: enable } : m));
    });
    savePrefs(targetItems);
    showToast(`${enable ? "Enabled" : "Disabled"} ${targetItems.length} models`, "info");
  };

  // Virtualization windowing
  const totalCount = filteredModels.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2);
  const endIndex = Math.min(totalCount, startIndex + Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + 4);
  const visibleItems = filteredModels.slice(startIndex, endIndex);
  const topPadding = startIndex * ROW_HEIGHT;
  const bottomPadding = (totalCount - endIndex) * ROW_HEIGHT;

  return (
    <div className="space-y-4 pt-4 border-t border-line">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h4 className="text-[14.5px] font-semibold text-ink">Model Browser</h4>
          <p className="text-[12px] text-ink-muted">
            Search, filter, customize aliases, and pin models to your composer picker.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchProviderModels(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-elev-1 text-[12px] text-ink-soft hover:text-ink hover:bg-elev-2 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <ModelBrowserFilters
        providers={PROVIDERS}
        selectedProvider={selectedProvider}
        onSelectProvider={setSelectedProvider}
        search={search}
        onSearchChange={setSearch}
        filterReasoning={filterReasoning}
        onToggleReasoning={() => setFilterReasoning(!filterReasoning)}
        filterTools={filterTools}
        onToggleTools={() => setFilterTools(!filterTools)}
        filterVision={filterVision}
        onToggleVision={() => setFilterVision(!filterVision)}
        filterPinnedOnly={filterPinnedOnly}
        onTogglePinnedOnly={() => setFilterPinnedOnly(!filterPinnedOnly)}
        filterEnabledOnly={filterEnabledOnly}
        onToggleEnabledOnly={() => setFilterEnabledOnly(!filterEnabledOnly)}
        onBulkEnable={handleBulkEnable}
      />

      {/* Model Virtualized List */}
      <div
        ref={containerRef}
        onScroll={(e) => setScrollTop((e.target as HTMLElement).scrollTop)}
        style={{ height: VIEWPORT_HEIGHT }}
        className="overflow-y-auto rounded-xl border border-line bg-panel p-2 scroll-slim"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-muted animate-pulse">
            Loading model catalogs...
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-muted">
            No models match the selected filters.
          </div>
        ) : (
          <div>
            <div style={{ height: topPadding }} />
            <div className="space-y-2">
              {visibleItems.map((m) => (
                <ModelRow
                  key={`${m.provider}:${m.id}`}
                  model={m}
                  onToggleEnabled={handleToggleEnabled}
                  onTogglePinned={handleTogglePinned}
                  onUpdateAlias={handleUpdateAlias}
                />
              ))}
            </div>
            <div style={{ height: bottomPadding }} />
          </div>
        )}
      </div>
      <p className="text-[11px] text-ink-muted text-right">
        Showing {filteredModels.length} of {models.length} models
      </p>
    </div>
  );
};
