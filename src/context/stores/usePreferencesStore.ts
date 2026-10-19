import { useState, useCallback, useEffect } from "react";
import type { UserPreferences } from "../../types/chat";

import { toCanonicalModelId } from "../../shared/normalizeSlug";
import { isColorMode, resolveColorMode } from "../../utils/theme";

const STORAGE_KEY_PREFS = "claude_clone_preferences_v3";

const DEFAULT_PREFERENCES: UserPreferences = {
  userName: "You",
  profileInstructions: "",
  responseStyle: "Normal",
  theme: "system",
  language: "en",
  settings: {
    show_thinking: "auto",
  },
};

export function usePreferencesStore() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY_PREFS) ||
        localStorage.getItem("claude_clone_preferences_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!isColorMode(parsed.theme)) parsed.theme = "system";
        const fallbackShowThinking = localStorage.getItem("claude_show_thinking");
        if (fallbackShowThinking && !parsed.settings?.show_thinking) {
          parsed.settings = { ...(parsed.settings || {}), show_thinking: fallbackShowThinking };
        }
        if (parsed.settings?.model) {
          parsed.settings.model = toCanonicalModelId(parsed.settings.model);
        }
        if (parsed.settings?.model_id) {
          parsed.settings.model_id = toCanonicalModelId(parsed.settings.model_id);
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    const fallbackShowThinking = typeof localStorage !== "undefined" ? localStorage.getItem("claude_show_thinking") : null;
    return {
      ...DEFAULT_PREFERENCES,
      settings: {
        show_thinking: (fallbackShowThinking as any) || "auto",
      },
    };
  });

  // Match Claude's light, system, and dark color modes; listen only in system mode.
  useEffect(() => {
    const root = document.documentElement;
    const media = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: light)")
      : null;
    const applyTheme = () => {
      root.setAttribute("data-theme", resolveColorMode(preferences.theme, Boolean(media?.matches)));
    };

    applyTheme();
    if (preferences.theme !== "system" || !media) return;
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", applyTheme);
      return () => media.removeEventListener("change", applyTheme);
    }
    media.addListener?.(applyTheme);
    return () => media.removeListener?.(applyTheme);
  }, [preferences.theme]);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(preferences));
    } catch {
      // ignore
    }
  }, [preferences]);

  const updatePreferences = useCallback(
    (partial: Partial<UserPreferences>) => {
      setPreferences((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  return { preferences, updatePreferences };
}
