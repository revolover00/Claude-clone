import { useEffect, useRef } from "react";
import type { UnifiedModel } from "./types";

interface Options {
  allModels: UnifiedModel[];
  loading: boolean;
  activeUniqueKey?: string;
  refresh: () => void;
  onSelectModel: (uniqueKey: string) => void;
}

/**
 * Reacts to `claude:provider-connected`: refetches the catalogs and then
 * preselects the newly connected provider's best model (recommended first,
 * otherwise the first usable one), so saving a key immediately unlocks and
 * activates that provider's models in the composer.
 */
export function useProviderConnectAutoSelect({ allModels, loading, activeUniqueKey, refresh, onSelectModel }: Options) {
  const pendingProviderRef = useRef<string | null>(null);

  useEffect(() => {
    const onProviderConnected = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.provider) pendingProviderRef.current = String(detail.provider);
      void refresh();
    };
    window.addEventListener("claude:provider-connected", onProviderConnected);
    return () => window.removeEventListener("claude:provider-connected", onProviderConnected);
  }, [refresh]);

  useEffect(() => {
    const provider = pendingProviderRef.current;
    if (!provider || loading) return;
    const candidates = allModels.filter(
      (m) => m.provider === provider && !m.requiresKey && m.kind !== "embedding" && m.kind !== "moderation"
    );
    if (candidates.length === 0) return;
    pendingProviderRef.current = null;
    const best = candidates.find((m) => m.recommended) || candidates[0];
    if (!best || best.uniqueKey === activeUniqueKey) return;
    localStorage.setItem("claude_clone_last_model", best.uniqueKey);
    onSelectModel(best.uniqueKey);
  }, [allModels, loading, activeUniqueKey, onSelectModel]);
}
