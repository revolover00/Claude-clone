import { cn } from "../../utils/cn";

export interface SlashCommand {
  name: string;
  desc: string;
  action: string;
}

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
      <div className="px-3 py-1.5 text-[11px] font-bold text-accent uppercase tracking-wider select-none">Commands</div>
      <div className="max-h-56 overflow-y-auto scroll-slim flex flex-col gap-0.5">
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
            <div className="flex items-center gap-2.5">
              <span className={cn("font-semibold font-mono", idx === slashIndex ? "text-white" : "text-accent")}>{cmd.name}</span>
              <span className={cn("text-[12.5px]", idx === slashIndex ? "text-white/80" : "text-ink-muted")}>{cmd.desc}</span>
            </div>
            <span className={cn("text-[10px] font-mono select-none px-1.5 py-0.5 rounded border uppercase", 
              idx === slashIndex ? "border-white/40 bg-white/10 text-white" : "border-line bg-elev-1 text-ink-muted"
            )}>
              {idx === slashIndex ? "↩ Enter" : "Tab"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
