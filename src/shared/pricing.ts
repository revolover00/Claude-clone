export interface PricingInfo {
  inputPerMTok?: number | null;
  outputPerMTok?: number | null;
  currency?: string | null;
}

/**
 * Formats pricing info:
 * - "Free" when both input and output prices are 0
 * - price per 1M tokens with at most 2 decimals
 * - unknown price shows "—"
 */
export function formatPricing(pricing?: PricingInfo | null): string {
  if (
    !pricing ||
    pricing.inputPerMTok === null ||
    pricing.inputPerMTok === undefined ||
    isNaN(Number(pricing.inputPerMTok))
  ) {
    return "—";
  }

  const input = Number(pricing.inputPerMTok);
  const output = Number(pricing.outputPerMTok ?? input);

  if (input === 0 && output === 0) {
    return "Free";
  }

  const formatAmount = (num: number): string => {
    const fixed = num.toFixed(2);
    const trimmed = fixed.replace(/\.?0+$/, "");
    return `$${trimmed}`;
  };

  if (pricing.outputPerMTok === null || pricing.outputPerMTok === undefined || input === output) {
    return `${formatAmount(input)} / 1M`;
  }

  return `${formatAmount(input)} / ${formatAmount(output)} / 1M`;
}
