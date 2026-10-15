import { describe, it, expect } from "vitest";
import { formatPricing } from "../src/shared/pricing";

describe("formatPricing", () => {
  it("shows '—' when pricing is unknown, null, or undefined", () => {
    expect(formatPricing(null)).toBe("—");
    expect(formatPricing(undefined)).toBe("—");
    expect(formatPricing({} as any)).toBe("—");
    expect(formatPricing({ inputPerMTok: null })).toBe("—");
  });

  it("shows 'Free' when both input and output prices are 0", () => {
    expect(formatPricing({ inputPerMTok: 0, outputPerMTok: 0 })).toBe("Free");
    expect(formatPricing({ inputPerMTok: 0 })).toBe("Free");
  });

  it("shows price per 1M tokens with at most 2 decimals", () => {
    expect(formatPricing({ inputPerMTok: 3, outputPerMTok: 15 })).toBe("$3 / $15 / 1M");
    expect(formatPricing({ inputPerMTok: 0.125, outputPerMTok: 0.5 })).toBe("$0.13 / $0.5 / 1M");
    expect(formatPricing({ inputPerMTok: 2.5, outputPerMTok: 2.5 })).toBe("$2.5 / 1M");
    expect(formatPricing({ inputPerMTok: 0.75 })).toBe("$0.75 / 1M");
  });
});
