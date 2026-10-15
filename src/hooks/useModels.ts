import { useState, useEffect } from "react";
import type { Model } from "../types/chat";

export const MODEL_ALIAS_MAP: Record<string, string> = {
  "sonnet-5": "gemini-3-8-flash",
  "opus-5": "gemini-3-1-pro",
  "haiku-4-5": "gemini-3-1-flash-lite",
};

export function normalizeSlug(slug: string): string {
  if (!slug) return slug;
  return MODEL_ALIAS_MAP[slug] || slug;
}

import { FALLBACK_MODELS } from "../shared/fallbackModels";
export { FALLBACK_MODELS };

let cachedModels: Model[] | null = null;
let activeFetchPromise: Promise<Model[]> | null = null;
const listeners = new Set<(models: Model[]) => void>();

function notifyListeners(models: Model[]) {
  listeners.forEach((listener) => listener(models));
}

export async function fetchModels(): Promise<Model[]> {
  if (cachedModels) return cachedModels;
  if (activeFetchPromise) return activeFetchPromise;

  activeFetchPromise = fetch("/api/models")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load models");
      return res.json();
    })
    .then((data: Model[]) => {
      if (Array.isArray(data) && data.length > 0) {
        const normalized = data.map((m) => ({
          ...m,
          slug: normalizeSlug(m.slug),
        }));
        cachedModels = normalized;
        notifyListeners(normalized);
        return normalized;
      }
      cachedModels = FALLBACK_MODELS;
      notifyListeners(FALLBACK_MODELS);
      return FALLBACK_MODELS;
    })
    .catch((err) => {
      console.warn("Could not fetch models, using offline fallback:", err);
      cachedModels = FALLBACK_MODELS;
      notifyListeners(FALLBACK_MODELS);
      return FALLBACK_MODELS;
    })
    .finally(() => {
      activeFetchPromise = null;
    });

  return activeFetchPromise;
}

export function invalidateClientModelCache() {
  cachedModels = null;
  activeFetchPromise = null;
}

export function useModels() {
  const [models, setModels] = useState<Model[]>(() => cachedModels || FALLBACK_MODELS);
  const [loading, setLoading] = useState<boolean>(!cachedModels);

  useEffect(() => {
    let mounted = true;

    const listener = (newModels: Model[]) => {
      if (mounted) {
        setModels(newModels);
        setLoading(false);
      }
    };
    listeners.add(listener);

    if (!cachedModels) {
      fetchModels().then((result) => {
        if (mounted) {
          setModels(result);
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }

    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  const defaultModel =
    models.find((m) => m.is_default) ||
    models.find((m) => m.enabled && m.kind === "chat") ||
    models[0] ||
    FALLBACK_MODELS[0];

  return {
    models,
    loading,
    normalizeSlug,
    defaultModel,
    refetch: () => {
      invalidateClientModelCache();
      return fetchModels();
    },
  };
}
