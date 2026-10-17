import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AssistantUiThread } from "./AssistantUiThread";
import { useModels } from "../../hooks/useModels";

export default function AssistantUiPage() {
  const { defaultModel } = useModels();

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-shell font-sans text-ink">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <Link
          to="/"
          aria-label="Back to chat"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink"
        >
          <ArrowLeft size={16} />
        </Link>
        <span className="text-[15px] font-medium">assistant-ui</span>
        <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] text-ink-muted">
          {defaultModel?.slug ?? "no model"}
        </span>
      </header>
      <AssistantUiThread />
    </div>
  );
}
