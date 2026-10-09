import { useState, useEffect, useRef } from "react";
import { ChevronRight, Check, Loader2, Globe } from "lucide-react";
import ClaudeSpark from "../icons/ClaudeSpark";
import { parseThinkingStages, ThinkingStage } from "../../utils/thinkingStages";
import MarkdownView from "./MarkdownView";

type Props = {
  isThinking: boolean;
  thoughts?: string;
  hasAnswerToken?: boolean;
};

export default function ThoughtProcess({ isThinking, thoughts = "", hasAnswerToken = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const stages = parseThinkingStages(thoughts);

  useEffect(() => {
    if (hasAnswerToken) return;
    const start = Date.now();
    const interval = setInterval(() => setElapsedSec(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [hasAnswerToken]);

  if (!isThinking && !thoughts) return null;

  const currentStage = stages.find(s => !s.done) || stages[stages.length - 1];

  return (
    <div className="my-2 select-none font-sans">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
        <ChevronRight size={16} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
        <ClaudeSpark size={16} className="anim-thinking-spark text-accent" />
        <span className="font-medium">
          {hasAnswerToken ? `Thought for ${elapsedSec}s` : (currentStage?.title || "Thinking")}
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 space-y-4 pl-6 border-l-2 border-line">
          {stages.map((stage, i) => (
            <div key={i} className="flex gap-3">
              <div className="mt-1">
                {stage.done ? <Check size={16} className="text-accent" /> : <div className="h-4 w-4 rounded-full bg-accent animate-pulse" />}
              </div>
              <div>
                <p className="text-sm font-semibold">{stage.title}</p>
                <div className="text-sm text-ink-muted mt-1"><MarkdownView content={stage.body} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
