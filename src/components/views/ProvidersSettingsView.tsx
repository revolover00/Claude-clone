import React, { useEffect, useState, useCallback } from "react";
import { ProviderCard } from "../providers/ProviderCard";
import { ModelBrowser } from "../providers/ModelBrowser";
import { SettingsErrorCard } from "../shared/SettingsErrorCard";
import { safeFetchJson } from "../../utils/safeFetch";
import { CATALOG_PROVIDERS, CATALOG_SNAPSHOT, catalogTotals } from "../../shared/catalog";

interface ProviderData {
  id: string;
  name: string;
  vendor?: string;
  status: "disconnected" | "active" | "invalid" | "rate_limited" | "exhausted";
  last4?: string;
  lastVerified?: string;
  lastError?: string;
  docsUrl: string;
  keyHelpUrl?: string;
  keyEnv?: string | null;
  modelCount?: number;
  credentialId?: string;
  credentials?: any[];
}

/** Offline default: the bundled catalog itself, so providers always render. */
const BUNDLED_PROVIDERS: ProviderData[] = CATALOG_PROVIDERS.map((p) => ({
  id: p.id,
  name: p.label,
  vendor: p.vendor,
  status: "disconnected",
  docsUrl: p.docsUrl,
  keyHelpUrl: p.keyHelpUrl,
  keyEnv: p.keyEnv,
  modelCount: p.modelCount,
}));

export const ProvidersSettingsView: React.FC = () => {
  const [providerList, setProviderList] = useState<ProviderData[]>(BUNDLED_PROVIDERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const totals = catalogTotals();

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await safeFetchJson<{ providers?: any[]; credentials?: any[] }>("/api/providers");
      const registry: any[] = Array.isArray(data.providers) ? data.providers : [];
      if (registry.length === 0) {
        setProviderList(BUNDLED_PROVIDERS);
        return;
      }

      const updated: ProviderData[] = registry.map((provider) => {
        const creds = (data.credentials || []).filter((c: any) => c.provider === provider.id);
        const hasActive = creds.some((c: any) => !c.status || c.status === "active");
        const cred = creds.find((c: any) => !c.status || c.status === "active") || creds[0];
        const bundled = BUNDLED_PROVIDERS.find((b) => b.id === provider.id);
        const derivedStatus =
          creds.length === 0 ? "disconnected" : hasActive ? "active" : ((cred?.status as any) || "disconnected");
        return {
          id: provider.id,
          name: provider.label || provider.id,
          vendor: provider.vendor || bundled?.vendor,
          status: derivedStatus,
          last4: cred?.key_last4 || cred?.last4,
          lastVerified: cred?.last_verified_at,
          lastError: cred?.last_error,
          credentialId: cred?.id,
          credentials: creds,
          docsUrl: provider.docsUrl || bundled?.docsUrl || "",
          keyHelpUrl: provider.keyHelpUrl || bundled?.keyHelpUrl,
          keyEnv: provider.keyEnv ?? bundled?.keyEnv ?? null,
          modelCount: provider.bundledModelCount ?? bundled?.modelCount ?? 0,
        };
      });

      setProviderList(updated);
    } catch (err: any) {
      setError(err);
      setProviderList(BUNDLED_PROVIDERS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15.5px] font-medium text-ink">AI Model Providers</h3>
        <p className="text-[12.5px] text-ink-muted">
          All {totals.providers} providers with their {totals.models} models are already installed from the bundled
          catalog (snapshot {CATALOG_SNAPSHOT.generatedAt}). Connect an API key to run a provider's models — no model has
          to be added by hand. Keys are encrypted securely.
        </p>
      </div>

      {error ? (
        <SettingsErrorCard onRetry={fetchProviders} error={error} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providerList.map((p) => (
            <ProviderCard key={p.id} {...p} onRefresh={fetchProviders} />
          ))}
        </div>
      )}

      {loading && !error && <p className="text-xs text-ink-muted animate-pulse">Syncing providers...</p>}

      <ModelBrowser />
    </div>
  );
};
