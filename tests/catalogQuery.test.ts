import { describe, it, expect } from "vitest";
import {
  computeFacets,
  decodeCursor,
  encodeCursor,
  filterRecords,
  mergeOverrides,
  paginate,
  sortRecords,
} from "../server/lib/catalog/query";
import type { CatalogRecord, OverrideRecord } from "../server/lib/catalog/types";

function record(overrides: Partial<CatalogRecord>): CatalogRecord {
  return {
    provider: "groq",
    model_id: "a",
    name: "Model A",
    description: null,
    vendor: "Meta",
    family: "Llama 3.3",
    kind: "chat",
    status: "active",
    context_length: 131072,
    max_output_tokens: null,
    input_modalities: ["text"],
    output_modalities: ["text"],
    supports_tools: true,
    supports_vision: false,
    supports_reasoning: false,
    supports_json: false,
    is_free: false,
    is_recommended: false,
    pricing: { inputPerMTok: 1, outputPerMTok: 2, currency: "USD" },
    released_at: "2025-06-01",
    source: "groq-key",
    first_seen_at: "2026-10-01T00:00:00.000Z",
    last_seen_at: "2026-10-01T00:00:00.000Z",
    last_synced_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

const FIXTURES: CatalogRecord[] = [
  record({ model_id: "llama-3.3", name: "Llama 3.3 70B", context_length: 131072, released_at: "2025-01-01" }),
  record({ model_id: "llama-4", name: "Llama 4 Scout", family: "Llama 4", context_length: 1000000, released_at: "2025-04-01", supports_reasoning: true, is_recommended: true }),
  record({ model_id: "gemma-3", name: "Gemma 3", vendor: "Google", family: "Gemma 3", is_free: true, pricing: { inputPerMTok: 0, outputPerMTok: 0, currency: "USD" }, released_at: "2025-03-01" }),
  record({ model_id: "embed-1", name: "Embed One", kind: "embedding", supports_tools: false, released_at: "2024-12-01" }),
  record({ provider: "gemini", model_id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", vendor: "google", family: "Gemini 3.8 Flash", status: "preview", released_at: "2026-06-01", supports_vision: true, supports_json: true, context_length: 1000000 }),
  record({ provider: "gemini", model_id: "gemini-old", name: "Gemini Old", vendor: "google", family: "Gemini", status: "deprecated", released_at: "2023-01-01" }),
];

describe("filterRecords", () => {
  it("filters by provider, kind, vendor, family, status, capability, free and query", () => {
    expect(filterRecords(FIXTURES, { provider: "gemini" }).map((r) => r.model_id)).toEqual(["gemini-3.8-flash", "gemini-old"]);
    expect(filterRecords(FIXTURES, { kind: "embedding" }).map((r) => r.model_id)).toEqual(["embed-1"]);
    expect(filterRecords(FIXTURES, { vendor: ["Meta"] }).map((r) => r.model_id)).toEqual(["llama-3.3", "llama-4", "embed-1"]);
    expect(filterRecords(FIXTURES, { vendor: ["Google", "google"] }).map((r) => r.model_id)).toEqual(["gemma-3", "gemini-3.8-flash", "gemini-old"]);
    expect(filterRecords(FIXTURES, { family: ["Llama 4"] }).map((r) => r.model_id)).toEqual(["llama-4"]);
    expect(filterRecords(FIXTURES, { status: ["preview", "deprecated"] }).map((r) => r.model_id)).toEqual(["gemini-3.8-flash", "gemini-old"]);
    expect(filterRecords(FIXTURES, { capability: ["reasoning"] }).map((r) => r.model_id)).toEqual(["llama-4"]);
    expect(filterRecords(FIXTURES, { capability: ["vision", "json"] }).map((r) => r.model_id)).toEqual(["gemini-3.8-flash"]);
    expect(filterRecords(FIXTURES, { free: true }).map((r) => r.model_id)).toEqual(["gemma-3"]);
    expect(filterRecords(FIXTURES, { q: "scout" }).map((r) => r.model_id)).toEqual(["llama-4"]);
    expect(filterRecords(FIXTURES, { provider: "gemini", capability: ["vision"] }).map((r) => r.model_id)).toEqual(["gemini-3.8-flash"]);
    expect(filterRecords(FIXTURES, { q: "meta llama" })).toHaveLength(0); // vendor+family search requires one substring
    expect(filterRecords(FIXTURES, { q: "llama" }).length).toBe(3);
  });
});

describe("sortRecords", () => {
  it("sorts by recommended, newest, context and price", () => {
    // sortRecords reads the merged `recommended` flag produced by mergeOverrides.
    const merged = FIXTURES.map((r) => ({ ...r, recommended: r.is_recommended }));
    const recommended = sortRecords(merged, "recommended");
    expect(recommended[0].model_id).toBe("llama-4"); // recommended flag first, newest within

    const newest = sortRecords(merged, "newest");
    expect(newest[0].model_id).toBe("gemini-3.8-flash");
    expect(newest[newest.length - 1].model_id).toBe("gemini-old");

    const context = sortRecords(merged, "context");
    expect(context[0].context_length).toBe(1000000);

    const price = sortRecords(merged, "price");
    expect(price[0].pricing.inputPerMTok).toBe(0); // free first
  });
});

describe("paginate", () => {
  it("pages with a cursor up to 200 per page and returns all with all=1", () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ id: i }));
    const page1 = paginate(many, { limit: 200 });
    expect(page1.page).toHaveLength(200);
    expect(page1.total).toBe(250);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = paginate(many, { limit: 200, cursor: page1.nextCursor! });
    expect(page2.page).toHaveLength(50);
    expect(page2.nextCursor).toBeNull();

    // Limit is capped at 200.
    const capped = paginate(many, { limit: 5000 });
    expect(capped.page).toHaveLength(200);

    const all = paginate(many, {}, true);
    expect(all.page).toHaveLength(250);
    expect(all.nextCursor).toBeNull();

    // Cursors round-trip and invalid cursors reset to 0.
    expect(decodeCursor(encodeCursor(42))).toBe(42);
    expect(decodeCursor("!!!not-base64!!!")).toBe(0);
  });
});

