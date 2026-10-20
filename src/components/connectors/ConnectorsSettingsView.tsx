import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ExternalLink, Loader2, Plug, Plus, Search, X } from "lucide-react";
import { authFetch } from "../../utils/safeFetch";
import { AddMcpDialog, ConnectorCard, ConnectorIcon } from "./ConnectorElements";
import { CATEGORY_LABELS, CATEGORY_ORDER, responsePayload, type Connector, type CustomConnection, type Filter } from "./connectorTypes";

export function ConnectorsSettingsView() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [customConnections, setCustomConnections] = useState<CustomConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("all");
  const [busyKey, setBusyKey] = useState("");
  const [selected, setSelected] = useState<Connector | CustomConnection | null>(null);
  const [addMcpOpen, setAddMcpOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch("/api/connectors");
      const payload = await responsePayload(response);
      setConnectors(Array.isArray(payload.connectors) ? payload.connectors : []);
      setCustomConnections(Array.isArray(payload.customConnections) ? payload.customConnections : []);
    } catch (err: any) {
      setError(err?.message || "Unable to load connectors.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const result = localStorage.getItem("claude_clone_connector_oauth_result");
    if (result === "success") setNotice("Connector connected successfully.");
    if (result === "error") setNotice("Connector authorization was not completed.");
    if (result) localStorage.removeItem("claude_clone_connector_oauth_result");
  }, []);

  const availableCategories = useMemo(() => {
    const values = new Set(connectors.map((connector) => connector.category));
    return CATEGORY_ORDER.filter((value) => values.has(value)).concat([...values].filter((value) => !CATEGORY_ORDER.includes(value)).sort());
  }, [connectors]);

  const filteredConnectors = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return connectors.filter((connector) => {
      if (filter === "connected" && !connector.connected) return false;
      if (filter === "available" && connector.connected) return false;
      if (category !== "all" && connector.category !== category) return false;
      if (normalizedSearch && !`${connector.name} ${connector.description} ${connector.category}`.toLowerCase().includes(normalizedSearch)) return false;
      return true;
    });
  }, [category, connectors, filter, search]);

  const filteredCustomConnections = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return customConnections;
    return customConnections.filter((connection) =>
      `${connection.displayName} ${connection.serverUrl || ""} ${connection.accountLabel || ""}`.toLowerCase().includes(normalizedSearch)
    );
  }, [customConnections, search]);

  const connectedCount = connectors.filter((connector) => connector.connected).length + customConnections.length;

  const startOAuth = async (connector: Connector) => {
    if (!connector.oauthConfigured || busyKey) return;
    setBusyKey(connector.slug);
    setError("");
    try {
      const response = await authFetch(`/api/connectors/${encodeURIComponent(connector.slug)}/oauth/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = await responsePayload(response);
      if (typeof payload?.authorizationUrl !== "string") throw new Error("The server did not return an authorization URL.");
      window.location.assign(payload.authorizationUrl);
    } catch (err: any) {
      setError(err?.message || "Unable to start connector authorization.");
      setBusyKey("");
    }
  };

  const disconnect = async (connectionId: string) => {
    if (!window.confirm("Disconnect this connector? The saved authorization will be removed from this app.")) return;
    setBusyKey(connectionId);
    setError("");
    try {
      const response = await authFetch(`/api/connectors/${encodeURIComponent(connectionId)}`, { method: "DELETE" });
      await responsePayload(response);
      setSelected(null);
      await load();
    } catch (err: any) {
      setError(err?.message || "Unable to disconnect connector.");
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[780px] space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3 pr-6 sm:pr-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Connectors</h3>
            <span className="rounded-full border border-line bg-elev-2 px-2 py-0.5 text-[10.5px] font-medium text-ink-muted">{connectedCount} connected</span>
          </div>
          <p className="mt-1 max-w-[600px] text-[12px] leading-5 text-ink-muted">Connect the tools you use. Connected tools can be called by supported models during a conversation.</p>
        </div>
        <button type="button" onClick={() => setAddMcpOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-elev-1 px-3 py-2 text-[11.5px] font-medium text-ink transition-colors hover:bg-elev-3">
          <Plus size={14} /> Add MCP server
        </button>
      </div>

      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-[11.5px] text-ink-soft">
          <span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss" className="text-ink-muted hover:text-ink"><X size={14} /></button>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-bg px-3 py-2.5 text-[11.5px] text-danger">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /><span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss" className="text-danger/70 hover:text-danger"><X size={14} /></button>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-line/80 bg-panel/60 p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search connectors" aria-label="Search connectors" className="w-full rounded-xl border border-line bg-elev-1 py-2 pl-9 pr-3 text-[12.5px] text-ink outline-none placeholder:text-ink-faint focus:border-accent" />
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-elev-2 p-1" role="group" aria-label="Connector status filter">
          {(["all", "connected", "available"] as Filter[]).map((value) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${filter === value ? "bg-elev-1 text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
              {value === "all" ? "All" : value === "connected" ? "Connected" : "Available"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setCategory("all")} className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${category === "all" ? "border-ink/20 bg-elev-3 text-ink" : "border-line text-ink-muted hover:bg-elev-2 hover:text-ink"}`}>All categories</button>
        {availableCategories.map((value) => (
          <button key={value} type="button" onClick={() => setCategory(value)} className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${category === value ? "border-ink/20 bg-elev-3 text-ink" : "border-line text-ink-muted hover:bg-elev-2 hover:text-ink"}`}>
            {CATEGORY_LABELS[value] || value}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[170px] items-center justify-center gap-2 text-[12px] text-ink-muted"><Loader2 size={15} className="animate-spin" /> Loading connectors…</div>
      ) : filteredConnectors.length === 0 && filteredCustomConnections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-panel/40 px-5 py-10 text-center">
          <Plug size={23} className="mx-auto text-ink-faint" />
          <p className="mt-3 text-[13px] font-medium text-ink">No connectors found</p>
          <p className="mt-1 text-[11.5px] text-ink-muted">Try another search or add an MCP server.</p>
        </div>
      ) : (
        <>
          {filteredCustomConnections.length > 0 && filter !== "available" && category === "all" && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Your MCP servers</h4>
                <span className="text-[10.5px] text-ink-faint">{filteredCustomConnections.length} connected</span>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {filteredCustomConnections.map((connection) => (
                  <article key={connection.id} className="flex min-h-[150px] flex-col rounded-2xl border border-line bg-elev-1 p-4">
                    <div className="flex items-start gap-3">
                      <ConnectorIcon icon="server" color="#6B7280" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="truncate text-[14px] font-semibold text-ink">{connection.displayName}</h4>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[10.5px] font-medium text-accent"><Check size={11} /> Connected</span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-ink-faint" title={connection.serverUrl || undefined}>{connection.serverUrl}</p>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <span className="text-[11px] text-ink-muted">{connection.toolsCount} {connection.toolsCount === 1 ? "tool" : "tools"} available in chat</span>
                      <button type="button" onClick={() => setSelected(connection)} className="rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-ink transition-colors hover:bg-elev-3">Manage</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {filteredConnectors.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Browse connectors</h4>
                <span className="text-[10.5px] text-ink-faint">{filteredConnectors.length} available</span>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {filteredConnectors.map((connector) => (
                  <ConnectorCard
                    key={connector.slug}
                    connector={connector}
                    busy={busyKey === connector.slug}
                    onOpen={() => setSelected(connector)}
                    onConnect={() => void startOAuth(connector)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-[520px] rounded-2xl border border-line bg-elev-1 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.45)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <ConnectorIcon icon={(selected as Connector).icon || "server"} color={(selected as Connector).accentColor || "#6B7280"} size="lg" />
                <div>
                  <h3 className="text-[15px] font-semibold text-ink">{(selected as Connector).name || (selected as CustomConnection).displayName}</h3>
                  <p className="mt-1 text-[11.5px] text-ink-muted">
                    {"category" in selected ? (CATEGORY_LABELS[selected.category] || selected.category) : "Custom MCP server"}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="rounded-lg p-1 text-ink-muted hover:bg-elev-3 hover:text-ink"><X size={17} /></button>
            </div>

            <p className="mt-4 text-[12.5px] leading-5 text-ink-muted">
              {"description" in selected ? selected.description : (selected.serverUrl || "Remote MCP server")}
            </p>
            {"category" in selected && (
              <div className="mt-4 space-y-2 rounded-xl border border-line bg-panel/70 p-3 text-[11.5px]">
                <div className="flex justify-between gap-3"><span className="text-ink-faint">Authentication</span><span className="text-ink-soft">OAuth 2.0</span></div>
                <div className="flex justify-between gap-3"><span className="text-ink-faint">Chat tools</span><span className="text-ink-soft">{selected.toolsAvailable ? (selected.connected ? `${selected.toolsCount} discovered` : "Available after connecting") : "Not configured"}</span></div>
                {selected.connected && selected.accountLabel && <div className="flex justify-between gap-3"><span className="text-ink-faint">Account</span><span className="max-w-[65%] truncate text-ink-soft">{selected.accountLabel}</span></div>}
              </div>
            )}
            {"category" in selected && !selected.toolsAvailable && (
              <p className="mt-3 text-[11px] leading-4 text-ink-faint">This service can authorize an account, but its tools are not configured for use in chat.</p>
            )}
            {"websiteUrl" in selected && selected.websiteUrl && (
              <a href={selected.websiteUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-accent hover:underline">Visit website <ExternalLink size={12} /></a>
            )}

            <div className="mt-5 flex items-center justify-between gap-2">
              {"connectionId" in selected && selected.connectionId ? (
                <button type="button" disabled={busyKey === selected.connectionId} onClick={() => void disconnect(selected.connectionId!)} className="rounded-lg border border-danger/25 px-3 py-2 text-[11.5px] font-medium text-danger transition-colors hover:bg-danger-bg disabled:opacity-50">
                  {busyKey === selected.connectionId ? "Disconnecting…" : "Disconnect"}
                </button>
              ) : "id" in selected ? (
                <button type="button" disabled={busyKey === selected.id} onClick={() => void disconnect(selected.id)} className="rounded-lg border border-danger/25 px-3 py-2 text-[11.5px] font-medium text-danger transition-colors hover:bg-danger-bg disabled:opacity-50">
                  {busyKey === selected.id ? "Disconnecting…" : "Disconnect"}
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setSelected(null)} className="rounded-lg px-3 py-2 text-[11.5px] text-ink-muted hover:bg-elev-3 hover:text-ink">Close</button>
                {"category" in selected && !selected.connected && (
                  <button type="button" disabled={!selected.oauthConfigured || !!busyKey} onClick={() => void startOAuth(selected)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[11.5px] font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
                    {busyKey === selected.slug ? <Loader2 size={13} className="animate-spin" /> : "Connect"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {addMcpOpen && <AddMcpDialog onClose={() => setAddMcpOpen(false)} onAdded={() => void load()} />}
    </div>
  );
}
