/**
 * Deterministic per-(provider, family) recommendation scoring.
 *
 * Score = recency + context length + capabilities + free availability, with a
 * penalty for preview status. Within each (provider, family) the single best
 * model is marked recommended (ties broken by model_id); the caller applies
 * catalog_overrides.force_recommended on top, which always wins.
 */
import type { CatalogRecord } from "./types";

const DAY_MS = 24 * 3600 * 1000;

export function recommendationScore(record: CatalogRecord, now = Date.now()): number {
  let score = 0;

  // Recency: newer releases score higher, decaying over ~3 years.
  if (record.released_at) {
    const age = now - Date.parse(record.released_at);
    if (Number.isFinite(age) && age >= 0) {
      score += Math.max(0, 1 - age / (3 * 365 * DAY_MS)) * 30;
    } else if (Number.isFinite(age)) {
      score += 10;
    }
  }

  // Context length (log scale, 8k -> 1M+).
  if (record.context_length) {
    score += Math.min(25, Math.max(0, (Math.log2(record.context_length) - 13) * 5));
  }

  // Capabilities.
  score += (record.supports_tools ? 8 : 0);
  score += (record.supports_reasoning ? 8 : 0);
  score += (record.supports_vision ? 5 : 0);
  score += (record.supports_json ? 4 : 0);

  // Free availability and lifecycle status.
  if (record.is_free) score += 6;
  if (record.status === "preview") score -= 4;
  if (record.status === "deprecated") score -= 50;
  if (record.status === "removed") score -= 100;
  if (record.kind !== "chat") score -= 10;

  return score;
}

/** Winner per (provider, family): the highest score, model_id tie-broken. */
export function recommendedIds(records: CatalogRecord[], now = Date.now()): Set<string> {
  const best = new Map<string, CatalogRecord>();
  for (const record of records) {
    if (record.status === "removed" || record.status === "deprecated") continue;
    const key = `${record.provider}::${record.family}`;
    const current = best.get(key);
    if (!current) {
      best.set(key, record);
      continue;
    }
    const score = recommendationScore(record, now);
    const currentScore = recommendationScore(current, now);
    if (score > currentScore || (score === currentScore && record.model_id < current.model_id)) {
      best.set(key, record);
    }
  }
  const ids = new Set<string>();
  best.forEach((record) => ids.add(`${record.provider}:${record.model_id}`));
  return ids;
}

/** Recomputes and persists recommendation flags; returns changed entries. */
export async function refreshRecommendations(
  store: { list(provider?: string): Promise<CatalogRecord[]>; setRecommended(entries: Array<{ provider: string; model_id: string; value: boolean }>): Promise<void> },
  provider: string,
  now = Date.now()
): Promise<number> {
  const records = await store.list(provider);
  const winners = recommendedIds(records, now);
  const changed: Array<{ provider: string; model_id: string; value: boolean }> = [];
  for (const record of records) {
    const value = winners.has(`${record.provider}:${record.model_id}`);
    if (value !== record.is_recommended) {
      changed.push({ provider: record.provider, model_id: record.model_id, value });
    }
  }
  if (changed.length > 0) await store.setRecommended(changed);
  return changed.length;
}
