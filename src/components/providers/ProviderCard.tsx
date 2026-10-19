import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Badge } from "@/components/shared/Badge";
import { authFetch } from "../../utils/safeFetch";
import { CredentialList, type CredentialRow } from "./CredentialList";
import { Package, CheckCircle2, Sparkles } from "lucide-react";
import { isExperimentalProvider } from "../../shared/providerTraits";

type ConnectionTestResult =
  | { ok: true; latencyMs: number; tokens: number | null; model: string }
  | { ok: false; error: string };

export interface ProviderCardProps {
  id: string;
  name: string;
  vendor?: string;
  status: "disconnected" | "active" | "invalid" | "rate_limited" | "exhausted";
  docsUrl: string;
  keyHelpUrl?: string;
  keyEnv?: string | null;
  /** Number of models shipped for this provider by the bundled catalog. */
  modelCount?: number;
  /** Every saved key for this provider (multiple allowed), display order. */
  credentials?: CredentialRow[];
  onRefresh?: () => void;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  id,
  name,
  vendor,
  status,
  docsUrl,
  keyHelpUrl,
  keyEnv,
  modelCount,
  credentials,
  onRefresh,
}) => {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connectedMsg, setConnectedMsg] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testVerified, setTestVerified] = useState<boolean | null>(null);
  const hasVerifiedCredential = (credentials || []).some((item) => item.status === "active" && Boolean(item.last_verified_at));
  const showExperimental = isExperimentalProvider(id) && !(testVerified ?? hasVerifiedCredential);

  const getBadgeVariant = (s: string) => {
    switch (s) {
      case "active":
        return "success";
      case "invalid":
        return "danger";
      case "rate_limited":
      case "exhausted":
        return "warning";
      default:
        return "secondary";
    }
  };

  /** Unique per provider — re-saving "default" must not overwrite an existing key. */
  const nextLabel = () => {
    const used = new Set((credentials || []).map((c) => c.label));
    if (!used.has("default")) return "default";
    let n = 2;
    while (used.has(`key${n}`)) n++;
    return `key${n}`;
  };

  const handleConnect = async () => {
    if (!key.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authFetch(`/api/providers/${id}/credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key: key.trim(), label: nextLabel() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to connect provider");
      } else {
        setKey("");
        setErrorMsg(null);
        setTestResult(null);
        setTestVerified(null);
        const unlocked = typeof data.modelCount === "number" && data.modelCount > 0 ? data.modelCount : modelCount;
        setConnectedMsg(
          unlocked
            ? `Connected \u2014 ${unlocked} ${name} models unlocked`
            : `Connected \u2014 ${name} models are ready`
        );
        // Refresh every open catalog/picker and preselect the best new model.
        window.dispatchEvent(
          new CustomEvent("claude:provider-connected", {
            detail: { provider: id, modelCount: unlocked ?? 0 },
          })
        );
        onRefresh?.();
      }
    } catch {
      setErrorMsg("Network error connecting provider");
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await authFetch(`/api/providers/${id}/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(key.trim() ? { key: key.trim() } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Test failed (HTTP ${res.status})`);
      setTestVerified(true);
      window.dispatchEvent(new CustomEvent("claude:provider-verified", { detail: { provider: id } }));
      setTestResult({ ok: true, latencyMs: data.latencyMs, tokens: data.tokens ?? null, model: data.model });
    } catch (error: any) {
      setTestVerified(false);
      setTestResult({ ok: false, error: error?.message || "Provider connection test failed" });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <Card className="w-full overflow-hidden border border-line bg-elev-1 font-sans">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-4 py-3 border-b border-line/60">
        <h4 className="text-[14px] font-semibold text-ink whitespace-nowrap truncate min-w-0">
          {name}
        </h4>
        <div className="flex shrink-0 items-center gap-1.5">
          {showExperimental && <Badge variant="warning" className="text-[9px]">Experimental</Badge>}
          <Badge variant={getBadgeVariant(status)} className="text-[11px] capitalize">{status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3.5 p-4">
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink-muted">
          <span className="inline-flex items-center gap-1 rounded border border-line bg-elev-2 px-1.5 py-0.5">
            <Package size={11} /> {modelCount ?? 0} models bundled
          </span>
          {vendor && <span className="rounded border border-line bg-elev-2 px-1.5 py-0.5">{vendor}</span>}
          {keyEnv && <span className="font-mono rounded border border-line bg-elev-2 px-1.5 py-0.5">{keyEnv}</span>}
        </div>

        {connectedMsg && status !== "disconnected" && (
          <div
            role="status"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[12px] font-medium text-emerald-300"
          >
            <CheckCircle2 size={13} className="shrink-0" />
            <span>{connectedMsg}</span>
            <Sparkles size={12} className="shrink-0 text-emerald-400" />
          </div>
        )}

        <div className="space-y-2.5">
          <div className="relative w-full">
            <Input
              type={showKey ? "text" : "password"}
              placeholder={status === "disconnected" ? "Paste your API key" : "Add another API key"}
              value={key}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setKey(e.target.value);
                setTestResult(null);
                setTestVerified(null);
              }}
              disabled={loading}
              className="w-full pr-14"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-muted hover:text-ink cursor-pointer px-1 py-0.5"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Button onClick={handleConnect} disabled={loading || !key.trim()} className="cursor-pointer">
              {loading ? "Connecting..." : status === "disconnected" ? "Connect" : "Add key"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testLoading || loading || (!key.trim() && !(credentials || []).some((item) => item.status === "active"))}
            >
              {testLoading ? "Testing..." : "Test connection"}
            </Button>
          </div>
        </div>

        <CredentialList providerId={id} credentials={credentials || []} onChange={onRefresh} />

        {errorMsg && <p className="text-xs text-danger font-medium break-words">{errorMsg}</p>}
        {testResult && (
          <p role={testResult.ok ? "status" : "alert"} className={`text-xs font-medium break-words ${testResult.ok ? "text-emerald-400" : "text-danger"}`}>
            {testResult.ok
              ? `Connection succeeded · ${testResult.latencyMs} ms · ${testResult.tokens === null ? "token count unavailable" : `${testResult.tokens} tokens`} · ${testResult.model}`
              : testResult.error}
          </p>
        )}

        <div className="pt-1 flex flex-wrap items-center gap-3">
          <a
            href={keyHelpUrl || docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline inline-block"
          >
            Get a {name} API key &rarr;
          </a>
          {docsUrl && (
            <a href={docsUrl} target="_blank" rel="noreferrer" className="text-xs text-ink-muted hover:text-ink inline-block">
              Provider docs
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
