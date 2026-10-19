import { useState } from "react";
import { Activity } from "lucide-react";
import ConnectionDiagnostics from "./ConnectionDiagnostics";

export default function AboutTab() {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const mode = (import.meta as any)?.env?.MODE ?? "unknown";

  return (
    <div className="space-y-5 select-none">
      <div>
        <h3 className="text-[15px] font-semibold text-ink">About</h3>
        <p className="mt-1 text-[13px] text-ink-muted">
          Claude clone: a chat interface backed by Supabase authentication and configurable model providers.
        </p>
        <p className="mt-1 font-mono text-[11.5px] text-ink-faint">Build: {mode}</p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-elev-2 p-3.5">
        <div className="min-w-0">
          <h4 className="text-[13.5px] font-medium text-ink">Having trouble signing in?</h4>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Check your session, browser storage and how the server sees your requests. Nothing secret is shown or copied.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowDiagnostics((open) => !open)}
          aria-expanded={showDiagnostics}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-elev-3 px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-elev-4 cursor-pointer"
        >
          <Activity size={14} />
          Connection diagnostics
        </button>
      </div>

      {showDiagnostics && <ConnectionDiagnostics />}
    </div>
  );
}
