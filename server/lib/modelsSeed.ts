import { buildCatalogAppModels, catalogModelToAppModel, type AppModelRow } from "../../src/shared/catalog/appModels";

/**
 * Auto-seeding for the app `models` table.
 *
 * The model list is never empty and never has to be entered by hand: on boot the
 * server copies the bundled catalog (Google chat models + the curated fallback
 * defaults) into the data-driven `models` table when it has no rows yet.
 */

export interface SeedResult {
  status: "seeded" | "already-populated" | "skipped" | "failed";
  inserted: number;
  reason?: string;
}

/** Base columns that exist before the catalog migration is applied. */
const BASE_COLUMNS = [
  "slug", "display_name", "description", "provider", "api_model_id", "kind",
  "supports_thinking", "supports_tools", "supports_search", "supports_vision",
  "max_output_tokens", "enabled", "is_default", "sort_order",
] as const;

/** Rows written into `public.models` from the bundled catalog. */
export function buildSeedRows(): AppModelRow[] {
  return buildCatalogAppModels();
}

function stripId(row: AppModelRow): Record<string, unknown> {
  const { id, ...rest } = row;
  void id;
  return rest as Record<string, unknown>;
}

function toBaseColumns(row: AppModelRow): Record<string, unknown> {
  const source = row as unknown as Record<string, unknown>;
  const base: Record<string, unknown> = {};
  for (const column of BASE_COLUMNS) base[column] = source[column];
  return base;
}

/**
 * Seeds `public.models` from the bundled catalog. Idempotent: it only inserts when
 * the table is empty, so admin edits are never overwritten.
 */
export async function seedAppModelsFromCatalog(
  supabaseServer: { from: (table: string) => any } | null,
  options: { force?: boolean } = {}
): Promise<SeedResult> {
  if (!supabaseServer) {
    return { status: "skipped", inserted: 0, reason: "Supabase is not configured; the bundled catalog is served directly." };
  }

  try {
    const { count, error: countError } = await supabaseServer
      .from("models")
      .select("id", { count: "exact", head: true });

    if (countError) {
      return { status: "failed", inserted: 0, reason: countError.message };
    }

    if (!options.force && typeof count === "number" && count > 0) {
      return { status: "already-populated", inserted: 0 };
    }

    const rows = buildSeedRows();
    const full = rows.map(stripId);
    let { error } = await supabaseServer.from("models").upsert(full, { onConflict: "slug" });

    if (error) {
      // The optional catalog detail columns may not exist yet (migration not
      // applied). Fall back to the base columns so seeding still succeeds.
      console.warn(`[ModelCatalog] Full catalog upsert failed (${error.message}); retrying with base columns`);
      ({ error } = await supabaseServer.from("models").upsert(rows.map(toBaseColumns), { onConflict: "slug" }));
    }

    if (error) {
      return { status: "failed", inserted: 0, reason: error.message };
    }

    console.log(`[ModelCatalog] Seeded ${rows.length} models from the bundled catalog`);
    return { status: "seeded", inserted: rows.length };
  } catch (err: any) {
    return { status: "failed", inserted: 0, reason: err?.message || String(err) };
  }
}

export { catalogModelToAppModel };
