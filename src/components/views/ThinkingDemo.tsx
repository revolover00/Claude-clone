import { useState, useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import ThoughtProcess from "../chat/ThoughtProcess";

export default function ThinkingDemo() {
  const [speed, setSpeed] = useState<number>(1);
  const [delaySec, setDelaySec] = useState<number>(0);
  const [showThinkingMode, setShowThinkingMode] = useState<"auto" | "expanded" | "collapsed">("auto");
  const [noThoughtsMode, setNoThoughtsMode] = useState<boolean>(false);
  const [noSummaryMode, setNoSummaryMode] = useState<boolean>(false);
  const [thinkingPlanHigh, setThinkingPlanHigh] = useState<boolean>(false);
  const [noHeadings, setNoHeadings] = useState<boolean>(false);
  const [thinkingToggle, setThinkingToggle] = useState<boolean>(true);
  const [isThinking, setIsThinking] = useState<boolean>(true);
  const [hasAnswerToken, setHasAnswerToken] = useState<boolean>(false);
  const [currentThoughts, setCurrentThoughts] = useState<string>("");
  const [thinkingStartTimestamp, setThinkingStartTimestamp] = useState<number>(() => Date.now());

  const scriptedThoughtsWithHeadings = `**Analyzing requirements**
Examining the prompt structure and defining key constraints.

**Searching the web**
Querying developer documentation and architectural patterns.

**Synthesizing solution**
Drafting structured response components.

**Finalizing code blocks**
Formatting final implementation details.`;

  const scriptedThoughtsNoHeadings = `Claude is an AI assistant designed to be helpful, harmless, and honest.
It uses advanced reasoning models to synthesize multi-step answers.
When extended thinking is enabled, it breaks down complex problems into clear stages.
This ensures thorough, verified output for demanding software engineering tasks.`;

  const arabicThoughtsNoHeadings = `أنت مساعد ذكاء اصطناعي تم تصميمه لتقديم إجابات دقيقة ومفيدة.
تستند النماذج إلى قدرات استدلال متقدمة لتحليل المشكلات المعقدة.
يتم تقسيم المهام إلى مراحل واضحة لضمان أعلى جودة في التنفيذ البرمجي.`;

  const rawThoughts = noHeadings ? (Math.random() > 0.5 ? arabicThoughtsNoHeadings : scriptedThoughtsNoHeadings) : scriptedThoughtsWithHeadings;

  const demoRunRef = useRef(0);

  useEffect(() => {
    const currentRun = ++demoRunRef.current;
    if (!isThinking) return;

    if (noSummaryMode || noThoughtsMode) {
      const waitTimer = setTimeout(() => {
        if (demoRunRef.current !== currentRun) return;
        setIsThinking(false);
        setHasAnswerToken(true);
      }, (delaySec || 2) * 1000);
      return () => clearTimeout(waitTimer);
    }

    const delayMs = delaySec * 1000;
    const intervalMs = speed === 2 ? 30 : speed === 0.5 ? 120 : 60;

    const delayTimer = setTimeout(() => {
      if (demoRunRef.current !== currentRun) return;
      let index = 0;
      const streamTimer = setInterval(() => {
        if (demoRunRef.current !== currentRun) {
          clearInterval(streamTimer);
          return;
        }
        index += 4;
        if (index >= rawThoughts.length) {
          setCurrentThoughts(rawThoughts);
          setIsThinking(false);
          setHasAnswerToken(true);
          clearInterval(streamTimer);
        } else {
          setCurrentThoughts(rawThoughts.slice(0, index));
        }
      }, intervalMs);
    }, delayMs);

    return () => clearTimeout(delayTimer);
  }, [speed, delaySec, noThoughtsMode, noHeadings, isThinking, rawThoughts, noSummaryMode]);

  const restartDemo = () => {
    setCurrentThoughts("");
    setIsThinking(true);
    setHasAnswerToken(false);
    setThinkingStartTimestamp(Date.now());
  };

  return (
    <div className="flex h-screen w-full flex-col bg-shell p-8 font-sans overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h1 className="text-xl font-semibold text-ink">Thinking Experience Demo</h1>
            <p className="text-[13px] text-ink-muted">Interactive testbed for timing, modes, waiting state, and stage fallbacks</p>
          </div>
          <button
            type="button"
            onClick={restartDemo}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-elev-1 px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-elev-2 cursor-pointer"
          >
            <RotateCcw size={14} /> Restart
          </button>
        </div>

        {/* Controls Grid */}
        <div className="rounded-xl border border-line bg-elev-1 p-4 shadow-xs space-y-3.5">
          {/* Speed & Delay Row */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-ink-muted">Speed:</span>
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer ${speed === s ? "bg-accent text-accent-fg" : "bg-elev-2 text-ink-soft hover:text-ink"}`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-ink-muted">Start Delay:</span>
              {[0, 2, 4].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => { setDelaySec(d); restartDemo(); }}
                  className={`rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer ${delaySec === d ? "bg-accent text-accent-fg" : "bg-elev-2 text-ink-soft hover:text-ink"}`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Show Thinking Mode */}
          <div className="flex items-center gap-2 pt-2 border-t border-line/60">
            <span className="text-[12px] font-medium text-ink-muted">Mode:</span>
            {(["auto", "expanded", "collapsed"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setShowThinkingMode(mode)}
                className={`rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer ${showThinkingMode === mode ? "bg-accent text-accent-fg" : "bg-elev-2 text-ink-soft hover:text-ink"}`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Checkboxes Row */}
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-line/60">
            <label className="flex items-center gap-2 text-[12px] font-medium text-ink-muted cursor-pointer">
              <input
                type="checkbox"
                checked={noSummaryMode}
                onChange={(e) => { setNoSummaryMode(e.target.checked); restartDemo(); }}
                className="rounded border-line text-accent focus:ring-accent"
              />
              No Summary Mode
            </label>

            <label className="flex items-center gap-2 text-[12px] font-medium text-ink-muted cursor-pointer">
              <input
                type="checkbox"
                checked={thinkingPlanHigh}
                onChange={(e) => { setThinkingPlanHigh(e.target.checked); restartDemo(); }}
                className="rounded border-line text-accent focus:ring-accent"
              />
              thinkingPlan: High
            </label>

            <label className="flex items-center gap-2 text-[12px] font-medium text-ink-muted cursor-pointer">
              <input
                type="checkbox"
                checked={noThoughtsMode}
                onChange={(e) => { setNoThoughtsMode(e.target.checked); restartDemo(); }}
                className="rounded border-line text-accent focus:ring-accent"
              />
              No Thoughts (Hidden)
            </label>

            <label className="flex items-center gap-2 text-[12px] font-medium text-ink-muted cursor-pointer">
              <input
                type="checkbox"
                checked={noHeadings}
                onChange={(e) => { setNoHeadings(e.target.checked); restartDemo(); }}
                className="rounded border-line text-accent focus:ring-accent"
              />
              No Headings
            </label>

            <label className="flex items-center gap-2 text-[12px] font-medium text-ink-muted cursor-pointer">
              <input
                type="checkbox"
                checked={thinkingToggle}
                onChange={(e) => setThinkingToggle(e.target.checked)}
                className="rounded border-line text-accent focus:ring-accent"
              />
              Thinking Toggle On
            </label>
          </div>
        </div>

        {/* Replay Sandbox Preview */}
        <div className="rounded-2xl border border-line bg-elev-1 p-6 shadow-sm space-y-4">
          <h2 className="text-[14px] font-semibold text-ink">Simulated Assistant Message</h2>
          <div className="rounded-xl border border-line/60 bg-shell p-4">
            <ThoughtProcess
              isThinking={isThinking}
              thoughts={noSummaryMode ? "" : currentThoughts}
              thinkingStartedAt={thinkingStartTimestamp}
              hasAnswerToken={hasAnswerToken}
              isSearchingWeb={true}
              sources={[{ title: "Claude Architecture Docs", url: "https://claude.ai" }]}
              showThinking={showThinkingMode}
              extendedThinking={thinkingToggle || noSummaryMode}
              thinkingPlan={thinkingPlanHigh ? { level: "high", reason: "Complex reasoning detected" } : undefined}
            />
            {(!isThinking || hasAnswerToken) && (
              <div className="mt-4 pt-4 border-t border-line text-[14px] text-ink leading-[1.6]">
                Here is the final synthesized response with clear visual hierarchy, compact spacing, and robust stage fallbacks.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
