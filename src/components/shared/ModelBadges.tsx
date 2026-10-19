import { Sparkles, EyeOff, Rocket, AlertTriangle, Trash2, ThumbsUp } from "lucide-react";
import { isNewModel, isUnavailableStatus, modelStatus, type GroupableModel } from "../../shared/catalog/grouping";

interface Props {
  model: GroupableModel;
  hidden?: boolean;
}

/** Lifecycle badges: New (first seen in 14 days), Preview, Deprecated/Removed, Recommended. Pricing lives in <PricingBadge>. */
export function ModelBadges({ model, hidden }: Props) {
  const status = modelStatus(model);
  return (
    <>
      {isNewModel(model.first_seen_at) && (
        <span className="inline-flex items-center gap-0.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.2 text-[9.5px] font-semibold text-emerald-400">
          <Sparkles size={9} /> New
        </span>
      )}
      {status === "preview" && (
        <span className="inline-flex items-center gap-0.5 rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.2 text-[9.5px] font-semibold text-sky-300">
          <Rocket size={9} /> Preview
        </span>
      )}
      {status === "deprecated" && (
        <span className="inline-flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.2 text-[9.5px] font-semibold text-amber-400">
          <AlertTriangle size={9} /> Deprecated
        </span>
      )}
      {status === "removed" && (
        <span className="inline-flex items-center gap-0.5 rounded border border-danger/30 bg-danger-bg px-1.5 py-0.2 text-[9.5px] font-semibold text-danger">
          <Trash2 size={9} /> Removed
        </span>
      )}
      {model.recommended && (
        <span className="inline-flex items-center gap-0.5 rounded border border-accent/30 bg-accent/10 px-1.5 py-0.2 text-[9.5px] font-semibold text-accent">
          <ThumbsUp size={9} /> Recommended
        </span>
      )}
      {hidden && (
        <span className="inline-flex items-center gap-0.5 rounded border border-danger/25 bg-danger-bg px-1.5 py-0.2 text-[9.5px] font-semibold text-danger">
          <EyeOff size={9} /> Hidden
        </span>
      )}
      {isUnavailableStatus(model) && (
        <span className="sr-only">This model is no longer available</span>
      )}
    </>
  );
}
