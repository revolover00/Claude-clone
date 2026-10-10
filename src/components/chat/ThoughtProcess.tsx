import { useState, useEffect, useRef } from "react";
import { ChevronRight, Check, Loader2 } from "lucide-react";
import ClaudeSpark from "../icons/ClaudeSpark";
import { parseThinkingStages, formatThinkingDuration, isRtlText, type ThinkingStage } from "../../utils/thinkingStages";
import { useSharedSecondTick } from "../../utils/sharedTimer";
import MarkdownView from "./MarkdownView";

interface Props {
  isThinking: boolean;
  thoughts?: string;
  thinkingStartedAt?: number;
  firstTokenAt?: number;
  thinkingMs?: number;
  hasAnswerToken?: boolean;
  isSearchingWeb?: boolean;
  sources?: Array<{ title: string; url: string }>;
}

export default function ThoughtProcess({
  isThinking,
  thoughts = "",
  thinkingStartedAt,
  firstTokenAt,
  thinkingMs,
  hasAnswerToken = false,
  isSearchingWeb,
  sources,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const userInteractedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to the shared 1-second interval timer while thinking
  useSharedSecondTick(isThinking);

  // Parse accumulated thinking into stages
  const stages: ThinkingStage[] = parseThinkingStages(thoughts, isThinking);

  // Auto-collapse when the first answer token arrives unless manually opened
  useEffect(() => {
    if (hasAnswerToken && !userInteractedRef.current) {
      setIsOpen(false);
    }
  }, [hasAnswerToken]);

  // Auto-follow scroll in expanded view while thinking
  useEffect(() => {
    if (isOpen && isThinking && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isOpen, isThinking, thoughts]);

  // If the model produced no thinking text, show NOTHING
  if (!isThinking && (!thoughts || !thoughts.trim())) {
    return null;
  }

  const currentStage = stages.find((s) => !s.done) || stages[stages.length - 1];
  const currentTitle = currentStage?.title || "Thinking";

  // Calculate live elapsed seconds or final duration
  const now = Date.now();
  const liveElapsedSec = thinkingStartedAt ? Math.max(1, Math.floor((now - thinkingStartedAt) / 1000)) : 1;
  const finalDurationMs = thinkingMs ?? (firstTokenAt && thinkingStartedAt ? firstTokenAt - thinkingStartedAt : liveElapsedSec * 1000);

  const toggleOpen = () => {
    userInteractedRef.current = true;
    setIsOpen((prev) => !prev);
  };

  const hasSearchTool = Boolean(isSearchingWeb || (sources && sources.length > 0));

  return (
    <div className="my-2 select-none font-sans">
      {/* Polite aria-live announcement for screen readers */}
      <span className="sr-only" aria-live="polite">
        {isThinking ? currentTitle : `Finished thinking in ${formatThinkingDuration(finalDurationMs)}`}
      </span>

      {/* Collapsed / Header Row */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={isOpen}
        className="group flex items-center gap-2 rounded-md py-1 px-1.5 text-xs text-ink-muted transition-colors hover:bg-elev-2 hover:text-ink focus:outline-none"
      >
        <ChevronRight
          size={14}
          className={`shrink-0 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-90" : ""}`}
        />
        <ClaudeSpark
          size={14}
          className={`shrink-0 text-accent ${isThinking ? "anim-thinking-spark animate-pulse motion-reduce:animate-none" : ""}`}
        />

        {isThinking ? (
          <div className="flex items-center gap-1.5 font-medium overflow-hidden h-4">
            <span
              key={currentTitle}
              className="inline-block text-ink anim-sheet-up transition-all duration-200 motion-reduce:animate-none"
              style={{ animationDuration: "200ms" }}
            >
              {currentTitle}
            </span>
            <span className="text-ink-muted font-normal">· {liveElapsedSec}s</span>
          </div>
        ) : (
          <span className="font-medium text-ink-muted">
            Thought for {formatThinkingDuration(finalDurationMs)}
          </span>
        )}
      </button>

      {/* Expanded Vertical Timeline View */}
      {isOpen && (
        <div
          ref={scrollRef}
          className="relative mt-2 max-h-[320px] overflow-y-auto pl-2 pr-1 transition-all duration-250 motion-reduce:transition-none font-sans"
          style={{
            maskImage: "linear-gradient(to bottom, transparent 0px, black 16px, black calc(100% - 24px), transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 16px, black calc(100% - 24px), transparent 100%)",
          }}
        >
          <div className="relative border-l border-line/50 pl-4 py-2 space-y-[12px]">
            {/* Tool Step Node if web search was used */}
            {hasSearchTool && (
              <div className="relative flex items-start gap-2.5 anim-sheet-up" style={{ animationDuration: "180ms" }}>
                <div className="absolute -left-[21px] top-1 flex h-2 w-2 items-center justify-center rounded-full bg-accent ring-4 ring-elev-1">
                  {isSearchingWeb && !sources?.length ? (
                    <Loader2 size={8} className="animate-spin text-accent-fg motion-reduce:animate-none" />
                  ) : null}
                </div>
                <div className="text-[13px] leading-[1.6]">
                  <span className="font-medium text-ink">
                    {isSearchingWeb && !sources?.length ? "Searching the web" : `Searched the web · ${sources?.length || 0} results`}
                  </span>
                  {sources && sources.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {sources.slice(0, 4).map((s, idx) => (
                        <span key={idx} className="rounded bg-elev-2 px-1.5 py-0.5 text-[11px] text-ink-muted border border-line">
                          {s.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stages Nodes */}
            {stages.map((stage, idx) => {
              const isRtl = isRtlText(stage.title + " " + stage.body);
              const isCurrent = !stage.done && isThinking;

              return (
                <div key={idx} dir={isRtl ? "rtl" : "ltr"} className="relative flex items-start gap-2.5 anim-sheet-up" style={{ animationDuration: "180ms", animationDelay: `${idx * 40}ms` }}>
                  <div className="absolute -left-[21px] top-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-elev-3 border border-line ring-4 ring-elev-1">
                    {stage.done ? (
                      <Check size={8} className="text-accent" />
                    ) : isCurrent ? (
                      <div className="h-2 w-2 rounded-full bg-accent animate-pulse motion-reduce:animate-none" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-ink-muted" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-medium leading-[1.4] ${isCurrent ? "text-ink animate-pulse motion-reduce:animate-none" : "text-ink-soft"}`}>
                      {stage.title}
                    </p>
                    {stage.body && (
                      <div className="mt-1 text-[13px] leading-[1.6] text-ink-muted font-sans">
                        <MarkdownView content={stage.body} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Final "Done" node when finished */}
            {!isThinking && stages.length > 0 && (
              <div className="relative flex items-center gap-2.5 anim-sheet-up" style={{ animationDuration: "180ms" }}>
                <div className="absolute -left-[21px] flex h-2 w-2 items-center justify-center rounded-full bg-accent ring-4 ring-elev-1" />
                <span className="text-[13px] font-medium text-ink-muted">Done</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
