import { createClient } from "@supabase/supabase-js";

export interface Model {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  provider: string;
  api_model_id: string;
  kind: "chat" | "light" | "embedding";
  supports_thinking: boolean;
  supports_tools: boolean;
  supports_search: boolean;
  supports_vision: boolean;
  max_output_tokens: number | null;
  enabled: boolean;
  is_default: boolean;
  sort_order: number;
}

export const FALLBACK_MODELS: Model[] = [
  {
    id: "gemini-3-8-flash",
    slug: "gemini-3-8-flash",
    display_name: "Gemini 3.8 Flash",
    description: "Fast and highly balanced intelligence, ideal for general chat and multimodal tasks.",
    provider: "google",
    api_model_id: "gemini-3.8-flash",
    kind: "chat",
    supports_thinking: false,
    supports_tools: false,
    supports_search: true,
    supports_vision: true,
    max_output_tokens: null,
    enabled: true,
    is_default: true,
    sort_order: 1,
  },
  {
    id: "gemini-3-1-pro",
    slug: "gemini-3-1-pro",
    display_name: "Gemini 3.1 Pro (Preview)",
    description: "State-of-the-art capability for complex tasks and deep reasoning.",
    provider: "google",
    api_model_id: "gemini-3.1-pro-preview",
    kind: "chat",
    supports_thinking: true,
    supports_tools: true,
    supports_search: true,
    supports_vision: true,
    max_output_tokens: null,
    enabled: true,
    is_default: false,
    sort_order: 2,
  },
  {
    id: "gemini-3-1-flash-lite",
    slug: "gemini-3-1-flash-lite",
    display_name: "Gemini 3.1 Flash-Lite",
    description: "Incredible speed and low latency for quick conversations and summaries.",
    provider: "google",
    api_model_id: "gemini-3.1-flash-lite",
    kind: "chat",
    supports_thinking: false,
    supports_tools: false,
    supports_search: false,
    supports_vision: true,
    max_output_tokens: null,
    enabled: true,
    is_default: false,
    sort_order: 3,
  },
];

import { normalizeSlug } from "../../src/hooks/useModels";


const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const isRealSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseServiceKey && 
  !supabaseUrl.includes("YOUR_") && 
  !supabaseServiceKey.includes("YOUR_")
);

export const supabaseServer = isRealSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

let cachedModels: any[] | null = null;
let cacheExpiry = 0;

export function invalidateModelCache() {
  cachedModels = null;
  cacheExpiry = 0;
}

export async function checkIsAdmin(userId: string): Promise<boolean> {
  if (!isRealSupabaseConfigured || !supabaseServer) {
    return Boolean(userId);
  }
  try {
    const { data, error } = await supabaseServer
      .from("app_admins")
      .select("user_id")
      .eq("user_id", userId)
      .single();
    return Boolean(data && !error);
  } catch {
    return false;
  }
}

export async function getModelsFromDB(all = false): Promise<any[]> {
  if (!all && cachedModels && Date.now() < cacheExpiry) {
    return cachedModels;
  }

  let models: any[];
  if (isRealSupabaseConfigured && supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from("models")
        .select("*")
        .order("sort_order", { ascending: true });
      if (!error && data && data.length > 0) {
        models = data;
      } else {
        models = FALLBACK_MODELS;
      }
    } catch {
      models = FALLBACK_MODELS;
    }
  } else {
    try {
      const saved = localStorage.getItem("claude_clone_mock_models");
      if (saved) {
        models = JSON.parse(saved);
      } else {
        models = FALLBACK_MODELS;
      }
    } catch {
      models = FALLBACK_MODELS;
    }
  }

  models = models.map((m: any) => ({
    ...m,
    slug: normalizeSlug(m.slug),
  }));

  if (!all) {
    const enabledOnly = models.filter((m) => m.enabled);
    cachedModels = enabledOnly;
    cacheExpiry = Date.now() + 60000;
    return enabledOnly;
  }

  return models;
}
