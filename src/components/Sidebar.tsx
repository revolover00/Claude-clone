import { useState } from "react";
import {
  Menu,
  PanelLeft,
  Search,
  ArrowLeft,
  ArrowRight,
  MessagesSquare,
  CodeXml,
  Plus,
  Archive,
  Shapes,
  Briefcase,
  SlidersVertical,
  ChevronDown,
  Download,
} from "lucide-react";
import { cn } from "../utils/cn";
import IconButton from "./shared/IconButton";

type Props = {
  open: boolean;
  onToggle: () => void;
};

const NAV = [
  { label: "Projects", icon: Archive },
  { label: "Artifacts", icon: Shapes },
  { label: "Customize", icon: Briefcase },
];

export default function Sidebar({ open, onToggle }: Props) {
  const [tab, setTab] = useState<"chat" | "code">("chat");

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-full shrink-0 flex-col border-r border-line bg-panel transition-all duration-300 ease-out lg:static",
        open
          ? "w-[85vw] max-w-[350px] translate-x-0 lg:w-[350px] lg:max-w-none"
          : "-translate-x-full w-[85vw] max-w-[350px] lg:w-0 lg:max-w-0 lg:translate-x-0 lg:overflow-hidden lg:border-r-0"
      )}
    >
      {/* left window toolbar */}
      <div className="flex h-12 shrink-0 items-center gap-0.5 px-2">
        <IconButton label="Toggle sidebar" onClick={onToggle}>
          <Menu size={18} strokeWidth={1.9} />
        </IconButton>
        <IconButton label="Toggle panel" onClick={onToggle}>
          <PanelLeft size={18} strokeWidth={1.9} />
        </IconButton>
        <IconButton label="Search">
          <Search size={18} strokeWidth={1.9} />
        </IconButton>
        <div className="w-3" />
        <IconButton label="Back" disabled>
          <ArrowLeft size={18} strokeWidth={1.9} />
        </IconButton>
        <IconButton label="Forward" disabled>
          <ArrowRight size={18} strokeWidth={1.9} />
        </IconButton>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pt-2">
        {/* segmented tabs */}
        <div
          role="tablist"
          aria-label="Workspace"
          className="flex rounded-lg border border-line bg-elev-1 p-[3px]"
        >
          <button
            role="tab"
            aria-selected={tab === "chat"}
            onClick={() => setTab("chat")}
            className={cn(
              "flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-md text-[13.5px] font-medium transition-colors duration-150",
              tab === "chat"
                ? "bg-elev-4 text-ink shadow-sm"
                : "text-ink-muted hover:text-ink-soft"
            )}
          >
            <MessagesSquare size={15} strokeWidth={1.9} />
            Chat and Cowork
          </button>
          <button
            role="tab"
            aria-selected={tab === "code"}
            onClick={() => setTab("code")}
            className={cn(
              "flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-md text-[13.5px] font-medium transition-colors duration-150",
              tab === "code"
                ? "bg-elev-4 text-ink shadow-sm"
                : "text-ink-muted hover:text-ink-soft"
            )}
          >
            <CodeXml size={15} strokeWidth={1.9} />
            Code
          </button>
        </div>

        {/* new chat */}
        <button
          type="button"
          className="mt-3 flex h-[34px] w-full items-center gap-2.5 rounded-lg bg-elev-3 px-2.5 text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-elev-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <Plus size={16} strokeWidth={2} />
          New
        </button>

        {/* primary nav */}
        <nav className="mt-1.5 flex flex-col gap-0.5">
          {NAV.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className="flex h-[34px] items-center gap-2.5 rounded-md px-2.5 text-[14px] text-ink-soft transition-colors duration-150 hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <Icon size={17} strokeWidth={1.8} className="text-ink-muted" />
              {label}
            </button>
          ))}
        </nav>

        {/* chats header */}
        <div className="mt-7 flex items-center justify-between px-2 pb-1">
          <span className="text-[13px] font-medium text-ink-muted">Chats</span>
          <IconButton label="Filter chats" className="h-7 w-7">
            <SlidersVertical size={15} strokeWidth={1.8} />
          </IconButton>
        </div>

        {/* chat list (empty) */}
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto" />

        {/* user row */}
        <div className="-mx-3 flex h-16 shrink-0 items-center gap-2 border-t border-line-soft px-4">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pe-1 text-start transition-colors duration-150 hover:bg-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-elev-3 text-[11px] font-semibold text-ink-soft">
              R
            </span>
            <span
              aria-label="Account name"
              className="h-[14px] w-[132px] max-w-[40%] shrink rounded-[4px] bg-elev-3"
            />
            <span className="shrink-0 text-[13px] text-ink-muted">· Free</span>
            <ChevronDown size={14} strokeWidth={2} className="shrink-0 text-ink-muted" />
          </button>
          <IconButton label="Download apps">
            <Download size={16} strokeWidth={1.9} />
          </IconButton>
        </div>
      </div>
    </aside>
  );
}
