import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { isInIframe, openAppInNewTab } from "../../utils/environment";

export const IFRAME_BANNER_TEXT = "Open the app in its own tab for reliable sign-in";

/**
 * Embedded previews often block third-party storage/cookies, which breaks the
 * Supabase session. When the app is framed, offer to reopen it in its own tab.
 */
export default function IframeBanner() {
  const [framed] = useState(isInIframe);
  const [dismissed, setDismissed] = useState(false);

  if (!framed || dismissed) return null;

  return (
    <div
      role="status"
      className="relative z-50 flex shrink-0 items-center justify-between gap-3 border-b border-accent/25 bg-accent/10 px-4 py-1.5 text-[12.5px] text-ink font-sans"
    >
      <div className="flex min-w-0 items-center gap-2">
        <ExternalLink size={14} className="shrink-0 text-accent" />
        <span className="truncate">{IFRAME_BANNER_TEXT}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={openAppInNewTab}
          className="rounded-md border border-accent/30 bg-elev-1 px-2 py-0.5 text-[12px] font-medium text-ink transition-colors hover:bg-elev-2 cursor-pointer"
        >
          Open in new tab
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded p-1 text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink cursor-pointer"
          aria-label="Dismiss new tab suggestion"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
