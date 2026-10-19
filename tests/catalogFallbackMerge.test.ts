import { describe, expect, it } from "vitest";
import { bundledCatalogRecords } from "../server/lib/catalog/bundled";
import { mergeCatalogRows } from "../server/lib/catalog/merge";

const expected = {
  "gemini-3.8-flash": "Gemini 3.8 Flash",
  "gemini-3.1-pro-preview": "Gemini 3.1 Pro Preview",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
  "gemini-embedding-2": "Gemini Embedding 2",
};

describe("catalog fallback overlay", () => {
  it("marks the four curated Google AI Studio rows as fallback with real names", () => {
    const rows = bundledCatalogRecords();
    for (const [modelId, name] of Object.entries(expected)) {
      expect(rows.find((row) => row.provider === "gemini" && row.model_id === modelId)).toMatchObject({
        name,
        source: "fallback",
      });
    }
  });

  it("lets live-sync rows override the bundled/fallback row without duplicates", () => {
    const bundled = bundledCatalogRecords();
    const live = { ...bundled.find((row) => row.model_id === "gemini-3.8-flash")!, name: "Live Gemini Flash", source: "google-live" };
    const merged = mergeCatalogRows(bundled, [live]);
    const matches = merged.filter((row) => row.provider === "gemini" && row.model_id === live.model_id);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ name: "Live Gemini Flash", source: "google-live" });
  });
});
