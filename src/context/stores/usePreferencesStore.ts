import { useState, useCallback, useEffect } from "react";
import type { UserPreferences } from "../../types/chat";

const STORAGE_KEY_PREFS = "claude_clone_preferences_v3";

const DEFAULT_PREFERENCES: UserPreferences = {
  userName: "You",
  profileInstructions: "",
  responseStyle: "Normal",
  theme: "dark",
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
        const fallbackShowThinking = localStorage.getItem("claude_show_thinking");
        if (fallbackShowThinking && !parsed.settings?.show_thinking) {
          parsed.settings = { ...(parsed.settings || {}), show_thinking: fallbackShowThinking };
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

  // Apply theme attribute to root
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }
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
