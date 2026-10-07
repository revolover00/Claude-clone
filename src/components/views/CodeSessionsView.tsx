import { CodeXml, Terminal, Play, Plus } from "lucide-react";
import { useChat } from "../../context/ChatContext";

export default function CodeSessionsView() {
  const { createNewChat } = useChat();

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-8 lg:px-12 font-sans">
      <div className="mx-auto w-full max-w-[800px]">
        {/* Header */}
        <div className="border-b border-line pb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-elev-3 text-accent">
              <CodeXml size={18} />
            </div>
            <h1 className="text-[26px] font-medium text-ink">Code sessions</h1>
          </div>
          <p className="mt-1 text-[14px] text-ink-muted">
            Collaborative coding environments, live script execution, and full-stack playgrounds.
          </p>
        </div>

        {/* Empty state & templates */}
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-elev-2 text-ink-muted">
            <Terminal size={26} strokeWidth={1.8} />
          </div>

          <h2 className="mt-4 text-[17px] font-medium text-ink">
            No active code sessions
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-muted">
            Start a new session to execute code in browser, analyze logs, or prototype full-stack logic alongside Claude.
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={createNewChat}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[14px] font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <Plus size={16} strokeWidth={2.2} />
              <span>Start coding with Claude</span>
            </button>
          </div>

          {/* Quick starter cards */}
          <div className="mt-14 grid grid-cols-1 gap-3.5 sm:grid-cols-3 text-left">
            <div className="rounded-xl border border-line bg-elev-1 p-4">
              <div className="flex items-center gap-2 text-ink font-medium text-[14px]">
                <Play size={14} className="text-accent" />
                <span>React Component</span>
              </div>
              <p className="mt-2 text-[12.5px] text-ink-muted leading-relaxed">
                Build and render interactive React components with Tailwind CSS in real time.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-elev-1 p-4">
              <div className="flex items-center gap-2 text-ink font-medium text-[14px]">
                <Play size={14} className="text-accent" />
                <span>TypeScript Engine</span>
              </div>
              <p className="mt-2 text-[12.5px] text-ink-muted leading-relaxed">
                Design strict domain models, parser logic, or algorithmic utility functions.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-elev-1 p-4">
              <div className="flex items-center gap-2 text-ink font-medium text-[14px]">
                <Play size={14} className="text-accent" />
                <span>Python Script</span>
              </div>
              <p className="mt-2 text-[12.5px] text-ink-muted leading-relaxed">
                Data transformation pipelines, web scraping analysis, and calculations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
