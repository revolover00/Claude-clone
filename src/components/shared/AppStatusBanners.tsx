import { AlertTriangle, X } from "lucide-react";
import IframeBanner from "./IframeBanner";

interface Props {
  backendNotConfigured: boolean;
  onDismissBackendNotConfigured: () => void;
  backendUnreachable: boolean;
  onDismissBackendUnreachable: () => void;
  showZeroEnabledModels: boolean;
}

/** The stack of status banners shown above the main app layout. */
export default function AppStatusBanners({
  backendNotConfigured,
  onDismissBackendNotConfigured,
  backendUnreachable,
  onDismissBackendUnreachable,
  showZeroEnabledModels,
}: Props) {
  return (
    <>
      <IframeBanner />

      {backendNotConfigured && (
        <div className="relative z-50 flex shrink-0 items-center justify-between border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-[13px] text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-amber-400" />
            <span>AI backend is not configured</span>
          </div>
          <button
            type="button"
            onClick={onDismissBackendNotConfigured}
            className="rounded p-1 text-amber-300 transition-colors hover:bg-amber-500/20 cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {backendUnreachable && (
        <div className="relative z-50 flex shrink-0 items-center justify-between border-b border-rose-500/30 bg-rose-500/15 px-4 py-2 text-[13px] text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-rose-400" />
            <span>Backend not reachable</span>
          </div>
          <button
            type="button"
            onClick={onDismissBackendUnreachable}
            className="rounded p-1 text-rose-300 transition-colors hover:bg-rose-500/20 cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {showZeroEnabledModels && (
        <div className="relative z-50 flex shrink-0 items-center justify-between border-b border-rose-500/30 bg-rose-500/15 px-4 py-2 text-[13px] text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-rose-400 animate-pulse" />
            <span>No models enabled on the server. Go to <strong>Settings &gt; Models</strong> to configure and enable at least one chat model.</span>
          </div>
        </div>
      )}
    </>
  );
}
