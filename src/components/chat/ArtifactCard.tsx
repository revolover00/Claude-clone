import { ChevronRight, CodeXml } from "lucide-react";
import ClaudeSpark from "../icons/ClaudeSpark";

type Props = {
  title: string;
  type: string;
  version?: number;
  isStreaming?: boolean;
  onClick: () => void;
};

export default function ArtifactCard({
  title,
  type,
  version = 1,
  isStreaming = false,
  onClick,
}: Props) {
  const subtitle =
    type === "Markdown"
      ? "Document · Markdown"
      : `Code · ${type.toUpperCase()}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group my-3.5 flex items-center justify-between rounded-xl border border-line bg-elev-1 p-3.5 transition-all duration-200 hover:border-elev-3 hover:-translate-y-0.5 hover:shadow-md cursor-pointer select-none font-sans"
      aria-label={`Open artifact: ${title}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Icon: rotating spark while streaming, else code icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-elev-2 text-accent">
          {isStreaming ? (
            <ClaudeSpark size={18} className="anim-thinking-spark text-accent" />
          ) : (
            <CodeXml size={18} />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <span className="anim-thinking-text text-[14px] font-medium">
                Writing {type}...
              </span>
            ) : (
              <h4 className="truncate text-[14px] font-medium text-ink group-hover:text-accent transition-colors">
                {title || "Untitled"}
              </h4>
            )}

            {!isStreaming && version > 1 && (
              <span className="rounded bg-elev-3 px-1.5 py-0.2 text-[10.5px] font-mono font-medium text-ink-muted">
                v{version}
              </span>
            )}
          </div>

          <p className="text-[12px] text-ink-muted leading-tight mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-lg border border-line bg-elev-2/80 px-2.5 py-1 text-[12px] font-medium text-ink-soft transition-colors group-hover:border-line-soft group-hover:text-ink shrink-0 ms-3">
        <span>{isStreaming ? "View live" : "Click to open"}</span>
        <ChevronRight size={14} className="text-ink-muted group-hover:text-ink" />
      </div>
    </div>
  );
}
