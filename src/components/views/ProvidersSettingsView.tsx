import React, { useEffect, useState, useCallback } from "react";
import { ProviderCard } from "../providers/ProviderCard";
import { ModelBrowser } from "../providers/ModelBrowser";
import { SettingsErrorCard } from "../shared/SettingsErrorCard";
import { safeFetchJson } from "../../utils/safeFetch";

interface ProviderData {
  id: string;
  name: string;
  status: "disconnected" | "active" | "invalid" | "rate_limited";
  last4?: string;
  lastVerified?: string;
  lastError?: string;
  docsUrl: string;
  keyHelpUrl?: string;
  credentialId?: string;
}

const DEFAULT_PROVIDERS: ProviderData[] = [
  {
    id: "gemini",
    name: "Google AI Studio",
    status: "disconnected",
    docsUrl: "https://aistudio.google.com/",
    keyHelpUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "groq",
    name: "Groq",
    status: "disconnected",
    docsUrl: "https://console.groq.com/",
    keyHelpUrl: "https://console.groq.com/keys",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    status: "disconnected",
    docsUrl: "https://openrouter.ai/",
    keyHelpUrl: "https://openrouter.ai/keys",
  },
];

export const ProvidersSettingsView: React.FC = () => {
  const [providerList, setProviderList] = useState<ProviderData[]>(DEFAULT_PROVIDERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await safeFetchJson<{ providers?: any[]; credentials?: any[] }>("/api/providers");

      const updated = DEFAULT_PROVIDERS.map((def) => {
        const cred = data.credentials?.find((c: any) => c.provider === def.id);
        if (cred) {
          return {
            ...def,
            status: (cred.status as any) || "active",
            last4: cred.key_last4 || cred.last4,
            lastVerified: cred.last_verified_at,
            lastError: cred.last_error,
            credentialId: cred.id,
          };
        }
        return def;
      });
      setProviderList(updated);
    } catch (err: any) {
      setError(err);
      console.warn("Failed to fetch provider credentials:", err);
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
          Connect your own API keys to use models directly through Google AI Studio, Groq, and OpenRouter. Keys are encrypted securely.
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
