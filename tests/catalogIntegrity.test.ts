import { describe, it, expect } from "vitest";
import { CATALOG_MODELS, CATALOG_PROVIDERS, CATALOG_SNAPSHOT, isChatCapable } from "../src/shared/catalog";
import { FREE_TIER_PROVIDERS, hasFreeTier } from "../src/shared/catalog/freeTier";
import { bundledCatalogRecords } from "../server/lib/catalog/bundled";

/**
 * Literal verification of the bundled catalog: every provider definition is
 * complete, every model row is well-formed and free/paid metadata is honest.
 * The bundle only ships models that actually work (upstream-dead entries are
 * dropped by scripts/generate-model-catalog.mjs).
 */
const FORBIDDEN_NAMES = /\b(sonnet|opus|haiku)\b|anthropic|claude/i;

describe("Bundled catalog integrity", () => {
  it("defines every provider completely (links, API base, chat models)", () => {
    expect(CATALOG_PROVIDERS.length).toBeGreaterThanOrEqual(15);
    for (const p of CATALOG_PROVIDERS) {
      expect(p.id, "provider id").toBeTruthy();
      expect(p.label, `${p.id} label`).toBeTruthy();
      expect(p.vendor, `${p.id} vendor`).toBeTruthy();
      expect(p.docsUrl.startsWith("https://"), `${p.id} docsUrl`).toBe(true);
      expect(p.keyHelpUrl.startsWith("https://"), `${p.id} keyHelpUrl`).toBe(true);
      expect(p.apiBase.startsWith("https://"), `${p.id} apiBase`).toBe(true);
      expect(["gemini", "openai"], `${p.id} apiStyle`).toContain(p.apiStyle);
      const chat = p.models.filter((m) => isChatCapable(m.kind));
      expect(chat.length, `${p.id} chat models`).toBeGreaterThanOrEqual(1);
    }
  });

  it("ships only well-formed, non-forbidden model rows", () => {
    for (const p of CATALOG_PROVIDERS) {
      const seen = new Set<string>();
      for (const m of p.models) {
        expect(m.id && !seen.has(m.id), `duplicate id ${p.id}:${m.id}`).not.toBe(false);
        seen.add(m.id);
        expect(m.name, `${p.id}:${m.id} name`).toBeTruthy();
        expect(FORBIDDEN_NAMES.test(`${m.id} ${m.name}`), `forbidden name ${p.id}:${m.id}`).toBe(false);
        expect(m.contextLength === null || m.contextLength > 0, `${p.id}:${m.id} ctx`).toBe(true);
        expect(m.maxOutputTokens === null || m.maxOutputTokens > 0, `${p.id}:${m.id} out`).toBe(true);
        const dead = m.status === "deprecated" || m.status === "removed";
        expect(dead, `dead status on ${p.id}:${m.id} (${m.status})`).toBe(false);
        if (m.pricing) {
          for (const v of [m.pricing.inputPerMTok, m.pricing.outputPerMTok]) {
            expect(typeof v === "number" && Number.isFinite(v) && v >= 0, `${p.id}:${m.id} price value ${v}`).toBe(true);
          }
        }
      }
    }
  });

  it("marks exactly the zero-price models as free, in records and totals", () => {
    const records = bundledCatalogRecords();
    expect(records.length).toBe(CATALOG_MODELS.length);
    for (const r of records) {
      const free = Boolean(r.pricing && r.pricing.inputPerMTok === 0 && r.pricing.outputPerMTok === 0);
      expect(r.is_free, `${r.provider}:${r.model_id} is_free`).toBe(free);
    }
    const freeCount = records.filter((r) => r.is_free).length;
    expect(freeCount, "there are genuinely free models to label").toBeGreaterThanOrEqual(50);
    expect(freeCount).toBeLessThan(records.length);
  });

  it("flags the standing free-tier providers and keeps them usable", () => {
    const ids = new Set(CATALOG_PROVIDERS.map((p) => p.id));
    for (const id of FREE_TIER_PROVIDERS) expect(ids.has(id), `free-tier provider ${id} in catalog`).toBe(true);
    // Google AI Studio + Groq: documented rate-limited free tiers.
    expect(hasFreeTier("gemini")).toBe(true);
    expect(hasFreeTier("groq")).toBe(true);
    expect(hasFreeTier("openai")).toBe(false);
    expect(hasFreeTier(undefined)).toBe(false);
  });

  it("matches the snapshot metadata and keeps preview lifecycle alive", () => {
    expect(CATALOG_SNAPSHOT.totalModels).toBe(CATALOG_MODELS.length);
    expect(CATALOG_SNAPSHOT.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const records = bundledCatalogRecords();
    const statuses = new Set(records.map((r) => r.status));
    expect(statuses.has("deprecated"), "no deprecated rows reach chat").toBe(false);
    expect(statuses.has("removed")).toBe(false);
  });
});
