import { useState, useCallback, useEffect } from "react";
import type { UserPreferences } from "../../types/chat";

const STORAGE_KEY_PREFS = "claude_clone_preferences_v3";

const DEFAULT_PREFERENCES: UserPreferences = {
  profileInstructions: "",
  responseStyle: "Normal",
  theme: "dark",
  language: "en",
};

export function usePreferencesStore() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY_PREFS) ||
        localStorage.getItem("claude_clone_preferences_v2");
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_PREFERENCES;
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
