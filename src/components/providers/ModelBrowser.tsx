import React, { useMemo, useRef, useState } from "react";
import { RefreshCw, Package, KeyRound, ExternalLink } from "lucide-react";
import { ModelRow, formatContext } from "./ModelRow";
import { ModelBrowserFilters } from "./ModelBrowserFilters";
import { useProviderCatalog } from "./useProviderCatalog";
import { kindLabel, type ProviderModelItem } from "./types";
import { SettingsErrorCard } from "../shared/SettingsErrorCard";

const ROW_HEIGHT = 104;
const VIEWPORT_HEIGHT = 440;

const KIND_ORDER = ["chat", "embedding", "image", "audio", "video", "rerank", "moderation", "other"];

interface Props {
  onModelsChanged?: () => void;
}

/**
 * Settings model browser.
 *
 * Shows the complete bundled catalog — every provider with every model it offers
 * and its details (context window, pricing, modalities, capabilities, dates) —
 * and overlays live provider data plus per-user preferences (enabled/pinned/alias).
 */
export const ModelBrowser: React.FC<Props> = ({ onModelsChanged }) => {
  const {
    providers,
    allModels,
    stats,
    loading,
    refreshing,
    error,
    reload,
    toggleEnabled,
    togglePinned,
    updateAlias,
    bulkEnable,
  } = useProviderCatalog();

  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("all");
  const [selectedKind, setSelectedKind] = useState("all");
  const [filterReasoning, setFilterReasoning] = useState(false);
  const [filterTools, setFilterTools] = useState(false);
  const [filterVision, setFilterVision] = useState(false);
  const [filterEnabledOnly, setFilterEnabledOnly] = useState(false);
  const [filterPinnedOnly, setFilterPinnedOnly] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const providerTabs = useMemo(
    () => [
      { id: "all", label: "All providers", count: allModels.length },
      ...providers.map((p) => ({ id: p.id, label: p.label, count: p.models.length })),
    ],
    [providers, allModels.length]
  );

  const kindTabs = useMemo(() => {
    const counts = new Map<string, number>();
    allModels.forEach((m) => counts.set(m.kind || "chat", (counts.get(m.kind || "chat") || 0) + 1));
    const entries = KIND_ORDER.filter((k) => counts.has(k)).map((k) => ({
      id: k,
      label: kindLabel(k),
      count: counts.get(k) || 0,
    }));
    return [{ id: "all", label: "All kinds", count: allModels.length }, ...entries];
  }, [allModels]);

  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allModels.filter((m) => {
      if (selectedProvider !== "all" && m.provider !== selectedProvider) return false;
      if (selectedKind !== "all" && (m.kind || "chat") !== selectedKind) return false;
      if (filterReasoning && !m.supportsReasoning) return false;
      if (filterTools && !m.supportsTools) return false;
      if (filterVision && !m.supportsVision) return false;
      if (filterEnabledOnly && !m.isEnabled) return false;
      if (filterPinnedOnly && !m.isPinned) return false;
      if (!q) return true;
      return (
        m.displayName?.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.alias || "").toLowerCase().includes(q) ||
        (m.family || "").toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q) ||
        (m.provider || "").toLowerCase().includes(q)
      );
    });
  }, [allModels, search, selectedProvider, selectedKind, filterReasoning, filterTools, filterVision, filterEnabledOnly, filterPinnedOnly]);

  const selectedProviderView = providers.find((p) => p.id === selectedProvider);
  const largestContext = filteredModels.reduce((max, m) => Math.max(max, m.contextLength || 0), 0);

  const handleRefresh = async () => {
    await reload({ refresh: true });
    onModelsChanged?.();
  };

  const handleBulk = (enable: boolean) => {
    bulkEnable(filteredModels, enable);
    onModelsChanged?.();
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
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <h4 className="text-[14.5px] font-semibold text-ink">Model Catalog</h4>
          <p className="text-[12px] text-ink-muted">
            Every model of every supported provider, installed with the app — no manual entry needed. Live
            catalogs are merged on top whenever a provider key is connected.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-ink-muted">
            <span className="inline-flex items-center gap-1 rounded border border-line bg-elev-1 px-1.5 py-0.5">
              <Package size={11} /> {stats.providerCount} providers
            </span>
            <span className="rounded border border-line bg-elev-1 px-1.5 py-0.5 font-mono">{stats.modelCount} models</span>
            <span className="rounded border border-line bg-elev-1 px-1.5 py-0.5">
              {stats.connectedCount} connected
            </span>
            {stats.snapshotDate && (
              <span className="rounded border border-line bg-elev-1 px-1.5 py-0.5">catalog snapshot {stats.snapshotDate}</span>
            )}
            {largestContext > 0 && (
              <span className="rounded border border-line bg-elev-1 px-1.5 py-0.5">
                largest context {formatContext(largestContext)}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-elev-1 text-[12px] text-ink-soft hover:text-ink hover:bg-elev-2 transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          <span>Sync live</span>
        </button>
      </div>

      <ModelBrowserFilters
        providers={providerTabs}
        selectedProvider={selectedProvider}
        onSelectProvider={setSelectedProvider}
        search={search}
        onSearchChange={setSearch}
        kinds={kindTabs}
        selectedKind={selectedKind}
        onSelectKind={setSelectedKind}
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
        onBulkEnable={handleBulk}
      />

      {selectedProviderView && (
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink-muted rounded-lg border border-line bg-elev-1 px-2.5 py-1.5">
          <span className="font-medium text-ink">{selectedProviderView.label}</span>
          <span>· {selectedProviderView.vendor}</span>
          <span>· {selectedProviderView.models.length} models</span>
          <span>· {selectedProviderView.source === "live" ? "live catalog merged" : "bundled catalog"}</span>
          {selectedProviderView.connected ? (
            <span className="text-emerald-400">key connected</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-400">
              <KeyRound size={11} /> add a key to run these models
            </span>
          )}
          {selectedProviderView.liveError && <span className="text-danger">live sync failed: {selectedProviderView.liveError}</span>}
          {selectedProviderView.keyHelpUrl && (
            <a
              href={selectedProviderView.keyHelpUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-accent hover:underline"
            >
              Get key <ExternalLink size={11} />
            </a>
          )}
          {selectedProviderView.docsUrl && (
            <a href={selectedProviderView.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              Docs <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}

      {error && (
        <div className="my-2">
          <SettingsErrorCard onRetry={() => reload()} error={error} />
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={(e) => setScrollTop((e.target as HTMLElement).scrollTop)}
        style={{ height: VIEWPORT_HEIGHT }}
        className="overflow-y-auto rounded-xl border border-line bg-panel p-2 scroll-slim"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-muted animate-pulse">
            Loading the bundled model catalog...
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-muted">
            No models match the selected filters.
          </div>
        ) : (
          <div>
            <div style={{ height: topPadding }} />
            <div className="space-y-2">
              {visibleItems.map((m: ProviderModelItem) => (
                <ModelRow
                  key={`${m.provider}:${m.id}`}
                  model={m}
                  onToggleEnabled={toggleEnabled}
                  onTogglePinned={togglePinned}
                  onUpdateAlias={updateAlias}
                />
              ))}
            </div>
            <div style={{ height: bottomPadding }} />
          </div>
        )}
      </div>

      <p className="text-[11px] text-ink-muted text-right">
        Showing {filteredModels.length} of {allModels.length} models
      </p>
    </div>
  );
};
