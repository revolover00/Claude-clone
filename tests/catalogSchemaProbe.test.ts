import { describe, expect, it } from "vitest";
import { EXPECTED_CATALOG_COLUMNS, probeCatalogSchema } from "../server/lib/catalog/schemaProbe";

function probeClient(options: { missingTable?: string; missingColumn?: string } = {}) {
  const calls: Array<{ table: string; columns: string; limit: number }> = [];
  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            limit: async (limit: number) => {
              calls.push({ table, columns, limit });
              if (table === options.missingTable) {
                return { error: { code: "PGRST205", message: `Could not find the table public.${table}` } };
              }
              const missing = columns.split(",").find((column) =>
                table === "provider_catalog" && column === options.missingColumn
              );
              return missing
                ? { error: { code: "PGRST204", message: `Could not find the '${missing}' column of '${table}'` } }
                : { data: [], error: null };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

describe("catalog schema startup probe", () => {
  it("accepts the complete schema using read-only zero-row selects", async () => {
    const { client, calls } = probeClient();
    await expect(probeCatalogSchema(client)).resolves.toEqual({ db: "ok", missing: [] });
    expect(calls).toHaveLength(Object.keys(EXPECTED_CATALOG_COLUMNS).length);
    expect(calls.every((call) => call.limit === 0)).toBe(true);
    expect(calls.map((call) => call.table).sort()).toEqual(Object.keys(EXPECTED_CATALOG_COLUMNS).sort());
  });

  it("identifies a missing column by table and column", async () => {
    const { client } = probeClient({ missingColumn: "is_free" });
    const health = await probeCatalogSchema(client);
    expect(health).toEqual({ db: "schema_mismatch", missing: ["provider_catalog.is_free"] });
  });

  it("identifies a missing table without attempting any writes", async () => {
    const { client, calls } = probeClient({ missingTable: "app_settings" });
    const health = await probeCatalogSchema(client);
    expect(health).toEqual({ db: "schema_mismatch", missing: ["app_settings"] });
    expect(calls.every((call) => call.limit === 0)).toBe(true);
  });
});
