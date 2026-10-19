import { useId, useState } from "react";
import { ChevronDown, ChevronRight, LogIn, RotateCw, ShieldAlert } from "lucide-react";
import { requestSignIn, sessionErrorCode } from "../../utils/authErrors";

const HINTS: Record<string, string> = {
  AUTH_TOKEN_EXPIRED: "Your sign-in expired and could not be renewed automatically.",
  AUTH_TOKEN_INVALID: "The server did not accept your sign-in.",
  AUTH_HEADER_MISSING: "No sign-in was sent with the request.",
  AUTH_HEADER_MALFORMED: "Your sign-in was sent in an unexpected format.",
  AUTH_UNAVAILABLE: "The server could not verify your sign-in right now. Retry in a moment.",
};

interface Props {
  error?: unknown;
  onRetry: () => void;
}

/**
 * Shown instead of raw "Request failed with status 401" text whenever a
 * Settings section is rejected because of the session.
 */
export default function SessionInvalidCard({ error, onRetry }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const detailsId = useId();
  const code = sessionErrorCode(error);

  return (
    <div role="alert" className="rounded-xl border border-line bg-elev-1 p-4 font-sans text-start shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
          <ShieldAlert size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[14px] font-semibold text-ink">Your session is not valid</h4>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {HINTS[code] ?? "Sign in again to continue."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => requestSignIn(code)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-accent/90 cursor-pointer"
            >
              <LogIn size={13} />
              Sign in again
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev-3 px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-elev-4 cursor-pointer"
            >
              <RotateCw size={13} />
              Retry
            </button>
            <button
              type="button"
              onClick={() => setShowDetails((open) => !open)}
              aria-expanded={showDetails}
              aria-controls={detailsId}
              className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink cursor-pointer"
            >
              {showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>Details</span>
            </button>
          </div>
          {showDetails && (
            <dl
              id={detailsId}
              className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded border border-line bg-elev-2 p-2.5 font-mono text-[11px] text-ink-muted"
            >
              <dt>Code</dt>
              <dd className="text-ink break-all">{code}</dd>
              <dt>HTTP status</dt>
              <dd className="text-ink">401</dd>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
