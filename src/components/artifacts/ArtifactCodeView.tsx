import ErrorBoundary from "../shared/ErrorBoundary";

interface ArtifactCodeViewProps {
  currentCode: string;
  previousCode: string;
  showDiff: boolean;
  setShowDiff: (show: boolean) => void;
  highlightedLines: string[];
  diffLinesWithHighlight: Array<{ type: "added" | "removed" | "normal"; html: string }>;
  codeContainerRef: React.RefObject<HTMLDivElement | null>;
  versionsCount: number;
}

export default function ArtifactCodeView({
  previousCode,
  showDiff,
  setShowDiff,
  highlightedLines,
  diffLinesWithHighlight,
  codeContainerRef,
  versionsCount,
}: ArtifactCodeViewProps) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[#181716] flex flex-col w-full">
      {versionsCount > 1 && (
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-[#1c1a19] px-4 py-2 text-xs select-none">
          <span className="font-medium text-ink-soft">Compare with previous version</span>
          <label className="flex items-center gap-1.5 cursor-pointer text-ink-muted hover:text-ink transition-colors">
            <input
              type="checkbox"
              checked={showDiff}
              onChange={(e) => setShowDiff(e.target.checked)}
              className="accent-accent cursor-pointer rounded"
            />
            <span>Show changes (Diff)</span>
          </label>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ErrorBoundary fallbackType="artifact">
          <div
            ref={codeContainerRef}
            className="scroll-slim h-full overflow-auto p-4 text-[13px] font-mono leading-relaxed"
          >
            {showDiff && previousCode ? (
              <div className="flex flex-col w-full text-start">
                {diffLinesWithHighlight.map((line, lineIdx) => {
                  if (line.type === "added") {
                    return (
                      <div
                        key={lineIdx}
                        className="flex items-start bg-emerald-950/30 text-emerald-300 border-s-2 border-emerald-500 px-2 py-0.5 w-full leading-relaxed"
                      >
                        <span className="text-emerald-500/50 w-6 shrink-0 text-right pr-2 select-none font-bold">
                          +
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: line.html || "&nbsp;" }} />
                      </div>
                    );
                  } else if (line.type === "removed") {
                    return (
                      <div
                        key={lineIdx}
                        className="flex items-start bg-rose-950/25 text-rose-300/80 line-through border-s-2 border-rose-500 px-2 py-0.5 w-full leading-relaxed"
                      >
                        <span className="text-rose-500/50 w-6 shrink-0 text-right pr-2 select-none font-bold">
                          -
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: line.html || "&nbsp;" }} />
                      </div>
                    );
                  } else {
                    return (
                      <div key={lineIdx} className="flex items-start px-2 py-0.5 w-full leading-relaxed text-ink-soft">
                        <span className="text-ink-muted/20 w-6 shrink-0 text-right pr-2 select-none">
                          &nbsp;
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: line.html || "&nbsp;" }} />
                      </div>
                    );
                  }
                })}
              </div>
            ) : (
              <pre className="code-with-lines m-0 text-ink text-start">
                <code>
                  {highlightedLines.map((lineHtml, lineIdx) => (
                    <span
                      key={lineIdx}
                      className="code-line"
                      dangerouslySetInnerHTML={{
                        __html: lineHtml || "&nbsp;",
                      }}
                    />
                  ))}
                </code>
              </pre>
            )}
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}
