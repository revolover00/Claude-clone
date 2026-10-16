import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Badge } from "@/components/shared/Badge";
import { authFetch } from "../../utils/safeFetch";
import { Package, CheckCircle2, Sparkles } from "lucide-react";

export interface ProviderCardProps {
  id: string;
  name: string;
  vendor?: string;
  status: "disconnected" | "active" | "invalid" | "rate_limited";
  last4?: string;
  lastVerified?: string;
  lastError?: string;
  docsUrl: string;
  keyHelpUrl?: string;
  keyEnv?: string | null;
  /** Number of models shipped for this provider by the bundled catalog. */
  modelCount?: number;
  credentialId?: string;
  onRefresh?: () => void;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  id,
  name,
  vendor,
  status,
  last4,
  lastVerified,
  lastError,
  docsUrl,
  keyHelpUrl,
  keyEnv,
  modelCount,
  credentialId,
  onRefresh,
}) => {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connectedMsg, setConnectedMsg] = useState<string | null>(null);

  const getBadgeVariant = (s: string) => {
    switch (s) {
      case "active":
        return "success";
      case "invalid":
        return "danger";
      case "rate_limited":
        return "warning";
      default:
        return "secondary";
    }
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
        body: JSON.stringify({ key: key.trim(), label: "default" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to connect provider");
      } else {
        setKey("");
        setErrorMsg(null);
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

  const handleVerify = async () => {
    if (!credentialId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authFetch(`/api/providers/${id}/credentials/${credentialId}/verify`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Verification failed");
      }
      onRefresh?.();
    } catch {
      setErrorMsg("Network error verifying credential");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!credentialId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authFetch(`/api/providers/${id}/credentials/${credentialId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConnectedMsg(null);
        window.dispatchEvent(new CustomEvent("claude:provider-connected", { detail: { provider: id } }));
        onRefresh?.();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to disconnect");
      }
    } catch {
      setErrorMsg("Network error disconnecting credential");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full overflow-hidden border border-line bg-elev-1 font-sans">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-4 py-3 border-b border-line/60">
        <h4 className="text-[14px] font-semibold text-ink whitespace-nowrap truncate min-w-0">
          {name}
        </h4>
        <Badge variant={getBadgeVariant(status)} className="shrink-0 text-[11px] capitalize">
          {status}
        </Badge>
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

        {status === "disconnected" ? (
          <div className="space-y-2.5">
            <div className="relative w-full">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="Paste your API key"
                value={key}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKey(e.target.value)}
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
            <div className="w-full pt-0.5">
              <Button
                onClick={handleConnect}
                disabled={loading || !key.trim()}
                className="w-full sm:w-auto cursor-pointer"
              >
                {loading ? "Connecting..." : "Connect"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-[12.5px] text-ink-muted">
            <p>Last 4: <span className="font-mono text-ink">••••{last4 || "•••"}</span></p>
            {lastVerified && <p>Verified: {new Date(lastVerified).toLocaleString()}</p>}
            {lastError && <p className="text-xs text-danger break-words">Error: {lastError}</p>}
            <div className="flex gap-2 pt-1.5 flex-wrap">
              <Button size="sm" variant="secondary" onClick={handleVerify} disabled={loading} className="cursor-pointer">
                {loading ? "Verifying..." : "Verify"}
              </Button>
              <Button size="sm" variant="danger" onClick={handleDisconnect} disabled={loading} className="cursor-pointer">
                Disconnect
              </Button>
            </div>
          </div>
        )}

        {errorMsg && <p className="text-xs text-danger font-medium break-words">{errorMsg}</p>}

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
