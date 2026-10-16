import { formatPricing, type PricingInfo } from "../../shared/pricing";
import { cn } from "../../utils/cn";

interface Props {
  /** Per-1M-token price row from the catalog (null = provider did not publish one). */
  pricing?: PricingInfo | null;
  /** Server-computed: input and output price are both 0. */
  isFree?: boolean;
  /** The provider gives every model a standing free tier (rate-limited). */
  freeTier?: boolean;
  className?: string;
}

/**
 * The "free or paid?" label shown next to every model in pickers and lists:
 * - green **Free** pill when the model itself costs nothing,
 * - teal **Free tier** pill on free-tier providers (their list price applies
 *   beyond the free limits — hover shows it),
 * - otherwise the plain per-1M price in mono.
 */
export function PricingBadge({ pricing, isFree, freeTier, className }: Props) {
  const text = formatPricing(pricing);
  const free = Boolean(isFree) || text === "Free";

  if (free) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.2 text-[9.5px] font-semibold text-emerald-400",
          className
        )}
      >
        Free
      </span>
    );
  }

  if (freeTier) {
    return (
      <span
        title={`Free within provider limits — list price ${text}`}
        className={cn(
          "inline-flex items-center rounded border border-teal-500/30 bg-teal-500/15 px-1.5 py-0.2 text-[9.5px] font-semibold text-teal-300 cursor-help",
          className
        )}
      >
        Free tier
      </span>
    );
  }

  return (
    <span className={cn("font-mono text-ink-soft", className)}>
      {pricing ? text : "Variable"}
    </span>
  );
}
