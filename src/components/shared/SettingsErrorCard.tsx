import React, { useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, RotateCw } from "lucide-react";
import SessionInvalidCard from "./SessionInvalidCard";
import { isSessionError } from "../../utils/authErrors";

interface Props {
  title?: string;
  onRetry: () => void;
  error?: any;
}

const GenericErrorCard: React.FC<Props> = ({
  title = "Couldn't load this section",
  onRetry,
  error,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const errorString =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : error && typeof error === "object"
      ? JSON.stringify(error, null, 2)
      : "An unexpected error occurred while communicating with the server.";

  return (
    <div className="rounded-xl border border-line bg-elev-1 p-4 font-sans text-start shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
          <AlertCircle size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[14px] font-semibold text-ink">{title}</h4>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Something went wrong while fetching this data. You can try reloading.
          </p>
          <div className="mt-3 flex items-center gap-3">
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
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink cursor-pointer"
            >
              {showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>Details</span>
            </button>
          </div>
          {showDetails && (
            <pre className="mt-2.5 max-h-36 overflow-auto rounded bg-elev-2 p-2.5 text-[11px] font-mono text-ink-muted border border-line whitespace-pre-wrap break-all">
              {errorString}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Error card for Settings sections. Session failures (401 / AUTH_* codes) get the
 * dedicated "Your session is not valid" card instead of raw HTTP text.
 */
export const SettingsErrorCard: React.FC<Props> = (props) =>
  isSessionError(props.error) ? (
    <SessionInvalidCard error={props.error} onRetry={props.onRetry} />
  ) : (
    <GenericErrorCard {...props} />
  );

export default SettingsErrorCard;
