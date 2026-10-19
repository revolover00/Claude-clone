import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { authFetch } from "../../../utils/safeFetch";

interface Run {
  provider: string;
  trigger: string;
  status: "success" | "partial" | "failed";
  started_at: string;
  added: number;
  updated: number;
  removed: number;
  total: number;
  error: string | null;
}

interface Props {
  providers: Array<{ id: string; label: string; modelCount: number }>;
  syncable: string[];
  onChanged: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  success: "text-emerald-400 border-emerald-500/25 bg-emerald-500/10",
  partial: "text-amber-400 border-amber-500/25 bg-amber-500/10",
  failed: "text-danger border-danger/25 bg-danger-bg",
};

function formatTime(iso: string): string {
  const at = Date.parse(iso);
  return Number.isFinite(at) ? new Date(at).toLocaleString() : iso;
}

/** Admin "Sync now" buttons per provider plus the catalog_sync_runs history. */
export function SyncPanel({ providers, syncable, onChanged }: Props) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      const res = await authFetch("/api/catalog/sync-runs?limit=30");
      if (!res.ok) return;
      const data = await res.json();
      setRuns(Array.isArray(data.runs) ? data.runs : []);
    } catch {
      /* history is best-effort */
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const syncNow = async (provider: string) => {
    setSyncing(provider);
    setMessage(null);
    try {
      const res = await authFetch("/api/catalog/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || `Sync failed (HTTP ${res.status})`);
      } else {
        const result = data.results?.[0];
        setMessage(
          result
            ? `${provider}: ${result.status} — +${result.added} added, ${result.updated} updated, ${result.removed} removed`
            : `${provider}: sync skipped (another run started recently)`
        );
        onChanged();
      }
      await loadRuns();
    } catch (err: any) {
      setMessage(err?.message || "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  const targets = providers.filter((p) => syncable.includes(p.id));

  return (
    <div className="rounded-xl border border-line bg-elev-1 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-[13px] font-semibold text-ink">Sync now</h4>
          <p className="text-[11px] text-ink-muted">Fetches each provider's full model list into the catalog.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {targets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => syncNow(p.id)}
              disabled={syncing !== null}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-elev-2 px-2.5 py-1 text-[12px] text-ink-soft hover:text-ink hover:bg-elev-3 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={12} className={syncing === p.id ? "animate-spin" : ""} />
              {syncing === p.id ? "Syncing…" : `Sync ${p.label}`}
            </button>
          ))}
        </div>
      </div>

      {message && <p className="text-[11.5px] text-ink-soft rounded-lg border border-line bg-shell px-2 py-1">{message}</p>}

      <div>
        <h4 className="text-[13px] font-semibold text-ink mb-1.5">Sync history</h4>
        {runs.length === 0 ? (
          <p className="text-[11.5px] text-ink-muted">No sync runs yet — use a Sync now button above or wait for the scheduled run.</p>
        ) : (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full text-[11.5px] text-left border-collapse">
              <thead>
                <tr className="text-ink-faint uppercase text-[10px]">
                  <th className="py-1 pr-3 font-semibold">Time</th>
                  <th className="py-1 pr-3 font-semibold">Provider</th>
                  <th className="py-1 pr-3 font-semibold">Trigger</th>
                  <th className="py-1 pr-3 font-semibold">Added</th>
                  <th className="py-1 pr-3 font-semibold">Updated</th>
                  <th className="py-1 pr-3 font-semibold">Removed</th>
                  <th className="py-1 pr-3 font-semibold">Status</th>
                  <th className="py-1 font-semibold">Error</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, index) => (
                  <tr key={`${run.provider}-${run.started_at}-${index}`} className="border-t border-line text-ink-soft">
                    <td className="py-1 pr-3 whitespace-nowrap font-mono text-[10.5px]">{formatTime(run.started_at)}</td>
                    <td className="py-1 pr-3">{run.provider}</td>
                    <td className="py-1 pr-3 text-ink-muted">{run.trigger}</td>
                    <td className="py-1 pr-3 font-mono text-emerald-400">+{run.added}</td>
                    <td className="py-1 pr-3 font-mono">{run.updated}</td>
                    <td className="py-1 pr-3 font-mono text-danger">{run.removed}</td>
                    <td className="py-1 pr-3">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[run.status] || ""}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="py-1 text-danger max-w-[260px] truncate" title={run.error || ""}>
                      {run.error || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
