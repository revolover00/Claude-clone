import { useState, useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import ClaudeSpark from "../icons/ClaudeSpark";
import { formatThinkingDuration } from "../../utils/streamSmoothing";

type Props = {
  isThinking: boolean;
  thoughts?: string;
  thinkingStartedAt?: number;
  firstTokenAt?: number;
  thinkingMs?: number;
  hasAnswerToken?: boolean;
};

export default function ThoughtProcess({
  isThinking,
  thoughts = "",
  thinkingStartedAt,
  firstTokenAt,
  thinkingMs,
  hasAnswerToken = false,
}: Props) {
  // Whether user manually opened/closed the reasoning accordion
  const [userOpenedManually, setUserOpenedManually] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const thoughtsScrollRef = useRef<HTMLDivElement>(null);

  // Live timer while no answer token has arrived
  useEffect(() => {
    if (hasAnswerToken) return;
    const start = thinkingStartedAt || Date.now();

    const interval = setInterval(() => {
      const ms = Date.now() - start;
      setElapsedSec(Math.floor(ms / 1000));
    }, 500);

    return () => clearInterval(interval);
  }, [hasAnswerToken, thinkingStartedAt]);

  // When reasoning is streaming, auto-scroll internal reasoning text to bottom
  useEffect(() => {
    if (isOpen && thoughtsScrollRef.current) {
      thoughtsScrollRef.current.scrollTop = thoughtsScrollRef.current.scrollHeight;
    }
  }, [thoughts, isOpen]);

  // Auto-open accordion when reasoning is live
  useEffect(() => {
    if (!hasAnswerToken) {
      setIsOpen(true);
    }
  }, [hasAnswerToken]);

  // Auto-collapse (250ms) when first answer token arrives, unless user opened it manually
  const prevHasAnswerTokenRef = useRef(hasAnswerToken);
  useEffect(() => {
    if (!prevHasAnswerTokenRef.current && hasAnswerToken) {
      if (!userOpenedManually) {
        setIsOpen(false);
      }
    }
    prevHasAnswerTokenRef.current = hasAnswerToken;
  }, [hasAnswerToken, userOpenedManually]);

  // If model produced no reasoning and thinking is finished, show NOTHING
  if (!isThinking && !thoughts) {
    return null;
  }

  // Calculate real duration
  let durationText = "";
  if (thinkingMs && thinkingMs > 0) {
    durationText = formatThinkingDuration(thinkingMs);
  } else if (thinkingStartedAt && firstTokenAt && firstTokenAt >= thinkingStartedAt) {
    durationText = formatThinkingDuration(firstTokenAt - thinkingStartedAt);
  } else if (elapsedSec > 0) {
    durationText = `${elapsedSec}s`;
  }

  const isReasoningLive = !hasAnswerToken;

  // STATE A: Waiting for first byte (no thoughts yet, no answer token yet)
  if (!thoughts && !hasAnswerToken) {
    return (
      <div className="flex items-center gap-2.5 py-1.5 text-ink-soft select-none font-sans">
        <ClaudeSpark size={18} className="anim-thinking-spark text-accent shrink-0" />
        <span className="anim-thinking-text text-[14.5px] font-medium tracking-wide">
          Thinking · {elapsedSec}s
        </span>
      </div>
    );
  }

  // STATE B & C: Reasoning has streamed or is streaming
  const handleToggle = () => {
    setUserOpenedManually(true);
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="my-2 select-none font-sans">
      <button
        type="button"
        onClick={handleToggle}
        className="group inline-flex items-center gap-2 rounded-md py-1 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 cursor-pointer"
        aria-expanded={isOpen}
      >
        <ChevronRight
          size={14}
          className={`shrink-0 transition-transform duration-250 ease-out ${
            isOpen ? "rotate-90" : "rotate-0"
          }`}
        />

        {isReasoningLive ? (
          <div className="flex items-center gap-2">
            <ClaudeSpark size={14} className="anim-thinking-spark text-accent shrink-0" />
            <span className="anim-thinking-text font-medium">
              Thinking · {elapsedSec}s
            </span>
          </div>
        ) : (
          <span className="text-ink-muted">
            Thought for <span className="text-ink-soft font-mono text-[12px]">{durationText || "1s"}</span>
          </span>
        )}
      </button>

      {/* Reasoning text block with top fade mask, max-h-64, auto-scroll, 250ms height animation */}
      <div
        className={`overflow-hidden transition-all duration-250 ease-out ${
          isOpen ? "max-h-64 opacity-100 mt-1.5" : "max-h-0 opacity-0"
        }`}
      >
        <div className="relative rounded-lg border-l-2 border-[#45423e] bg-elev-1/60">
          {/* Top fade mask */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-[#262523] to-transparent z-10 opacity-70" />

          <div
            ref={thoughtsScrollRef}
            className="scroll-slim max-h-64 overflow-y-auto py-2.5 pl-3.5 pr-3 text-[13px] leading-relaxed text-ink-muted font-mono whitespace-pre-line select-text"
          >
            {thoughts}
          </div>
        </div>
      </div>
    </div>
  );
}
