import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ClipboardCopy, ExternalLink, RotateCw } from "lucide-react";
import {
  collectConnectionDiagnostics,
  describeExpiry,
  formatDiagnosticsReport,
  type ConnectionDiagnostics as Diagnostics,
} from "../../utils/connectionDiagnostics";
import { copyText, openAppInNewTab } from "../../utils/environment";

type Tone = "ok" | "warn" | "bad" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  ok: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-rose-500",
  neutral: "text-ink",
};

function Row({ label, value, tone = "neutral" }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-line last:border-b-0">
      <dt className="text-[12.5px] text-ink-muted">{label}</dt>
      <dd className={`text-end font-mono text-[12px] break-all ${TONE_CLASS[tone]}`}>{value}</dd>
    </div>
  );
}

export default function ConnectionDiagnostics() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [running, setRunning] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const run = useCallback(async () => {
    setRunning(true);
    setCopyState("idle");
    const result = await collectConnectionDiagnostics();
    setData(result);
    setRunning(false);
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const report = data ? formatDiagnosticsReport(data) : "";
  const copyReport = async () => setCopyState((await copyText(report)) ? "copied" : "failed");
  const server = data?.server;
  const expiryTone: Tone =
    !data?.hasSession || data.minutesUntilExpiry === null ? "neutral" : data.minutesUntilExpiry < 1 ? "bad" : "ok";

  return (
    <section aria-label="Connection diagnostics" aria-busy={running} className="rounded-xl border border-line bg-elev-1 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-[13.5px] font-semibold text-ink">Connection diagnostics</h4>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev-3 px-2.5 py-1 text-[12px] text-ink hover:bg-elev-4 disabled:opacity-50 cursor-pointer"
          >
            <RotateCw size={12} className={running ? "animate-spin" : ""} /> Run again
          </button>
          <button
            type="button"
            onClick={copyReport}
            disabled={!data || running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:bg-accent/90 disabled:opacity-50 cursor-pointer"
          >
            {copyState === "copied" ? <Check size={12} /> : <ClipboardCopy size={12} />}
            {copyState === "copied" ? "Copied" : "Copy report"}
          </button>
        </div>
      </div>

      {!data ? (
        <p className="py-3 text-[12.5px] text-ink-muted">Running checks...</p>
      ) : (
        <>
          <dl>
            <Row label="Client mode" value={data.clientMode === "supabase" ? "Real Supabase" : "Local mock"} />
            <Row label="Session" value={data.hasSession ? "Present" : "None"} tone={data.hasSession ? "ok" : "bad"} />
            <Row label="Access token expires" value={describeExpiry(data.minutesUntilExpiry, data.hasSession)} tone={expiryTone} />
            <Row label="Storage available" value={data.storageAvailable ? "Yes" : "No (blocked)"} tone={data.storageAvailable ? "ok" : "bad"} />
            <Row label="Inside an iframe" value={data.inIframe ? "Yes" : "No"} tone={data.inIframe ? "warn" : "ok"} />
            {server?.ok ? (
              <>
                <Row label="Server auth mode" value={server.data.serverMode} />
                <Row label="Server verified session" value={server.data.verified ? "Yes" : "No"} tone={server.data.verified ? "ok" : "bad"} />
                <Row label="Server error code" value={server.data.errorCode ?? "none"} tone={server.data.errorCode ? "bad" : "neutral"} />
                <Row label="Authorization header sent" value={server.data.hasAuthHeader ? `Yes (${server.data.scheme ?? "no scheme"}, ${server.data.tokenLength} chars)` : "No"} />
                <Row label="User id prefix" value={server.data.userIdPrefix ?? "none"} />
              </>
            ) : (
              <Row label="Server (/api/auth/debug)" value={server ? `Failed: ${server.error}` : "-"} tone="bad" />
            )}
          </dl>

          {data.inIframe && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[12px] text-ink">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
              <div className="flex-1">
                The app is running inside an embedded preview. Browsers can block storage and cookies in
                embedded frames, which breaks sign-in.
                <button type="button" onClick={openAppInNewTab} className="ms-1 inline-flex items-center gap-1 font-medium text-accent hover:underline cursor-pointer">
                  Open in its own tab <ExternalLink size={11} />
                </button>
              </div>
            </div>
          )}

          {copyState === "failed" && (
            <div className="mt-3">
              <p className="mb-1 text-[12px] text-ink-muted">Copying was blocked. Select the report below and copy it manually:</p>
              <pre className="max-h-48 overflow-auto rounded border border-line bg-elev-2 p-2 font-mono text-[11px] text-ink select-text whitespace-pre-wrap">{report}</pre>
            </div>
          )}
          <p className="mt-3 text-[11px] text-ink-faint">The report contains no access token or other credentials.</p>
        </>
      )}
    </section>
  );
}
