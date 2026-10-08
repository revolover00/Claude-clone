import { useState } from "react";
import { RotateCw, Sparkles, ChevronDown } from "lucide-react";

export default function MotionReview() {
  const [userMsgKey, setUserMsgKey] = useState(0);
  const [assistantRowKey, setAssistantRowKey] = useState(0);
  const [thinkingExpanded, setThinkingExpanded] = useState(true);

  const triggerUserMsg = () => setUserMsgKey(k => k + 1);
  const triggerAssistantRow = () => setAssistantRowKey(k => k + 1);

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-shell p-6 text-ink font-sans scroll-slim">
      <div className="max-w-6xl mx-auto mb-10 border-b border-line pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent shadow-sm">
            <Sparkles size={22} className="motion-spark-rotate text-accent" />
          </div>
          <div>
            <h1 className="text-[24px] font-bold text-ink">Motion System Showcase</h1>
            <p className="text-xs text-ink-muted">A hidden route to test and review application animations side by side</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
        <div className="rounded-xl border border-line bg-elev-1 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-accent">1. User Message Enter</h3>
              <button 
                onClick={triggerUserMsg} 
                className="flex items-center gap-1.5 rounded-lg bg-elev-2 hover:bg-elev-3 px-2.5 py-1 text-xs text-ink-soft cursor-pointer transition-colors"
              >
                <RotateCw size={12} />
                <span>Replay</span>
              </button>
            </div>
            <p className="text-xs text-ink-muted mb-4">translateY(8px) + fade, 220ms ease-out</p>
            <div className="h-28 bg-[#181716] rounded-lg border border-line p-4 flex items-center justify-center relative overflow-hidden">
              <div 
                key={userMsgKey} 
                className="motion-user-enter max-w-[80%] rounded-2xl bg-composer border border-composer-line px-4 py-2.5 text-xs text-ink self-end"
              >
                Hi Claude, can you help me build a high-fidelity motion-review route?
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-elev-1 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-accent">2. Assistant Row Enter</h3>
              <button 
                onClick={triggerAssistantRow} 
                className="flex items-center gap-1.5 rounded-lg bg-elev-2 hover:bg-elev-3 px-2.5 py-1 text-xs text-ink-soft cursor-pointer transition-colors"
              >
                <RotateCw size={12} />
                <span>Replay</span>
              </button>
            </div>
            <p className="text-xs text-ink-muted mb-4">fade, 200ms</p>
            <div className="h-28 bg-[#181716] rounded-lg border border-line p-4 flex items-center justify-center relative overflow-hidden">
              <div key={assistantRowKey} className="motion-assistant-enter flex gap-3 w-full max-w-[90%] items-start">
                <div className="h-7 w-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                  <Sparkles size={14} className="text-accent" />
                </div>
                <div className="text-xs leading-relaxed text-ink-soft">
                  I'd be glad to. We will create a side-by-side interactive playground rendering every transition curve flawlessly.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-elev-1 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-accent">3. Thinking Collapse/Expand</h3>
              <button 
                onClick={() => setThinkingExpanded(!thinkingExpanded)} 
                className="flex items-center gap-1.5 rounded-lg bg-elev-2 hover:bg-elev-3 px-2.5 py-1 text-xs text-ink-soft cursor-pointer transition-colors"
              >
                <span>{thinkingExpanded ? "Collapse" : "Expand"}</span>
              </button>
            </div>
            <p className="text-xs text-ink-muted mb-4">height 250ms ease-out + chevron rotate 200ms</p>
            <div className="bg-[#181716] rounded-lg border border-line p-4 min-h-[112px] flex flex-col justify-start">
              <button 
                onClick={() => setThinkingExpanded(!thinkingExpanded)}
                className="flex items-center gap-2 text-xs font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                <ChevronDown 
                  size={14} 
                  className={`motion-chevron-rotate ${thinkingExpanded ? "motion-chevron-rotated text-accent" : ""}`} 
                />
                <span>Claude thinking process</span>
              </button>
              <div 
                className="motion-thinking-container mt-2 border-s border-line pl-3 text-xs text-ink-faint italic overflow-hidden transition-all duration-200"
                style={{ height: thinkingExpanded ? "48px" : "0px", opacity: thinkingExpanded ? 1 : 0 }}
              >
                Analyzing animation constraints...<br />
                Drafting motion.css variables...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
