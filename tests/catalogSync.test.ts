import { describe, it, expect, beforeEach } from "vitest";
import { MemoryCatalogStore } from "../server/lib/catalog/store";
import { syncProviderFetching, syncProviderWithModels } from "../server/lib/catalog/syncEngine";
import type { SyncedModel } from "../server/lib/catalog/types";

function model(id: string, overrides: Partial<SyncedModel> = {}): SyncedModel {
  return {
    model_id: id,
    name: id.replace(/-/g, " "),
    input_modalities: ["text"],
    output_modalities: ["text"],
    supports_tools: true,
    pricing: { inputPerMTok: 1, outputPerMTok: 2, currency: "USD" },
    released_at: "2026-01-01",
    ...overrides,
  };
}

function models(ids: string[]): SyncedModel[] {
  return ids.map((id) => model(id));
}

let store: MemoryCatalogStore;

beforeEach(() => {
  store = new MemoryCatalogStore();
});

describe("catalog sync idempotency", () => {
  it("running twice with the same fetch changes nothing (except seen timestamps)", async () => {
    const first = await syncProviderWithModels(store, "groq", "groq-key", models(["a-1", "b-2", "c-3"]), {
      trigger: "test",
      now: "2026-10-16T10:00:00.000Z",
    });
    expect(first).toMatchObject({ status: "success", added: 3, updated: 0, removed: 0 });

    const snapshot = JSON.stringify((await store.list("groq")).map((r) => ({ ...r, last_seen_at: null, last_synced_at: null })));

    const second = await syncProviderWithModels(store, "groq", "groq-key", models(["a-1", "b-2", "c-3"]), {
      trigger: "test",
      now: "2026-10-16T16:00:00.000Z",
    });
    expect(second).toMatchObject({ status: "success", added: 0, updated: 0, removed: 0, total: 3 });

    const after = JSON.stringify((await store.list("groq")).map((r) => ({ ...r, last_seen_at: null, last_synced_at: null })));
    expect(after).toBe(snapshot);

    // first_seen_at is only set on insert; last_* always update.
    const rows = await store.list("groq");
    expect(new Set(rows.map((r) => r.first_seen_at))).toEqual(new Set(["2026-10-16T10:00:00.000Z"]));
    expect(rows.every((r) => r.last_synced_at === "2026-10-16T16:00:00.000Z")).toBe(true);

    // Every run wrote a catalog_sync_runs row.
    const runs = await store.listRuns("groq");
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.status === "success")).toBe(true);
  });

  it("detects updated rows when model data changes", async () => {
    await syncProviderWithModels(store, "groq", "groq-key", [model("a-1", { context_length: 32000 })], { trigger: "test", now: "2026-10-16T10:00:00.000Z" });
    const second = await syncProviderWithModels(store, "groq", "groq-key", [model("a-1", { context_length: 128000 })], {
      trigger: "test",
      now: "2026-10-16T11:00:00.000Z",
    });
    expect(second).toMatchObject({ added: 0, updated: 1, removed: 0 });
    const rows = await store.list("groq");
    expect(rows[0].context_length).toBe(128000);
    expect(rows[0].first_seen_at).toBe("2026-10-16T10:00:00.000Z");
  });
});

describe("two-run removal rule", () => {
  it("marks a model removed only after it is missing from two consecutive successful syncs", async () => {
    // Run 1: both models present.
    await syncProviderWithModels(store, "groq", "groq-key", models(["a-1", "b-2"]), {
      trigger: "test",
      now: "2026-10-16T10:00:00.000Z",
    });

    // Run 2: b-2 missing for the first time -> still active.
    const second = await syncProviderWithModels(store, "groq", "groq-key", models(["a-1"]), {
      trigger: "test",
      now: "2026-10-16T11:00:00.000Z",
    });
    expect(second.removed).toBe(0);
    let rows = await store.list("groq");
    expect(rows.find((r) => r.model_id === "b-2")!.status).toBe("active");

    // Run 3: b-2 still missing (second consecutive successful run) -> removed.
    const third = await syncProviderWithModels(store, "groq", "groq-key", models(["a-1"]), {
      trigger: "test",
      now: "2026-10-16T12:00:00.000Z",
    });
    expect(third.removed).toBe(1);
    rows = await store.list("groq");
    const removedRow = rows.find((r) => r.model_id === "b-2")!;
    expect(removedRow.status).toBe("removed");
    // Rows are never deleted: conversations may still reference them.
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.model_id === "a-1")!.status).toBe("active");

    // A model that reappears is revived, not duplicated.
    const fourth = await syncProviderWithModels(store, "groq", "groq-key", models(["a-1", "b-2"]), {
      trigger: "test",
      now: "2026-10-16T13:00:00.000Z",
    });
    expect(fourth).toMatchObject({ added: 0, updated: 1, removed: 0 });
    rows = await store.list("groq");
    expect(rows.find((r) => r.model_id === "b-2")!.status).toBe("active");
    expect(rows).toHaveLength(2);
  });
});

