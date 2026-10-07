import { useState } from "react";
import { ChevronRight } from "lucide-react";
import ClaudeSpark from "../icons/ClaudeSpark";

type Props = {
  isThinking: boolean;
  thoughts?: string;
  duration?: string;
};

export default function ThoughtProcess({
  isThinking,
  thoughts = "",
  duration = "1.6s",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  // While waiting for first token and no thought content generated yet
  if (isThinking && !thoughts) {
    return (
      <div className="flex items-center gap-2.5 py-1.5 text-ink-soft">
        <ClaudeSpark size={18} className="anim-thinking-spark text-accent shrink-0" />
        <span className="anim-thinking-text text-[14.5px] font-sans font-medium tracking-wide">
          Thinking...
        </span>
      </div>
    );
  }

  // Once thoughts exist or during thinking with thought stream
  return (
    <div className="my-2 select-none font-sans">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="group inline-flex items-center gap-2 rounded-md py-1 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
        aria-expanded={isOpen}
      >
        <ChevronRight
          size={14}
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-90" : "rotate-0"
          }`}
        />
        {isThinking ? (
          <div className="flex items-center gap-2">
            <ClaudeSpark size={14} className="anim-thinking-spark text-accent shrink-0" />
            <span className="anim-thinking-text font-medium">Thinking...</span>
          </div>
        ) : (
          <span>Thought process <span className="text-ink-faint">· {duration}</span></span>
        )}
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          isOpen ? "max-h-96 opacity-100 mt-1.5" : "max-h-0 opacity-0"
        }`}
      >
        <div className="scroll-slim max-h-80 overflow-y-auto rounded-r-md border-l-2 border-[#45423e] bg-elev-1/50 py-2.5 pl-3.5 pr-3 text-[13px] leading-relaxed text-ink-muted font-mono whitespace-pre-line">
          {thoughts ||
            "Analyzing user intent and constraints...\nDetermining appropriate response tone, structure, and language.\nSynthesizing concise, accurate, and actionable solution."}
        </div>
      </div>
    </div>
  );
}
