import { useState, useEffect } from "react";
import { X, Loader2, Brain, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";

export interface LevelDiagnosticResult {
  level: "low" | "medium" | "high";
  accepted: boolean;
  error: string | null;
  timeToFirstThoughtMs: number | null;
  thoughtParts: number;
  thoughtChars: number;
  thoughtsTokenCount: number;
  totalMs: number;
  fallbackApplied: boolean;
  firstThoughtPreview: string;
}

export interface DiagnosticData {
  levels: Record<"low" | "medium" | "high", LevelDiagnosticResult>;
  verdict:
    | "Returns thought summaries"
    | "Thinks but returns no summary"
    | "Does not think"
    | "Rejected the config";
}

interface Props {
  modelSlug: string;
  modelName: string;
  onClose: () => void;
}

export default function ThinkingDiagnosticModal({ modelSlug, modelName, onClose }: Props) {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const runTest = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/models/${modelSlug}/test-thinking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${res.status}`);
        }
        const json = await res.json();
        if (!isCancelled) setData(json);
      } catch (err: any) {
        if (!isCancelled) setError(err.message || "Failed to run reasoning test");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    runTest();
    return () => {
      isCancelled = true;
    };
  }, [modelSlug]);

  const getVerdictBadge = (verdict: DiagnosticData["verdict"]) => {
    switch (verdict) {
      case "Returns thought summaries":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/25">
            <CheckCircle2 size={13} /> Returns thought summaries
          </span>
        );
      case "Thinks but returns no summary":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/25">
            <Brain size={13} /> Thinks but returns no summary
          </span>
        );
      case "Does not think":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-elev-3 px-3 py-1 text-xs font-semibold text-ink-muted border border-line">
            Does not think
          </span>
        );
      case "Rejected the config":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-bg px-3 py-1 text-xs font-semibold text-danger border border-danger/25">
            <AlertCircle size={13} /> Rejected the config
          </span>
        );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="thinking-diag-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in font-sans"
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-line bg-elev-1 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-accent" />
            <h2 id="thinking-diag-title" className="text-base font-semibold text-ink">
              Thinking Diagnostic: {modelName}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-ink-muted hover:bg-elev-2 hover:text-ink cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Area */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 size={28} className="animate-spin text-accent" />
            <p className="text-xs text-ink-muted">
              Running 3-boxes logic puzzle across low, medium & high effort levels...
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger/25 bg-danger-bg p-4 text-xs text-danger space-y-1">
            <p className="font-semibold">Diagnostic Failed</p>
            <p>{error}</p>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Verdict */}
            <div className="flex items-center justify-between rounded-xl border border-line/60 bg-elev-2 p-3.5">
              <div>
                <span className="text-[11.5px] uppercase font-semibold text-ink-muted tracking-wider">
                  Model Verdict
                </span>
                <div className="mt-1">{getVerdictBadge(data.verdict)}</div>
              </div>
              <span className="text-[11px] text-ink-muted">Prompt: 3 Mislabeled Boxes Puzzle</span>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line bg-elev-2 text-ink-muted font-medium">
                    <th className="py-2.5 px-3">Level</th>
                    <th className="py-2.5 px-3">Accepted</th>
                    <th className="py-2.5 px-3">1st Thought</th>
                    <th className="py-2.5 px-3">Parts / Chars</th>
                    <th className="py-2.5 px-3">Tokens</th>
                    <th className="py-2.5 px-3">Total Time</th>
                    <th className="py-2.5 px-3">Fallback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {(["low", "medium", "high"] as const).map((lvl) => {
                    const row = data.levels[lvl];
                    return (
                      <tr key={lvl} className="hover:bg-elev-2/40">
                        <td className="py-2.5 px-3 font-semibold capitalize text-ink">{lvl}</td>
                        <td className="py-2.5 px-3">
                          {row.accepted ? (
                            <span className="text-emerald-400 font-medium">Yes</span>
                          ) : (
                            <span className="text-danger font-medium">No</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-ink-muted">
                          {row.timeToFirstThoughtMs !== null
                            ? `${(row.timeToFirstThoughtMs / 1000).toFixed(1)}s`
                            : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-ink-muted">
                          {row.thoughtParts > 0
                            ? `${row.thoughtParts} / ${row.thoughtChars}`
                            : "0 / 0"}
                        </td>
                        <td className="py-2.5 px-3 text-ink-muted">
                          {row.thoughtsTokenCount > 0 ? row.thoughtsTokenCount : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-ink-muted">
                          {(row.totalMs / 1000).toFixed(1)}s
                        </td>
                        <td className="py-2.5 px-3">
                          {row.fallbackApplied ? (
                            <span className="text-amber-400">Yes</span>
                          ) : (
                            <span className="text-ink-muted">No</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Thought Preview if available */}
            {Object.values(data.levels).some((r) => r.firstThoughtPreview) && (
              <div className="rounded-xl border border-line bg-elev-2/60 p-3 text-xs space-y-1">
                <span className="font-semibold text-ink">Thought Preview (High Level):</span>
                <p className="font-mono text-[11px] text-ink-muted whitespace-pre-wrap line-clamp-3">
                  {data.levels.high.firstThoughtPreview ||
                    data.levels.medium.firstThoughtPreview ||
                    data.levels.low.firstThoughtPreview}
                </p>
              </div>
            )}

            {/* How to read this Hint */}
            <div className="rounded-xl border border-line/60 bg-elev-2/30 p-3 text-[11.5px] text-ink-muted space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-ink">
                <HelpCircle size={13} className="text-accent" />
                <span>How to read this</span>
              </div>
              <ul className="list-disc pl-4 space-y-0.5 leading-[1.5]">
                <li>
                  <strong className="text-ink">Returns thought summaries:</strong> The model streamed thought chunks and displays reasoning timelines in the UI.
                </li>
                <li>
                  <strong className="text-ink">Thinks but returns no summary:</strong> Internal reasoning tokens were used, but no raw thought text was exposed.
                </li>
                <li>
                  <strong className="text-ink">Does not think:</strong> Model answered directly without reasoning tokens or thought summaries.
                </li>
                <li>
                  <strong className="text-ink">Rejected the config:</strong> Model API rejected thinking parameters (fallback applied or error).
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-line">
          <button
            onClick={onClose}
            className="rounded-lg bg-elev-3 px-3 py-1.5 text-xs font-medium text-ink hover:bg-elev-2 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
