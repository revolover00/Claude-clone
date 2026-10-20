import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  Check,
  CircleDot,
  Code2,
  FileText,
  HardDrive,
  Loader2,
  MessageSquare,
  Plug,
  Server,
  X,
} from "lucide-react";
import { authFetch } from "../../utils/safeFetch";
import { CATEGORY_LABELS, responsePayload, type Connector } from "./connectorTypes";

export function ConnectorIcon({ icon, color, size = "md" }: { icon: string; color: string; size?: "sm" | "md" | "lg" }) {
  const dimensions = size === "lg" ? "h-12 w-12 rounded-2xl" : size === "sm" ? "h-9 w-9 rounded-xl" : "h-10 w-10 rounded-xl";
  const iconSize = size === "lg" ? 23 : size === "sm" ? 17 : 19;
  const Icon = icon === "github" ? Code2
    : icon === "notion" ? FileText
      : icon === "google-drive" ? HardDrive
        : icon === "slack" ? MessageSquare
          : icon === "linear" ? CircleDot
            : icon === "server" ? Server
              : Plug;
  return (
    <span className={`grid shrink-0 place-items-center border border-line/70 ${dimensions}`} style={{ backgroundColor: `${color}18`, color }} aria-hidden="true">
      <Icon size={iconSize} strokeWidth={1.8} />
    </span>
  );
}

export function ConnectorCard({
  connector,
  busy,
  onOpen,
  onConnect,
}: {
  connector: Connector;
  busy: boolean;
  onOpen: () => void;
  onConnect: () => void;
}) {
  return (
    <article className="group flex min-h-[186px] flex-col rounded-2xl border border-line bg-elev-1 p-4 transition-all hover:border-line-soft hover:bg-elev-2/70">
      <div className="flex items-start gap-3">
        <ConnectorIcon icon={connector.icon} color={connector.accentColor} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h4 className="truncate text-[14px] font-semibold text-ink">{connector.name}</h4>
            {connector.connected && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[10.5px] font-medium text-accent">
                <Check size={11} /> Connected
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-ink-muted">{CATEGORY_LABELS[connector.category] || connector.category}</p>
        </div>
      </div>

      <p className="mt-3 line-clamp-3 min-h-[48px] text-[12px] leading-5 text-ink-muted">{connector.description}</p>

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        {connector.connected ? (
          <span className="min-w-0 truncate text-[11px] text-ink-faint" title={connector.accountLabel || undefined}>
            {connector.accountLabel ? `Connected as ${connector.accountLabel}` : connector.toolsAvailable ? `${connector.toolsCount} tools available` : "Account connected"}
          </span>
        ) : connector.oauthConfigured ? (
          <span className="text-[11px] text-ink-faint">OAuth 2.0</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint" title="OAuth app credentials are not configured on the server.">
            <AlertCircle size={12} /> Setup required
          </span>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onOpen} className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium text-ink-muted transition-colors hover:bg-elev-3 hover:text-ink">
            Details
          </button>
          {connector.connected ? (
            <button type="button" onClick={onOpen} className="rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-ink transition-colors hover:bg-elev-3">
              Manage
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnect}
              disabled={!connector.oauthConfigured || busy}
              title={!connector.oauthConfigured ? "Configure this connector's OAuth client ID and secret on the server first." : undefined}
              className="rounded-lg bg-accent px-3 py-1.5 text-[11.5px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : "Connect"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function AddMcpDialog({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [bearerToken, setBearerToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await authFetch("/api/connectors/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, serverUrl, bearerToken }),
      });
      await responsePayload(response);
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Unable to connect to this MCP server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-mcp-title" className="w-full max-w-[520px] rounded-2xl border border-line bg-elev-1 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.45)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ConnectorIcon icon="server" color="#6B7280" />
            <div>
              <h3 id="add-mcp-title" className="text-[15px] font-semibold text-ink">Add an MCP server</h3>
              <p className="mt-1 text-[12px] leading-5 text-ink-muted">Connect a remote Streamable HTTP server to use its tools in chat.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-ink-muted hover:bg-elev-3 hover:text-ink"><X size={17} /></button>
        </div>

        <form className="mt-5 space-y-3.5" onSubmit={submit}>
          <label className="block">
            <span className="text-[11.5px] font-medium text-ink-muted">Name</span>
            <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. My internal tools" className="mt-1 w-full rounded-xl border border-line bg-elev-2 px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-accent" />
          </label>
          <label className="block">
            <span className="text-[11.5px] font-medium text-ink-muted">MCP server URL</span>
            <input required type="url" maxLength={2048} value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} placeholder="https://mcp.example.com/mcp" className="mt-1 w-full rounded-xl border border-line bg-elev-2 px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-accent" />
            <span className="mt-1 block text-[10.5px] leading-4 text-ink-faint">HTTPS only. Local and private network addresses are blocked.</span>
          </label>
          <label className="block">
            <span className="text-[11.5px] font-medium text-ink-muted">Bearer token <span className="font-normal text-ink-faint">(optional)</span></span>
            <input type="password" autoComplete="new-password" maxLength={4096} value={bearerToken} onChange={(event) => setBearerToken(event.target.value)} placeholder="Token is encrypted before storage" className="mt-1 w-full rounded-xl border border-line bg-elev-2 px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-accent" />
          </label>

          {error && <p role="alert" className="rounded-lg border border-danger/25 bg-danger-bg px-3 py-2 text-[11.5px] text-danger">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-[12px] text-ink-muted hover:bg-elev-3 hover:text-ink">Cancel</button>
            <button type="submit" disabled={busy || !name.trim() || !serverUrl.trim()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[12px] font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <><Loader2 size={13} className="animate-spin" /> Testing server...</> : "Test and connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
