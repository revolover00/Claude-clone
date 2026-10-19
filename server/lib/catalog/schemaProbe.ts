import type { CatalogDbStatus } from "./types";

export const EXPECTED_CATALOG_COLUMNS = {
  provider_catalog: [
    "provider", "model_id", "name", "description", "vendor", "family", "kind", "status",
    "context_length", "max_output_tokens", "input_modalities", "output_modalities", "supports_tools",
    "supports_vision", "supports_reasoning", "supports_json", "is_free", "is_recommended", "pricing",
    "released_at", "source", "first_seen_at", "last_seen_at", "last_synced_at",
  ],
  catalog_sync_runs: [
    "id", "provider", "trigger", "status", "started_at", "finished_at", "added", "updated",
    "removed", "total", "error",
  ],
  catalog_overrides: ["provider", "model_id", "hidden", "force_recommended", "alias", "is_default"],
  app_settings: ["key", "value", "updated_at", "updated_by"],
} as const;

export interface CatalogSchemaHealth {
  db: CatalogDbStatus;
  missing: string[];
}

interface SchemaProbeClient {
  from: (table: string) => any;
}

const UNREACHABLE: CatalogSchemaHealth = { db: "unreachable", missing: [] };
let currentHealth: CatalogSchemaHealth = { ...UNREACHABLE };
let probePromise: Promise<CatalogSchemaHealth> | null = null;

function errorText(error: any): string {
  return String(error?.message || error || "Unknown database error");
}

function isMissingTable(error: any): boolean {
  const text = errorText(error);
  return error?.code === "42P01" || error?.code === "PGRST205" ||
    /relation .* does not exist|could not find the table|table .* not found/i.test(text);
}

function isMissingColumn(error: any): boolean {
  const text = errorText(error);
  return error?.code === "42703" || error?.code === "PGRST204" ||
    /column .* does not exist|could not find the .* column|undefined column/i.test(text);
}

async function selectZeroRows(client: SchemaProbeClient, table: string, column: string): Promise<any> {
  return client.from(table).select(column).limit(0);
}

async function probeTable(client: SchemaProbeClient, table: string, columns: readonly string[]) {
  try {
    const result = await selectZeroRows(client, table, columns.join(","));
    if (!result?.error) return { missing: [] as string[], unreachable: null as string | null };
    if (isMissingTable(result.error)) return { missing: [table], unreachable: null };
    if (!isMissingColumn(result.error)) return { missing: [], unreachable: `${table}: ${errorText(result.error)}` };
  } catch (error) {
    return { missing: [], unreachable: `${table}: ${errorText(error)}` };
  }

  const checks = await Promise.all(columns.map(async (column) => {
    try {
      const result = await selectZeroRows(client, table, column);
      return { column, error: result?.error || null };
    } catch (error) {
      return { column, error };
    }
  }));
  if (checks.some((check) => check.error && isMissingTable(check.error))) {
    return { missing: [table], unreachable: null };
  }

  const missing = checks.filter((check) => check.error && isMissingColumn(check.error)).map((check) => `${table}.${check.column}`);
  const unknown = checks.find((check) => check.error && !isMissingColumn(check.error));
  if (missing.length > 0) return { missing, unreachable: unknown ? `${table}: ${errorText(unknown.error)}` : null };
  return { missing: [], unreachable: `${table}: ${errorText(unknown?.error || "schema could not be validated")}` };
}

/** Read-only check: four grouped SELECTs, with per-column retries only on mismatch. */
export async function probeCatalogSchema(client: SchemaProbeClient): Promise<CatalogSchemaHealth> {
  const tables = Object.entries(EXPECTED_CATALOG_COLUMNS);
  const results = await Promise.all(tables.map(([table, columns]) => probeTable(client, table, columns)));
  const missingSet = new Set(results.flatMap((result) => result.missing));
  const missing = tables.flatMap(([table, columns]) =>
    missingSet.has(table) ? [table] : columns.map((column) => `${table}.${column}`).filter((name) => missingSet.has(name))
  );
  const unreachable = results.map((result) => result.unreachable).filter((value): value is string => Boolean(value));
  return {
    db: missing.length > 0 ? "schema_mismatch" : unreachable.length > 0 ? "unreachable" : "ok",
    missing,
  };
}

/** Starts one startup probe and logs one actionable error if the database is not ready. */
export function startCatalogSchemaProbe(client: SchemaProbeClient): Promise<CatalogSchemaHealth> {
  if (!probePromise) {
    probePromise = probeCatalogSchema(client).then((health) => {
      currentHealth = health;
      if (health.db === "schema_mismatch") {
        console.error(`[Catalog] schema mismatch; missing tables/columns: ${health.missing.join(", ")}`);
      } else if (health.db === "unreachable") {
        console.error("[Catalog] schema probe unreachable; catalog database could not be validated");
      }
      return health;
    }).catch((error) => {
      currentHealth = { ...UNREACHABLE };
      console.error(`[Catalog] schema probe unreachable: ${errorText(error)}`);
      return currentHealth;
    });
  }
  return probePromise;
}

export async function getCatalogSchemaHealth(): Promise<CatalogSchemaHealth> {
  const health = probePromise ? await probePromise : currentHealth;
  return { db: health.db, missing: [...health.missing] };
}

/** Test/reconfiguration hook; does not touch the database. */
export function resetCatalogSchemaProbe(): void {
  probePromise = null;
  currentHealth = { ...UNREACHABLE };
}
