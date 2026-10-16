import { useCallback, useEffect, useState } from "react";
import { Package, RefreshCw } from "lucide-react";
import { authFetch, safeFetchJson } from "../../utils/safeFetch";

interface CatalogSummaryResponse {
  snapshot?: { generatedAt?: string; source?: string; totalModels?: number };
  totals?: { providers: number; models: number };
  appModelCount?: number;
  catalogModelCount?: number;
  providers?: Array<{ id: string; label: string; vendor: string; modelCount: number; chatCount: number; imported: number }>;
}

/**
 * Models tab header: shows the bundled catalog that ships with the app and lets an
 * admin install it into the data-driven `models` table with one click. The server
 * does this automatically on boot, so manual model entry is never required.
 */
export default function ModelCatalogSummary({ onImported }: { onImported?: () => void }) {
  const [data, setData] = useState<CatalogSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await safeFetchJson<CatalogSummaryResponse>("/api/models/catalog");
      setData(summary);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleImport = async () => {
    setImporting(true);
    setMessage("");
    try {
      const res = await authFetch("/api/models/catalog/import", { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Import failed");
      setMessage(`Installed ${result.imported ?? 0} catalog models.`);
      await load();
      onImported?.();
    } catch (err: any) {
      setMessage(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const totals = data?.totals;

  return (
    <div className="rounded-xl border border-line bg-elev-2 p-3 space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
            <Package size={13} /> Bundled model catalog
          </h4>
          <p className="text-[11.5px] text-ink-muted">
            {totals
              ? `${totals.providers} providers · ${totals.models} models ship with the app and are installed automatically.`
              : "Every provider's models ship with the app and are installed automatically."}
            {data?.snapshot?.generatedAt ? ` Snapshot ${data.snapshot.generatedAt}.` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg border border-line bg-elev-1 px-2 py-1 text-[11.5px] text-ink-muted hover:text-ink cursor-pointer"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="rounded-lg bg-accent px-2.5 py-1 text-[11.5px] font-medium text-white hover:bg-accent/90 disabled:opacity-60 cursor-pointer"
          >
            {importing ? "Installing..." : "Reinstall from catalog"}
          </button>
        </div>
      </div>

      {data?.providers && (
        <div className="flex flex-wrap gap-1.5">
          {data.providers.map((p) => (
            <span
              key={p.id}
              title={`${p.vendor} · ${p.chatCount} chat models`}
              className="rounded-full border border-line bg-elev-1 px-2 py-0.5 text-[10.5px] text-ink-muted"
            >
              {p.label} <span className="font-mono text-ink-faint">{p.modelCount}</span>
              {p.imported > 0 && <span className="text-emerald-400"> · {p.imported} in app</span>}
            </span>
          ))}
        </div>
      )}

      {message && <p className="text-[11.5px] text-accent">{message}</p>}
      {!data && !loading && (
        <p className="text-[11.5px] text-ink-muted">
          Catalog summary unavailable. The bundled catalog still serves every provider model.
        </p>
      )}
    </div>
  );
}