describe("computeFacets", () => {
  it("counts by provider, vendor, family, kind, capability and status", () => {
    const facets = computeFacets(FIXTURES);
    expect(facets.provider).toEqual({ groq: 4, gemini: 2 });
    expect(facets.vendor.Meta).toBe(3);
    expect(facets.vendor.google).toBe(2);
    expect(facets.vendor.Google).toBe(1);
    expect(facets.family["Llama 4"]).toBe(1);
    expect(facets.kind).toEqual({ chat: 5, embedding: 1 });
    expect(facets.capability).toEqual({ tools: 5, reasoning: 1, vision: 1, json: 1, free: 1 });
    expect(facets.status).toEqual({ active: 4, preview: 1, deprecated: 1 });
  });
});

describe("mergeOverrides", () => {
  const overrides: OverrideRecord[] = [
    { provider: "groq", model_id: "llama-4", hidden: true, force_recommended: false, alias: null },
    { provider: "gemini", model_id: "gemini-old", hidden: false, force_recommended: true, alias: "Old Faithful" },
    { provider: "groq", model_id: "gemma-3", hidden: false, force_recommended: false, alias: "Gemma" },
  ];

  it("excludes hidden models for non-admins", () => {
    const merged = mergeOverrides(FIXTURES, overrides, false);
    expect(merged.map((r) => r.model_id)).not.toContain("llama-4");
    expect(merged).toHaveLength(FIXTURES.length - 1);
  });

  it("keeps hidden models flagged for admins", () => {
    const merged = mergeOverrides(FIXTURES, overrides, true);
    const hidden = merged.find((r) => r.model_id === "llama-4")!;
    expect(hidden.hidden).toBe(true);
    expect(merged).toHaveLength(FIXTURES.length);
  });

  it("applies aliases and lets force_recommended win", () => {
    const merged = mergeOverrides(FIXTURES, overrides, false);
    const forced = merged.find((r) => r.model_id === "gemini-old")!;
    expect(forced.alias).toBe("Old Faithful");
    expect(forced.recommended).toBe(true);
    const plain = merged.find((r) => r.model_id === "llama-3.3")!;
    expect(plain.recommended).toBe(false);
    expect(merged.find((r) => r.model_id === "gemma-3")!.alias).toBe("Gemma");
  });
});
