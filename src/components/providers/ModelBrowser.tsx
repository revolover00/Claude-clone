import React, { useMemo, useState } from "react";
import { RefreshCw, Package, Sparkles } from "lucide-react";
import { ModelRow, formatContext } from "./ModelRow";
import { ModelBrowserFilters } from "./ModelBrowserFilters";
import { useCatalogBrowser } from "./useCatalogBrowser";
import { GroupedCatalogList } from "../shared/GroupedCatalogList";
import { SettingsErrorCard } from "../shared/SettingsErrorCard";
import { sortBrowserModels, type CatalogBrowserModel, type CatalogSort } from "./types";

const KIND_ORDER = ["chat", "embedding", "image", "audio", "video", "moderation", "rerank", "other"];

const CHIPS = [
  { id: "recommended", label: "Recommended" },
  { id: "reasoning", label: "Reasoning" },
  { id: "vision", label: "Vision" },
  { id: "tools", label: "Tools" },
  { id: "free", label: "Free" },
  { id: "longContext", label: "Long context 200k+" },
  { id: "preview", label: "Preview" },
] as const;

interface Props {
  onModelsChanged?: () => void;
}

/**
 * Settings > Providers > Models: the full catalog grouped Provider -> Vendor ->
 * Family with collapsible groups, filter chips, search and sort. Models of
 * providers the user has not connected are dimmed with a "Connect <provider>
 * to use" hint; connected models stay selectable and keep per-user prefs
 * (enabled / pinned / alias).
 */
export const ModelBrowser: React.FC<Props> = ({ onModelsChanged }) => {
  const { models, providers, source, loading, refreshing, error, reload, toggleEnabled, togglePinned, updateAlias } =
    useCatalogBrowser();

  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("all");
  const [selectedKind, setSelectedKind] = useState("all");
  const [sort, setSort] = useState<CatalogSort>("recommended");
  const [activeChips, setActiveChips] = useState<string[]>([]);

  const providerLabel = useMemo(() => {
    const map = new Map(providers.map((p) => [p.id, p.label]));
    return (id: string) => map.get(id) || id;
  }, [providers]);

  const providerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    models.forEach((m) => counts.set(m.provider, (counts.get(m.provider) || 0) + 1));
    return counts;
  }, [models]);

  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    models.forEach((m) => counts.set(m.kind || "chat", (counts.get(m.kind || "chat") || 0) + 1));
    return counts;
  }, [models]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = models.filter((m: CatalogBrowserModel) => {
      if (selectedProvider !== "all" && m.provider !== selectedProvider) return false;
      if (selectedKind !== "all" && (m.kind || "chat") !== selectedKind) return false;
      if (activeChips.includes("recommended") && !m.recommended) return false;
      if (activeChips.includes("reasoning") && !m.supports_reasoning) return false;
      if (activeChips.includes("vision") && !m.supports_vision) return false;
      if (activeChips.includes("tools") && !m.supports_tools) return false;
      if (activeChips.includes("free") && !m.is_free) return false;
      if (activeChips.includes("longContext") && (m.context_length || 0) < 200_000) return false;
      if (activeChips.includes("preview") && m.status !== "preview") return false;
      if (!q) return true;
      return `${m.name} ${m.model_id} ${m.alias || ""} ${m.vendor} ${m.family}`.toLowerCase().includes(q);
    });
    list = sortBrowserModels(list, sort);
    return list;
  }, [models, search, selectedProvider, selectedKind, activeChips, sort]);

  const largestContext = filtered.reduce((max, m) => Math.max(max, m.context_length || 0), 0);
  const connectedCount = providers.filter((p) => p.connected).length;

  const toggleChip = (id: string) => {
    setActiveChips((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
    onModelsChanged?.();
  };

  const handleRefresh = () => {
    void reload({ refresh: true });
    onModelsChanged?.();
  };

  return (
    <div className="space-y-4 pt-4 border-t border-line">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <h4 className="text-[14.5px] font-semibold text-ink">Model Catalog</h4>
          <p className="text-[12px] text-ink-muted">
            Every model of every provider, grouped Provider → Vendor → Family. Connected models are selectable; others are dimmed
            until you connect their provider.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-ink-muted">
            <span className="inline-flex items-center gap-1 rounded border border-line bg-elev-1 px-1.5 py-0.5">
              <Package size={11} /> {providers.length} providers
            </span>
            <span className="rounded border border-line bg-elev-1 px-1.5 py-0.5 font-mono">{models.length} models</span>
            <span className="rounded border border-line bg-elev-1 px-1.5 py-0.5">{connectedCount} connected</span>
            <span className="inline-flex items-center gap-1 rounded border border-line bg-elev-1 px-1.5 py-0.5">
              <Sparkles size={11} /> {source === "bundled" ? "bundled snapshot" : "synced catalog"}
            </span>
            {largestContext > 0 && (
              <span className="rounded border border-line bg-elev-1 px-1.5 py-0.5">largest context {formatContext(largestContext)}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-elev-1 text-[12px] text-ink-soft hover:text-ink hover:bg-elev-2 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      <ModelBrowserFilters
        providers={[
          { id: "all", label: "All providers", count: models.length },
          ...providers.map((p) => ({ id: p.id, label: p.label, count: providerCounts.get(p.id) || 0 })),
        ]}
        selectedProvider={selectedProvider}
        onSelectProvider={setSelectedProvider}
        kinds={[
          { id: "all", label: "All kinds", count: models.length },
          ...KIND_ORDER.filter((k) => kindCounts.has(k)).map((k) => ({ id: k, label: `${k[0].toUpperCase()}${k.slice(1)}`, count: kindCounts.get(k) || 0 })),
        ]}
        selectedKind={selectedKind}
        onSelectKind={setSelectedKind}
        chips={CHIPS.map((c) => ({ ...c, active: activeChips.includes(c.id) }))}
        onToggleChip={toggleChip}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={(value) => setSort(value as CatalogSort)}
      />

      {error && (
        <div className="my-2">
          <SettingsErrorCard onRetry={() => reload()} error={error} />
        </div>
      )}

      <GroupedCatalogList
        models={filtered}
        loading={loading}
        emptyMessage="No models match the selected filters."
        viewportHeight={440}
        rowHeight={112}
        renderRow={(model) => (
          <ModelRow
            model={model as CatalogBrowserModel}
            providerLabel={providerLabel((model as CatalogBrowserModel).provider)}
            onToggleEnabled={toggleEnabled}
            onTogglePinned={togglePinned}
            onUpdateAlias={updateAlias}
          />
        )}
      />

      <p className="text-[11px] text-ink-muted text-right">
        Showing {filtered.length} of {models.length} models
      </p>
    </div>
  );
};
