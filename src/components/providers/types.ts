import type { GroupableModel } from "../../shared/catalog/grouping";

/** A model row as served by GET /api/catalog and rendered by the browser. */
export interface CatalogBrowserModel extends GroupableModel {
  model_id: string;
  name: string;
  display_name?: string;
  vendor: string;
  family: string;
  kind: string;
  status: string;
  context_length: number | null;
  max_output_tokens: number | null;
  pricing: { inputPerMTok: number | null; outputPerMTok: number | null; currency: string } | null;
  supports_tools: boolean;
  supports_vision: boolean;
  supports_reasoning: boolean;
  supports_json: boolean;
  is_free: boolean;
  recommended: boolean;
  released_at?: string | null;
  first_seen_at?: string | null;
  connected: boolean;
  requires_key: boolean;
  enabled: boolean;
  pinned: boolean;
  alias: string | null;
}

export interface CatalogProviderSummary {
  id: string;
  label: string;
  connected: boolean;
  modelCount: number;
}

export interface CatalogBrowserData {
  models: CatalogBrowserModel[];
  providers: CatalogProviderSummary[];
  source: "catalog" | "bundled";
  syncable: string[];
}

export type CatalogSort = "recommended" | "newest" | "context" | "price";

export function kindLabel(kind?: string): string {
  switch (kind) {
    case "embedding":
      return "Embedding";
    case "image":
      return "Image";
    case "audio":
      return "Audio";
    case "video":
      return "Video";
    case "rerank":
      return "Rerank";
    case "moderation":
      return "Moderation";
    case "other":
      return "Other";
    default:
      return "Chat";
  }
}

/** Client-side sort mirroring the server's sort parameter. */
export function sortBrowserModels(models: CatalogBrowserModel[], sort: CatalogSort): CatalogBrowserModel[] {
  const out = [...models];
  const price = (m: CatalogBrowserModel) => (m.pricing && m.pricing.inputPerMTok != null ? m.pricing.inputPerMTok : Number.MAX_SAFE_INTEGER);
  if (sort === "newest") {
    out.sort((a, b) => String(b.released_at || "").localeCompare(String(a.released_at || "")) || a.model_id.localeCompare(b.model_id));
  } else if (sort === "context") {
    out.sort((a, b) => (b.context_length || 0) - (a.context_length || 0) || a.model_id.localeCompare(b.model_id));
  } else if (sort === "price") {
    out.sort((a, b) => price(a) - price(b) || a.model_id.localeCompare(b.model_id));
  } else {
    out.sort(
      (a, b) =>
        Number(b.recommended) - Number(a.recommended) ||
        String(b.released_at || "").localeCompare(String(a.released_at || "")) ||
        (b.context_length || 0) - (a.context_length || 0) ||
        a.model_id.localeCompare(b.model_id)
    );
  }
  return out;
}
