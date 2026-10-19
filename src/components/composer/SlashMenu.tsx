import { cn } from "../../utils/cn";
import { Brain, Globe, Eye } from "lucide-react";
import type { SlashCommand } from "./useSlashCommands";

interface SlashMenuProps {
  filteredCommands: SlashCommand[];
  slashIndex: number;
  setSlashIndex: (idx: number) => void;
  executeCommand: (action: string) => void;
}

export default function SlashMenu({
  filteredCommands,
  slashIndex,
  setSlashIndex,
  executeCommand,
}: SlashMenuProps) {
  return (
    <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-full max-w-[690px] rounded-xl border border-composer-line bg-composer p-1.5 shadow-xl anim-popover-in z-50 font-sans">
      <div className="px-3 py-1.5 text-[11px] font-bold text-accent uppercase tracking-wider select-none">
        Commands
      </div>
      <div className="max-h-60 overflow-y-auto scroll-slim flex flex-col gap-0.5">
        {filteredCommands.map((cmd, idx) => (
          <button
            key={cmd.name}
            type="button"
            onClick={() => executeCommand(cmd.action)}
            onMouseEnter={() => setSlashIndex(idx)}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-start transition-colors duration-150 cursor-pointer w-full text-[13.5px]",
              idx === slashIndex
                ? "bg-accent text-white"
                : "text-ink hover:bg-elev-2 text-ink-soft"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <span
                className={cn(
                  "font-semibold font-mono shrink-0",
                  idx === slashIndex ? "text-white" : "text-accent"
                )}
              >
                {cmd.name}
              </span>
              <span
                className={cn(
                  "text-[12.5px] truncate",
                  idx === slashIndex ? "text-white/80" : "text-ink-muted"
                )}
              >
                {cmd.desc}
              </span>
              {cmd.badges && (
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {cmd.badges.thinking && (
                    <span
                      title="Thinking"
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-medium border",
                        idx === slashIndex
                          ? "bg-white/20 text-white border-white/30"
                          : "bg-amber-500/15 text-amber-300 border-amber-500/20"
                      )}
                    >
                      <Brain size={8} />
                      Thinking
                    </span>
                  )}
                  {cmd.badges.search && (
                    <span
                      title="Search"
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-medium border",
                        idx === slashIndex
                          ? "bg-white/20 text-white border-white/30"
                          : "bg-sky-500/15 text-sky-300 border-sky-500/20"
                      )}
                    >
                      <Globe size={8} />
                      Search
                    </span>
                  )}
                  {cmd.badges.vision && (
                    <span
                      title="Vision"
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-medium border",
                        idx === slashIndex
                          ? "bg-white/20 text-white border-white/30"
                          : "bg-emerald-500/15 text-emerald-300 border-emerald-500/20"
                      )}
                    >
                      <Eye size={8} />
                      Vision
                    </span>
                  )}
                </div>
              )}
            </div>
            <span
              className={cn(
                "text-[10px] font-mono select-none px-1.5 py-0.5 rounded border uppercase shrink-0",
                idx === slashIndex
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-line bg-elev-1 text-ink-muted"
              )}
            >
              {idx === slashIndex ? "↩ Enter" : "Tab"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
