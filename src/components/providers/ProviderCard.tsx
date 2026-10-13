import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/Card";
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
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{name}</CardTitle>
        <Badge variant={getBadgeVariant(status)}>{status}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "disconnected" ? (
          <div className="space-y-2">
            <Input
              type={showKey ? "text" : "password"}
              placeholder="Paste your API key"
              value={key}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKey(e.target.value)}
              disabled={loading}
            />
            <div className="flex gap-2">
              <Button onClick={handleConnect} disabled={loading || !key.trim()}>
                {loading ? "Connecting..." : "Connect"}
              </Button>
              <Button variant="ghost" onClick={() => setShowKey(!showKey)}>
                {showKey ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-ink-muted">
            <p>Last 4: ••••{last4 || "•••"}</p>
            {lastVerified && <p>Verified: {new Date(lastVerified).toLocaleString()}</p>}
            {lastError && <p className="text-xs text-red-500">Error: {lastError}</p>}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="secondary" onClick={handleVerify} disabled={loading}>
                {loading ? "Verifying..." : "Verify"}
              </Button>
              <Button size="sm" variant="danger" onClick={handleDisconnect} disabled={loading}>
                Disconnect
              </Button>
            </div>
          </div>
        )}

        {errorMsg && <p className="text-xs text-red-500 font-medium">{errorMsg}</p>}

        <div>
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline inline-block mt-1"
          >
            Get a {name} API key &rarr;
          </a>
        </div>
      </CardContent>
    </Card>
  );
};
