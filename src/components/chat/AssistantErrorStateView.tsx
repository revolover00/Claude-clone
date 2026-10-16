import { AlertTriangle, KeyRound, RotateCcw } from "lucide-react";
import { useChat } from "../../context/ChatContext";
import { requestSettingsTab } from "../../utils/settingsTab";

interface AssistantErrorStateViewProps {
  messageId: string;
  isErrorState: boolean;
  displayErrorMessage: string;
  showErrorDetails: boolean;
  setShowErrorDetails: (show: boolean) => void;
  errorDetails?: string;
  finishReason?: string;
  onRetry?: (assistantMessageId: string) => void;
}

export default function AssistantErrorStateView({
  messageId,
  isErrorState,
  displayErrorMessage,
  showErrorDetails,
  setShowErrorDetails,
  errorDetails,
  finishReason,
  onRetry,
}: AssistantErrorStateViewProps) {
  const { setSettingsModalOpen } = useChat();

  if (isErrorState) {
    // KEY_MISSING: the server needs the user's own provider key (no server key).
    const needsKey = /Settings > Providers/.test(displayErrorMessage);
    const openProviders = () => {
      requestSettingsTab("providers");
      setSettingsModalOpen(true);
    };
    return (
      <div className="rounded-xl border border-danger/30 bg-danger-bg p-3.5 text-[14px] text-ink font-sans">
        <div className="flex items-center gap-2 text-danger font-medium">
          <AlertTriangle size={16} />
          <span>{displayErrorMessage}</span>
        </div>
        <p className="mt-1 text-[13px] text-ink-muted">
          {needsKey
            ? "Add your own provider API key once and the model list unlocks instantly."
            : "There was a temporary disruption while generating. You can try again."}
        </p>

        {needsKey && (
          <button
            type="button"
            onClick={openProviders}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
          >
            <KeyRound size={13} />
            <span>Add API key</span>
          </button>
        )}

        {errorDetails && (
          <div className="mt-2 text-[12px]">
            <button
              type="button"
              onClick={() => setShowErrorDetails(!showErrorDetails)}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-muted underline underline-offset-2 hover:text-ink transition-colors cursor-pointer"
            >
              {showErrorDetails ? "Hide Details" : "Show Details"}
            </button>
            {showErrorDetails && (
              <pre className="mt-1.5 max-h-36 overflow-x-auto rounded bg-black/40 p-2 font-mono text-[11px] text-ink-soft whitespace-pre-wrap break-all border border-line/40 select-text">
                {errorDetails}
              </pre>
            )}
          </div>
        )}

        {onRetry && (
          <button
            type="button"
            onClick={() => onRetry(messageId)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev-2 px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-elev-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Retry response</span>
          </button>
        )}
      </div>
    );
  }

  if (finishReason === "SAFETY") {
    return (
      <div className="rounded-xl border border-line/60 bg-elev-1 p-3.5 text-[14px] text-ink font-sans">
        <div className="flex items-center gap-2 text-ink-muted font-medium">
          <AlertTriangle size={16} />
          <span>The response was blocked</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={() => onRetry(messageId)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev-2 px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-elev-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  return null;
}
