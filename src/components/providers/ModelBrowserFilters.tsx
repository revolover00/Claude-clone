import React from "react";
import { Search, Filter, CheckSquare, XSquare } from "lucide-react";

export interface FilterProps {
  providers: Array<{ id: string; label: string }>;
  selectedProvider: string;
  onSelectProvider: (p: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
  filterReasoning: boolean;
  onToggleReasoning: () => void;
  filterTools: boolean;
  onToggleTools: () => void;
  filterVision: boolean;
  onToggleVision: () => void;
  filterPinnedOnly: boolean;
  onTogglePinnedOnly: () => void;
  filterEnabledOnly: boolean;
  onToggleEnabledOnly: () => void;
  onBulkEnable: (enable: boolean) => void;
}

export const ModelBrowserFilters: React.FC<FilterProps> = ({
  providers,
  selectedProvider,
  onSelectProvider,
  search,
  onSearchChange,
  filterReasoning,
  onToggleReasoning,
  filterTools,
  onToggleTools,
  filterVision,
  onToggleVision,
  filterPinnedOnly,
  onTogglePinnedOnly,
  filterEnabledOnly,
  onToggleEnabledOnly,
  onBulkEnable,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 bg-elev-1 p-1 rounded-lg border border-line shrink-0 overflow-x-auto">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectProvider(p.id)}
              className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                selectedProvider === p.id ? "bg-elev-3 text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, ID, or description..."
            className="w-full h-8 pl-8 pr-3 text-[12.5px] rounded-lg border border-line bg-elev-1 text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11.5px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-ink-muted flex items-center gap-1 mr-1">
            <Filter size={11} /> Filters:
          </span>
          <button
            type="button"
            onClick={onToggleReasoning}
            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              filterReasoning ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-elev-1 text-ink-muted border-line hover:text-ink"
            }`}
          >
            Reasoning
          </button>
          <button
            type="button"
            onClick={onToggleTools}
            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              filterTools ? "bg-blue-500/20 text-blue-300 border-blue-500/40" : "bg-elev-1 text-ink-muted border-line hover:text-ink"
            }`}
          >
            Tools
          </button>
          <button
            type="button"
            onClick={onToggleVision}
            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              filterVision ? "bg-purple-500/20 text-purple-300 border-purple-500/40" : "bg-elev-1 text-ink-muted border-line hover:text-ink"
            }`}
          >
            Vision
          </button>
          <button
            type="button"
            onClick={onTogglePinnedOnly}
            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              filterPinnedOnly ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-elev-1 text-ink-muted border-line hover:text-ink"
            }`}
          >
            Pinned Only
          </button>
          <button
            type="button"
            onClick={onToggleEnabledOnly}
            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              filterEnabledOnly ? "bg-accent/20 text-accent border-accent/40" : "bg-elev-1 text-ink-muted border-line hover:text-ink"
            }`}
          >
            Enabled Only
          </button>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => onBulkEnable(true)}
            className="flex items-center gap-1 px-2 py-1 rounded border border-line bg-elev-1 text-ink-muted hover:text-ink hover:bg-elev-2 transition-colors cursor-pointer"
          >
            <CheckSquare size={12} /> Enable All
          </button>
          <button
            type="button"
            onClick={() => onBulkEnable(false)}
            className="flex items-center gap-1 px-2 py-1 rounded border border-line bg-elev-1 text-ink-muted hover:text-ink hover:bg-elev-2 transition-colors cursor-pointer"
          >
            <XSquare size={12} /> Disable All
          </button>
        </div>
      </div>
    </div>
  );
};
