import type { CatalogEntry, CatalogModel, CatalogPricing, CatalogStatus } from "./types";

export interface CapabilityFlags {
  supportsTools: boolean;
  supportsReasoning: boolean;
  supportsStructuredOutput: boolean;
  supportsTemperature: boolean;
  openWeights: boolean;
}

/** Decodes the compact capability letter string used in catalog rows. */
export function decodeCaps(caps: string): CapabilityFlags {
  const letters = caps || "";
  return {
    supportsTools: letters.includes("t"),
    supportsReasoning: letters.includes("r"),
    supportsStructuredOutput: letters.includes("s"),
    supportsTemperature: letters.includes("T"),
    openWeights: letters.includes("w"),
  };
}

function decodePricing(price: CatalogEntry["price"]): CatalogPricing | null {
  if (!price || price.length < 2) return null;
  const [input, output, cacheRead] = price;
  if (typeof input !== "number" || typeof output !== "number") return null;
  return {
    inputPerMTok: input,
    outputPerMTok: output,
    cacheReadPerMTok: typeof cacheRead === "number" && cacheRead > 0 ? cacheRead : null,
    currency: "USD",
  };
}

function toList(value: string): string[] {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function orNull(value: string): string | null {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Turns a compact catalog row into the fully decoded model shape. */
export function decodeEntry(providerId: string, entry: CatalogEntry): CatalogModel {
  const inputModalities = toList(entry.in).length > 0 ? toList(entry.in) : ["text"];
  const outputModalities = toList(entry.outMod).length > 0 ? toList(entry.outMod) : ["text"];
  const caps = decodeCaps(entry.caps);

  return {
    provider: providerId,
    id: entry.id,
    name: entry.name || entry.id,
    family: orNull(entry.family),
    kind: entry.kind,
    contextLength: typeof entry.ctx === "number" && entry.ctx > 0 ? entry.ctx : null,
    maxOutputTokens: typeof entry.out === "number" && entry.out > 0 ? entry.out : null,
    inputModalities,
    outputModalities,
    supportsTools: caps.supportsTools,
    supportsReasoning: caps.supportsReasoning,
    supportsStructuredOutput: caps.supportsStructuredOutput,
    supportsTemperature: caps.supportsTemperature,
    supportsVision: inputModalities.includes("image"),
    openWeights: caps.openWeights,
    pricing: decodePricing(entry.price),
    releaseDate: orNull(entry.release),
    lastUpdated: orNull(entry.updated),
    knowledgeCutoff: orNull(entry.knowledge),
    status: (entry.status as CatalogStatus) || null,
    source: "bundled",
  };
}
