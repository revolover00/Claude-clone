import type { CatalogRecord } from "./types";

/** Bundled snapshot fills gaps; live database rows replace matching bundled/fallback entries. */
export function mergeCatalogRows(bundled: CatalogRecord[], live: CatalogRecord[]): CatalogRecord[] {
  const rows = new Map<string, CatalogRecord>();
  for (const record of bundled) rows.set(`${record.provider}:${record.model_id}`, record);
  for (const record of live) rows.set(`${record.provider}:${record.model_id}`, record);
  return [...rows.values()];
}
