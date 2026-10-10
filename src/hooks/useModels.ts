import { useState, useEffect } from "react";
import { Model } from "../types/chat";

const ALIAS_MAP: Record<string, string> = {
  "sonnet-5": "gemini-3-8-flash",
  "opus-5": "gemini-3-1-pro",
  "haiku-4-5": "gemini-3-1-flash-lite",
};

const FALLBACK_MODELS: Model[] = [
  { id: "fb-1", slug: "gemini-3-8-flash", display_name: "Gemini 3.8 Flash", description: "Fast and highly balanced intelligence, ideal for general chat and multimodal tasks.", provider: "google", api_model_id: "gemini-3.8-flash", kind: "chat", supports_thinking: false, supports_search: true, supports_vision: true, max_output_tokens: null, enabled: true, is_default: true, sort_order: 1 },
  { id: "fb-2", slug: "gemini-3-1-pro", display_name: "Gemini 3.1 Pro", description: "State-of-the-art capability for complex tasks and deep reasoning.", provider: "google", api_model_id: "gemini-3.1-pro-preview", kind: "chat", supports_thinking: true, supports_search: true, supports_vision: true, max_output_tokens: null, enabled: true, is_default: false, sort_order: 2 },
  { id: "fb-3", slug: "gemini-3-1-flash-lite", display_name: "Gemini 3.1 Flash-Lite", description: "Incredible speed and low latency for quick conversations and summaries.", provider: "google", api_model_id: "gemini-3.1-flash-lite", kind: "chat", supports_thinking: false, supports_search: false, supports_vision: true, max_output_tokens: null, enabled: true, is_default: false, sort_order: 3 },
];

export function useModels() {
  const [models, setModels] = useState<Model[]>(FALLBACK_MODELS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        setModels(data);
        setLoading(false);
      })
      .catch(() => {
        setModels(FALLBACK_MODELS);
        setLoading(false);
      });
  }, []);

  const normalizeSlug = (slug: string) => ALIAS_MAP[slug] || slug;

  const defaultModel = models.find((m) => m.is_default) || models[0];

  return { models, loading, normalizeSlug, defaultModel };
}
