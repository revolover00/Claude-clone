import { useState } from "react";
import { 
  Play, 
  RotateCw, 
  Sparkles, 
  ChevronDown, 
  MoreHorizontal, 
  Send, 
  Square, 
  X
} from "lucide-react";

export default function MotionReview() {
  // Replay keys to trigger re-renders of entering animations
  const [userMsgKey, setUserMsgKey] = useState(0);
  const [assistantRowKey, setAssistantRowKey] = useState(0);
  const [popoverKey, setPopoverKey] = useState(0);
  const [modalKey, setModalKey] = useState(0);
  const [chipsKey, setChipsKey] = useState(0);

  // Dynamic animation states
  const [thinkingExpanded, setThinkingExpanded] = useState(true);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [sendText, setSendText] = useState("Hello");
  const [generating, setGenerating] = useState(false);
  const [panelWidth, setPanelWidth] = useState(500);

  // Stagger chips constant array
  const chips = ["Tailwind", "React", "Babel", "Lucide", "Recharts"];

  const triggerUserMsg = () => setUserMsgKey(k => k + 1);
  const triggerAssistantRow = () => setAssistantRowKey(k => k + 1);
  const triggerPopover = () => {
    setPopoverOpen(true);
    setPopoverKey(k => k + 1);
  };
  const triggerModal = () => {
    setModalOpen(true);
    setModalKey(k => k + 1);
  };
  const triggerChips = () => setChipsKey(k => k + 1);

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-shell p-6 text-ink font-sans scroll-slim">
      {/* Header */}
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
        
        {/* 1. User Message Enter */}
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

        {/* 2. Assistant Row Enter */}
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

        {/* 3. Thinking Collapse & Expand */}
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
                className="motion-thinking-container mt-2 border-s border-line pl-3 text-xs text-ink-faint italic"
                style={{ height: thinkingExpanded ? "48px" : "0px", opacity: thinkingExpanded ? 1 : 0 }}
              >
                Analyzing animation constraints...<br />
                Drafting motion.css variables...<br />
                Coordinating duration settings with cubic bezier.
              </div>
            </div>
          </div>
        </div>

        {/* 4. Action Bar Hover */}
        <div className="rounded-xl border border-line bg-elev-1 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-accent">4. Action Bar Hover</h3>
              <span className="text-xs text-ink-muted">Hover elements below</span>
            </div>
            <p className="text-xs text-ink-muted mb-4">opacity 120ms</p>
            
            <div className="h-28 bg-[#181716] rounded-lg border border-line p-4 flex items-center justify-center relative overflow-hidden">
              <div className="flex items-center gap-1.5 rounded-lg border border-line bg-elev-1 p-1">
                {["Like", "Dislike", "Copy", "Retry"].map((label, i) => (
                  <button 
                    key={i} 
                    className="motion-action-hover opacity-60 hover:opacity-100 bg-transparent hover:bg-elev-3 text-xs px-2.5 py-1.5 rounded-md text-ink cursor-pointer font-medium"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 5. Popovers & Menus */}
        <div className="rounded-xl border border-line bg-elev-1 p-5 flex flex-col justify-between relative">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-accent">5. Popovers/Menus</h3>
              <button 
                onClick={triggerPopover} 
                className="flex items-center gap-1.5 rounded-lg bg-elev-2 hover:bg-elev-3 px-2.5 py-1 text-xs text-ink-soft cursor-pointer transition-colors"
              >
                <RotateCw size={12} />
                <span>Trigger</span>
              </button>
            </div>
            <p className="text-xs text-ink-muted mb-4">scale .96 -&gt; 1 + fade 150ms, origin at trigger</p>
            
            <div className="h-32 bg-[#181716] rounded-lg border border-line p-4 flex items-center justify-center relative">
              <div className="relative">
                <button 
                  onClick={() => setPopoverOpen(!popoverOpen)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-elev-2 text-ink hover:bg-elev-3 transition-colors cursor-pointer"
                >
                  <MoreHorizontal size={16} />
                </button>

                {popoverOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setPopoverOpen(false)} />
                    <div 
                      key={popoverKey}
                      className="motion-popover absolute left-0 mt-1.5 z-20 w-40 rounded-lg border border-line bg-elev-1 p-1.5 shadow-xl text-left"
                    >
                      <button className="flex h-7 w-full items-center rounded px-2 text-xs text-ink hover:bg-elev-2 transition-colors text-left">
                        Settings
                      </button>
                      <button className="flex h-7 w-full items-center rounded px-2 text-xs text-ink hover:bg-elev-2 transition-colors text-left">
                        Export as MD
                      </button>
                      <button className="flex h-7 w-full items-center rounded px-2 text-xs text-danger hover:bg-danger-bg transition-colors text-left">
                        Delete Chat
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 6. Modals & Backdrops */}
        <div className="rounded-xl border border-line bg-elev-1 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-accent">6. Modals & Backdrops</h3>
              <button 
                onClick={triggerModal} 
                className="flex items-center gap-1.5 rounded-lg bg-elev-2 hover:bg-elev-3 px-2.5 py-1 text-xs text-ink-soft cursor-pointer transition-colors"
              >
                <Play size={12} />
                <span>Show Modal</span>
              </button>
            </div>
            <p className="text-xs text-ink-muted mb-4">backdrop fade 180ms + panel scale .97 -&gt; 1</p>
            
            <div className="h-32 bg-[#181716] rounded-lg border border-line p-4 flex items-center justify-center relative">
              <span className="text-xs text-ink-faint">Click "Show Modal" above to test layers</span>

              {modalOpen && (
                <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
                  {/* Backdrop */}
                  <div 
                    onClick={() => setModalOpen(false)}
                    className="motion-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-[1px] rounded-lg"
                  />
                  {/* Panel */}
                  <div 
                    key={modalKey}
                    className="motion-modal-panel relative z-40 w-full max-w-xs rounded-xl border border-line bg-elev-1 p-4 shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-ink">Action Panel</h4>
                      <button onClick={() => setModalOpen(false)} className="text-ink-muted hover:text-ink cursor-pointer">
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-[11px] text-ink-soft leading-relaxed">
                      Test modal entrance scaling flawlessly over the backdrop transition layer.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 7. Send & Stop Button Transition */}
        <div className="rounded-xl border border-line bg-elev-1 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-accent">7. Send &amp; Stop Transition</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSendText(sendText ? "" : "Hello")}
                  className="rounded-lg bg-elev-2 hover:bg-elev-3 px-2.5 py-1 text-xs text-ink-soft cursor-pointer transition-colors"
                >
                  Toggle text
                </button>
                <button 
                  onClick={() => setGenerating(!generating)}
                  className="rounded-lg bg-elev-2 hover:bg-elev-3 px-2.5 py-1 text-xs text-ink-soft cursor-pointer transition-colors"
                >
                  Toggle stream
                </button>
              </div>
            </div>
            <p className="text-xs text-ink-muted mb-4">scale-in 150ms when text appears; morph to Stop square when generating</p>
            
            <div className="h-28 bg-[#181716] rounded-lg border border-line p-4 flex items-center justify-center relative overflow-hidden">
              <div className="flex items-center gap-3 bg-composer border border-composer-line px-3 py-1.5 rounded-xl w-full max-w-xs justify-between">
                <div className="text-xs text-ink-muted font-sans truncate pr-2">
                  {sendText || <span className="italic text-ink-faint">Type a message...</span>}
                </div>
                
                {/* Send or Stop Button with consistent morphing classes */}
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                  {generating ? (
                    <button 
                      onClick={() => setGenerating(false)}
                      className="motion-send-button flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-accent text-white hover:opacity-95 cursor-pointer shadow-sm"
                    >
                      <Square size={12} fill="white" />
                    </button>
                  ) : (
                    sendText.trim() && (
                      <button 
                        onClick={() => setGenerating(true)}
                        className="motion-send-button flex h-7.5 w-7.5 items-center justify-center rounded-full bg-accent text-white hover:opacity-95 cursor-pointer shadow-sm"
                      >
                        <Send size={12} strokeWidth={2.2} />
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 8. Chip Stagger */}
        <div className="rounded-xl border border-line bg-elev-1 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-accent">8. Chip Stagger Sequence</h3>
              <button 
                onClick={triggerChips} 
                className="flex items-center gap-1.5 rounded-lg bg-elev-2 hover:bg-elev-3 px-2.5 py-1 text-xs text-ink-soft cursor-pointer transition-colors"
              >
                <RotateCw size={12} />
                <span>Trigger stagger</span>
              </button>
            </div>
            <p className="text-xs text-ink-muted mb-4">60ms stagger per item</p>
            
            <div className="h-28 bg-[#181716] rounded-lg border border-line p-4 flex items-center justify-center relative overflow-hidden">
              <div key={chipsKey} className="flex flex-wrap gap-2 justify-center">
                {chips.map((chip, idx) => (
                  <span 
                    key={`${chip}-${idx}`}
                    style={{ animationDelay: `${idx * 60}ms` }}
                    className="motion-user-enter rounded-full border border-line bg-elev-1 px-3 py-1.5 text-xs text-ink-soft select-none"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 9. Artifact Panel Slider */}
        <div className="rounded-xl border border-line bg-elev-1 p-5 flex flex-col justify-between md:col-span-2">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-accent">9. Artifact Panel Slide &amp; Width Transition</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPanelWidth(360)} 
                  className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${panelWidth === 360 ? "bg-accent text-white" : "bg-elev-2 text-ink-soft hover:bg-elev-3"}`}
                >
                  Mobile Frame (360px)
                </button>
                <button 
                  onClick={() => setPanelWidth(480)} 
                  className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${panelWidth === 480 ? "bg-accent text-white" : "bg-elev-2 text-ink-soft hover:bg-elev-3"}`}
                >
                  Tablet Frame (480px)
                </button>
                <button 
                  onClick={() => setPanelWidth(650)} 
                  className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${panelWidth === 650 ? "bg-accent text-white" : "bg-elev-2 text-ink-soft hover:bg-elev-3"}`}
                >
                  Desktop Frame (650px)
                </button>
              </div>
            </div>
            <p className="text-xs text-ink-muted mb-4">width transition 300ms ease-out, chat column reflows without a jump</p>
            
            <div className="h-44 bg-[#181716] rounded-lg border border-line flex relative overflow-hidden">
              {/* Chat column placeholder */}
              <div className="flex-1 p-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="h-2 w-3/4 rounded bg-elev-3" />
                  <div className="h-2 w-1/2 rounded bg-elev-3" />
                  <div className="h-2 w-5/6 rounded bg-elev-3" />
                </div>
                <span className="text-[10px] text-ink-muted select-none">Reflowing column without jumps</span>
              </div>
              
              {/* Simulated Artifact Panel */}
              <div 
                className="motion-artifact-panel bg-elev-1 border-l border-line h-full flex flex-col p-4 shadow-2xl shrink-0"
                style={{ width: `${panelWidth}px` }}
              >
                <div className="flex items-center justify-between border-b border-line pb-2 mb-2">
                  <span className="text-xs font-semibold text-ink">Simulated Artifact Panel</span>
                  <div className="h-1.5 w-12 rounded bg-elev-4" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-1.5 w-full rounded bg-elev-2" />
                  <div className="h-1.5 w-5/6 rounded bg-elev-2" />
                  <div className="h-1.5 w-11/12 rounded bg-elev-2" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 10. Claude Spark Animations */}
        <div className="rounded-xl border border-line bg-elev-1 p-5 flex flex-col justify-between md:col-span-2">
          <div>
            <h3 className="text-sm font-semibold text-accent mb-4">10. Claude Spark Shimmer &amp; Rotation</h3>
            <p className="text-xs text-ink-muted mb-4">rotate 2.4s linear infinite; shimmer 1.8s linear infinite</p>
            
            <div className="h-28 bg-[#181716] rounded-lg border border-line p-4 flex items-center justify-center gap-10">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 border border-accent/25">
                  <Sparkles size={24} className="motion-spark-rotate text-accent" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-ink">Rotating Spark</h4>
                  <p className="text-[11px] text-ink-muted mt-0.5">2.4s rotation loop</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-sm font-bold tracking-wide uppercase px-3 py-1.5 rounded-lg border border-line bg-elev-1">
                  <span className="motion-spark-shimmer">Claude is thinking...</span>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-ink">Thinking Text Shimmer</h4>
                  <p className="text-[11px] text-ink-muted mt-0.5">1.8s moving gradient</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
