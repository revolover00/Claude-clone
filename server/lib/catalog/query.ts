/**
 * Server-side catalog querying: filters, sorting, cursor pagination and facet
 * counts over normalized CatalogRecord rows. Pure functions, unit-tested in
 * tests/catalogQuery.test.ts.
 */
import type { CatalogRecord, OverrideRecord } from "./types";

export interface CatalogQuery {
  provider?: string;
  kind?: string[];
  vendor?: string[];
  family?: string[];
  capability?: string[];
  status?: string[];
  free?: boolean;
  q?: string;
  sort?: "recommended" | "newest" | "context" | "price";
  cursor?: string;
  limit?: number;
}

export interface OverrideView {
  hidden: boolean;
  force_recommended: boolean;
  alias: string | null;
  is_default?: boolean;
}

/** Merges catalog_overrides onto records; admins keep hidden rows flagged. */
export function mergeOverrides(
  records: CatalogRecord[],
  overrides: OverrideRecord[],
  isAdmin: boolean
): Array<CatalogRecord & { hidden: boolean; alias: string | null; recommended: boolean }> {
  const byKey = new Map(overrides.map((o) => [`${o.provider}:${o.model_id}`, o]));
  const out: Array<CatalogRecord & { hidden: boolean; alias: string | null; recommended: boolean }> = [];
  for (const record of records) {
    const override = byKey.get(`${record.provider}:${record.model_id}`);
    const hidden = Boolean(override?.hidden);
    if (hidden && !isAdmin) continue;
    out.push({
      ...record,
      hidden,
      alias: override?.alias || null,
      recommended: override?.force_recommended ? true : record.is_recommended,
    });
  }
  return out;
}

function matchesQuery(record: any, q: string): boolean {
  if (!q) return true;
  const hay = `${record.model_id} ${record.name} ${record.family} ${record.vendor} ${record.alias || ""}`.toLowerCase();
  return hay.includes(q);
}

export function filterRecords(records: any[], query: CatalogQuery): any[] {
  const q = (query.q || "").trim().toLowerCase();
  const providers = split(query.provider);
  const kinds = splitList(query.kind);
  const vendors = splitList(query.vendor);
  const families = splitList(query.family);
  const capabilities = splitList(query.capability);
  const statuses = splitList(query.status);

  return records.filter((r) => {
    if (providers.length > 0 && !providers.includes(r.provider)) return false;
    if (kinds.length > 0 && !kinds.includes(r.kind)) return false;
    if (vendors.length > 0 && !vendors.includes(r.vendor)) return false;
    if (families.length > 0 && !families.includes(r.family)) return false;
    if (statuses.length > 0 && !statuses.includes(r.status)) return false;
    if (query.free === true && !r.is_free) return false;
    if (query.free === false && r.is_free) return false;
    if (capabilities.length > 0) {
      const has = (cap: string) =>
        cap === "reasoning" ? r.supports_reasoning :
        cap === "tools" ? r.supports_tools :
        cap === "vision" ? r.supports_vision :
        cap === "json" ? r.supports_json : false;
      if (!capabilities.every(has)) return false;
    }
    return matchesQuery(r, q);
  });
}

function split(value?: string): string[] {
  return (value || "").split(",").map((v) => v.trim()).filter((v) => v && v !== "all");
}

function splitList(value?: string[] | string): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return split(typeof value === "string" ? value : undefined);
}

export function sortRecords(records: any[], sort: CatalogQuery["sort"] = "recommended"): any[] {
  const out = [...records];
  const price = (r: any) => (r.pricing && r.pricing.inputPerMTok != null ? r.pricing.inputPerMTok : Number.MAX_SAFE_INTEGER);
  if (sort === "newest") {
    out.sort((a, b) => (b.released_at || "").localeCompare(a.released_at || "") || a.model_id.localeCompare(b.model_id));
  } else if (sort === "context") {
    out.sort((a, b) => (b.context_length || 0) - (a.context_length || 0) || a.model_id.localeCompare(b.model_id));
  } else if (sort === "price") {
    out.sort((a, b) => price(a) - price(b) || a.model_id.localeCompare(b.model_id));
  } else {
    out.sort(
      (a, b) =>
        Number(b.recommended) - Number(a.recommended) ||
        (b.released_at || "").localeCompare(a.released_at || "") ||
        (b.context_length || 0) - (a.context_length || 0) ||
        a.model_id.localeCompare(b.model_id)
    );
  }
  return out;
}

/** Opaque offset cursor. */
export function encodeCursor(offset: number): string {
  return Buffer.from(`o:${offset}`, "utf8").toString("base64url");
}

export function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const offset = Number(raw.replace(/^o:/, ""));
    return Number.isFinite(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}

export function paginate(records: any[], query: CatalogQuery, all = false): { page: any[]; total: number; nextCursor: string | null } {
  if (all) return { page: records, total: records.length, nextCursor: null };
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const offset = decodeCursor(query.cursor);
  const page = records.slice(offset, offset + limit);
  const nextCursor = offset + limit < records.length ? encodeCursor(offset + limit) : null;
  return { page, total: records.length, nextCursor };
}

export interface FacetCounts {
  provider: Record<string, number>;
  vendor: Record<string, number>;
  family: Record<string, number>;
  kind: Record<string, number>;
  capability: Record<string, number>;
  status: Record<string, number>;
}

/** Counts by provider, vendor, family, kind, capability and status. */
export function computeFacets(records: any[]): FacetCounts {
  const facets: FacetCounts = { provider: {}, vendor: {}, family: {}, kind: {}, capability: {}, status: {} };
  const bump = (bucket: Record<string, number>, key: string) => {
    if (key) bucket[key] = (bucket[key] || 0) + 1;
  };
  for (const r of records) {
    bump(facets.provider, r.provider);
    bump(facets.vendor, r.vendor);
    bump(facets.family, r.family);
    bump(facets.kind, r.kind);
    bump(facets.status, r.status);
    if (r.supports_reasoning) bump(facets.capability, "reasoning");
    if (r.supports_tools) bump(facets.capability, "tools");
    if (r.supports_vision) bump(facets.capability, "vision");
    if (r.supports_json) bump(facets.capability, "json");
    if (r.is_free) bump(facets.capability, "free");
  }
  return facets;
}
