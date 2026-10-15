import React from "react";
import { Check, Brain, Layers, Globe, Eye, Pin } from "lucide-react";
import { cn } from "../../../utils/cn";
import { formatPricing } from "../../../shared/pricing";
import type { UnifiedModel } from "./types";

interface Props {
  model: UnifiedModel;
  isSelected: boolean;
  onSelect: (modelKey: string) => void;
}

export const ModelPickerItem: React.FC<Props> = ({
  model,
  isSelected,
  onSelect,
}) => {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={isSelected}
      onClick={() => onSelect(model.uniqueKey)}
      className={cn(
        "flex w-full items-start justify-between rounded-lg p-2 text-start transition-colors cursor-pointer",
        isSelected
          ? "bg-elev-2 text-ink"
          : "text-ink-soft hover:bg-elev-2 hover:text-ink"
      )}
    >
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {model.isPinned && (
            <Pin size={11} className="text-amber-400 fill-amber-400 shrink-0" />
          )}
          <span className="text-[13px] font-semibold truncate">
            {model.alias || model.displayName}
          </span>
          {model.alias && (
            <span className="text-[11px] text-ink-muted truncate">
              ({model.displayName})
            </span>
          )}
        </div>

        {/* Pricing / context */}
        {(model.contextLength || model.pricing) && (
          <div className="flex items-center gap-1.5 text-[10.5px] text-ink-muted mt-0.5 font-mono">
            {model.contextLength && (
              <span>{Math.round(model.contextLength / 1000)}k ctx</span>
            )}
            {model.pricing && (
              <span>• {formatPricing(model.pricing)}</span>
            )}
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {model.supportsThinking && (
            <span
              title="Thinking"
              className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9.5px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20"
            >
              <Brain size={9} />
              Thinking
            </span>
          )}
          {model.supportsTools && (
            <span
              title="Tools"
              className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9.5px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/20"
            >
              <Layers size={9} />
              Tools
            </span>
          )}
          {model.supportsSearch && (
            <span
              title="Search"
              className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9.5px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/20"
            >
              <Globe size={9} />
              Search
            </span>
          )}
          {model.supportsVision && (
            <span
              title="Vision"
              className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9.5px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
            >
              <Eye size={9} />
              Vision
            </span>
          )}
        </div>

        {model.description && (
          <p className="text-[11.5px] text-ink-muted leading-tight mt-1 line-clamp-2">
            {model.description}
          </p>
        )}
      </div>

      {isSelected && (
        <Check size={14} className="text-accent shrink-0 mt-1" />
      )}
    </button>
  );
};
