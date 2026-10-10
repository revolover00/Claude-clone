import { useState, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import ThoughtProcess from "../chat/ThoughtProcess";

export default function ThinkingDemo() {
  const [speed, setSpeed] = useState<number>(1);
  const [thinkingToggle, setThinkingToggle] = useState<boolean>(true);
  const [noHeadings, setNoHeadings] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(true);

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

  const [currentThoughts, setCurrentThoughts] = useState<string>("");

  useEffect(() => {
    if (!isThinking) return;

    let index = 0;
    const intervalMs = speed === 2 ? 30 : speed === 0.5 ? 120 : 60;

    const timer = setInterval(() => {
      index += 3;
      if (index >= rawThoughts.length) {
        setCurrentThoughts(rawThoughts);
        setIsThinking(false);
        clearInterval(timer);
      } else {
        setCurrentThoughts(rawThoughts.slice(0, index));
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [speed, noHeadings, isThinking, rawThoughts]);

  const restartDemo = () => {
    setCurrentThoughts("");
    setIsThinking(true);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-shell p-8 font-sans">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h1 className="text-xl font-semibold text-ink">Thinking Experience Demo</h1>
            <p className="text-[13px] text-ink-muted">Interactive replay of thinking stages, timers, and visual hierarchy</p>
          </div>
          <button
            type="button"
            onClick={restartDemo}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-elev-1 px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-elev-2"
          >
            <RotateCcw size={14} /> Restart
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-elev-1 p-4 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-medium text-ink-muted">Speed:</span>
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors ${speed === s ? "bg-accent text-accent-fg" : "bg-elev-2 text-ink-soft hover:text-ink"}`}
              >
                {s}x
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-muted cursor-pointer">
              <input
                type="checkbox"
                checked={thinkingToggle}
                onChange={(e) => setThinkingToggle(e.target.checked)}
                className="rounded border-line text-accent focus:ring-accent"
              />
              Thinking Toggle On
            </label>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-muted cursor-pointer">
              <input
                type="checkbox"
                checked={noHeadings}
                onChange={(e) => { setNoHeadings(e.target.checked); restartDemo(); }}
                className="rounded border-line text-accent focus:ring-accent"
              />
              No Headings (Paragraph Fallback)
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-elev-1 p-6 shadow-sm space-y-4">
          <h2 className="text-[14px] font-semibold text-ink">Simulated Assistant Message</h2>
          <div className="rounded-xl border border-line/60 bg-shell p-4">
            <ThoughtProcess
              isThinking={isThinking}
              thoughts={currentThoughts}
              thinkingStartedAt={Date.now() - 4000}
              isSearchingWeb={true}
              sources={[{ title: "Claude Architecture Docs", url: "https://claude.ai" }]}
            />
            {!isThinking && (
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
