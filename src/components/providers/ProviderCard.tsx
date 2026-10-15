import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Badge } from "@/components/shared/Badge";

export interface ProviderCardProps {
  id: string;
  name: string;
  status: "disconnected" | "active" | "invalid" | "rate_limited";
  last4?: string;
  lastVerified?: string;
  lastError?: string;
  docsUrl: string;
  keyHelpUrl?: string;
  credentialId?: string;
  onRefresh?: () => void;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  id,
  name,
  status,
  last4,
  lastVerified,
  lastError,
  docsUrl,
  credentialId,
  onRefresh,
}) => {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      const res = await fetch(`/api/providers/${id}/credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("supabase_token") || "mock-jwt-token-guest"}`,
        },
        body: JSON.stringify({ key: key.trim(), label: "default" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to connect provider");
      } else {
        setKey("");
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
      const res = await fetch(`/api/providers/${id}/credentials/${credentialId}/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("supabase_token") || "mock-jwt-token-guest"}`,
        },
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
      const res = await fetch(`/api/providers/${id}/credentials/${credentialId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("supabase_token") || "mock-jwt-token-guest"}`,
        },
      });
      if (res.ok) {
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

        <div className="pt-1">
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline inline-block"
          >
            Get a {name} API key &rarr;
          </a>
        </div>
      </CardContent>
    </Card>
  );
};