describe("partial-failure guard", () => {
  it("never marks removals when the fetch returns less than 50% of the previous count", async () => {
    const ten = Array.from({ length: 10 }, (_, i) => `model-${i}`);
    await syncProviderWithModels(store, "groq", "groq-key", models(ten), { trigger: "test", now: "2026-10-16T10:00:00.000Z" });

    // 2 of 10 < 50%: partial, no removals, guard noted in error.
    const partial = await syncProviderWithModels(store, "groq", "groq-key", models(["model-0", "model-1"]), {
      trigger: "test",
      now: "2026-10-16T11:00:00.000Z",
    });
    expect(partial.status).toBe("partial");
    expect(partial.removed).toBe(0);
    expect(partial.error).toContain("guard");

    const rows = await store.list("groq");
    expect(rows.filter((r) => r.status === "removed")).toHaveLength(0);

    // Still under the guard on the next run -> still no removals.
    const partialAgain = await syncProviderWithModels(store, "groq", "groq-key", models(["model-0", "model-1", "model-2"]), {
      trigger: "test",
      now: "2026-10-16T12:00:00.000Z",
    });
    expect(partialAgain.status).toBe("partial");
    expect(partialAgain.removed).toBe(0);

    // A healthy full fetch restores normal behavior without phantom removals.
    const full = await syncProviderWithModels(store, "groq", "groq-key", models(ten), {
      trigger: "test",
      now: "2026-10-16T13:00:00.000Z",
    });
    expect(full.status).toBe("success");
    expect(full.removed).toBe(0);
  });

  it("records a failed run and changes nothing when the fetch throws", async () => {
    await syncProviderWithModels(store, "groq", "groq-key", models(["a-1", "b-2"]), {
      trigger: "test",
      now: "2026-10-16T10:00:00.000Z",
    });

    const outcome = await syncProviderFetching(
      store,
      "groq",
      async () => {
        throw new Error("network down");
      },
      { trigger: "test", now: "2026-10-16T11:00:00.000Z" }
    );
    expect(outcome.status).toBe("failed");
    expect(outcome.removed).toBe(0);
    expect(outcome.error).toBe("network down");

    const rows = await store.list("groq");
    expect(rows.every((r) => r.status === "active")).toBe(true);

    const runs = await store.listRuns("groq");
    expect(runs[0]).toMatchObject({ status: "failed", error: "network down", added: 0, updated: 0, removed: 0 });
  });

  it("skips providers without a catalog key (gemini/groq) without writing a run row", async () => {
    const outcome = await syncProviderFetching(
      store,
      "gemini",
      async () => null, // GEMINI_API_KEY not configured
      { trigger: "test", now: "2026-10-16T11:00:00.000Z" }
    );
    expect(outcome.added).toBe(0);
    expect(await store.listRuns("gemini")).toHaveLength(0);
    expect(await store.list("gemini")).toHaveLength(0);
  });
});

describe("multi-instance lock", () => {
  it("detects runs that started less than 5 minutes ago", async () => {
    expect(await store.recentRunWithin(5 * 60 * 1000, "2026-10-16T10:00:00.000Z")).toBe(false);
    await store.insertRun({
      provider: "groq",
      trigger: "startup",
      status: "success",
      started_at: "2026-10-16T10:00:00.000Z",
      finished_at: "2026-10-16T10:00:01.000Z",
      added: 1,
      updated: 0,
      removed: 0,
      total: 1,
      error: null,
    });
    expect(await store.recentRunWithin(5 * 60 * 1000, "2026-10-16T10:03:00.000Z")).toBe(true);
    expect(await store.recentRunWithin(5 * 60 * 1000, "2026-10-16T10:06:00.000Z")).toBe(false);
  });
});
