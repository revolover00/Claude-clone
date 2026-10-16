import React, { useState } from "react";
import { Pin, Brain, Wrench, Eye, Edit2, Check, X, KeyRound, Package, Sparkles } from "lucide-react";
import { cn } from "../../utils/cn";
import { formatPricing } from "../../shared/pricing";
import { kindLabel, type ProviderModelItem } from "./types";

export type { ProviderModelItem } from "./types";

interface ModelRowProps {
  model: ProviderModelItem;
  onToggleEnabled: (model: ProviderModelItem) => void;
  onTogglePinned: (model: ProviderModelItem) => void;
  onUpdateAlias: (model: ProviderModelItem, alias: string) => void;
}

export function formatContext(tokens: number | null | undefined): string {
  if (!tokens) return "N/A";
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`;
  return `${tokens}`;
}

export const ModelRow: React.FC<ModelRowProps> = ({
  model,
  onToggleEnabled,
  onTogglePinned,
  onUpdateAlias,
}) => {
  const [editingAlias, setEditingAlias] = useState(false);
  const [aliasValue, setAliasValue] = useState(model.alias || "");

  const handleSaveAlias = () => {
    onUpdateAlias(model, aliasValue.trim());
    setEditingAlias(false);
  };

  return (
    <div
      className={cn(
        "group flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl border border-line bg-elev-1 transition-all duration-150 hover:border-line-hover",
        !model.isEnabled && "opacity-55 bg-elev-1/50"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onTogglePinned(model)}
            title={model.isPinned ? "Unpin model" : "Pin model to top"}
            className={cn(
              "p-1 rounded-md transition-colors cursor-pointer",
              model.isPinned ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20" : "text-ink-muted hover:text-ink hover:bg-elev-2"
            )}
          >
            <Pin size={13} className={model.isPinned ? "fill-amber-400" : ""} />
          </button>

          {editingAlias ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={aliasValue}
                onChange={(e) => setAliasValue(e.target.value)}
                placeholder="Custom alias"
                className="h-6 px-2 text-xs rounded border border-line bg-elev-2 text-ink focus:outline-none focus:border-accent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveAlias();
                  if (e.key === "Escape") setEditingAlias(false);
                }}
              />
              <button type="button" onClick={handleSaveAlias} className="text-accent hover:opacity-80 p-0.5" aria-label="Save alias">
                <Check size={14} />
              </button>
              <button type="button" onClick={() => setEditingAlias(false)} className="text-ink-muted hover:text-ink p-0.5" aria-label="Cancel alias">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[13.5px] font-semibold text-ink truncate max-w-[240px]">
                {model.alias || model.displayName || model.id}
              </span>
              {model.alias && (
                <span className="text-[11px] text-ink-muted truncate max-w-[150px]">
                  ({model.displayName || model.id})
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setAliasValue(model.alias || "");
                  setEditingAlias(true);
                }}
                title="Edit custom alias"
                className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-ink transition-opacity p-0.5"
                aria-label="Edit custom alias"
              >
                <Edit2 size={11} />
              </button>
            </div>
          )}

          <span className="text-[10.5px] font-mono text-ink-faint truncate max-w-[260px]">{model.id}</span>

          <span className="text-[10.5px] uppercase font-mono px-1.5 py-0.5 rounded bg-elev-2 text-ink-muted border border-line">
            {model.provider}
          </span>

          {model.kind && model.kind !== "chat" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-line text-ink-muted">{kindLabel(model.kind)}</span>
          )}

          <span
            title={model.source === "live" ? "Fetched live from the provider" : "From the bundled catalog snapshot"}
            className={cn(
              "inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border",
              model.source === "live"
                ? "border-emerald-500/25 text-emerald-400 bg-emerald-500/10"
                : "border-line text-ink-muted bg-elev-2"
            )}
          >
            {model.source === "live" ? <Sparkles size={9} /> : <Package size={9} />}
            {model.source === "live" ? "live" : "catalog"}
          </span>

          {model.requiresKey && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/25 text-amber-400 bg-amber-500/10">
              <KeyRound size={9} /> key needed
            </span>
          )}

          {(model.status === "deprecated" || model.status === "alpha") && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-danger/25 text-danger bg-danger-bg">{model.status}</span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11.5px] text-ink-muted">
          <span className="font-mono text-ink-soft">{formatContext(model.contextLength)} ctx</span>
          <span>•</span>
          <span className="font-mono text-ink-soft">{formatPricing(model.pricing)}</span>
          <span>•</span>
          <span>{model.inputModalities?.join(", ") || "text"}</span>
          {model.maxOutputTokens ? (
            <>
              <span>•</span>
              <span>max out {formatContext(model.maxOutputTokens)}</span>
            </>
          ) : null}
          {model.knowledgeCutoff ? (
            <>
              <span>•</span>
              <span>knowledge {model.knowledgeCutoff}</span>
            </>
          ) : null}
          {model.releaseDate ? (
            <>
              <span>•</span>
              <span>released {model.releaseDate}</span>
            </>
          ) : null}

          <div className="flex items-center gap-1 ml-auto md:ml-2">
            {model.supportsReasoning && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Brain size={10} /> Reasoning
              </span>
            )}
            {model.supportsTools && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Wrench size={10} /> Tools
              </span>
            )}
            {model.supportsVision && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Eye size={10} /> Vision
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onToggleEnabled(model)}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
            model.isEnabled ? "bg-accent" : "bg-elev-3"
          )}
          role="switch"
          aria-checked={model.isEnabled}
          aria-label={`${model.isEnabled ? "Disable" : "Enable"} ${model.displayName || model.id}`}
        >
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
              model.isEnabled ? "translate-x-4" : "translate-x-0"
            )}
          />
        </button>
      </div>
    </div>
  );
};
