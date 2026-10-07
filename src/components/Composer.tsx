import { useRef, useState } from "react";
import {
  Plus,
  Mic,
  ChevronDown,
  PenLine,
  GraduationCap,
  CodeXml,
  Coffee,
  Lightbulb,
  Check,
} from "lucide-react";
import { cn } from "../utils/cn";
import Chip from "./shared/Chip";
import IconButton from "./shared/IconButton";

const EFFORTS = ["Low", "Medium", "High"] as const;
type Effort = (typeof EFFORTS)[number];

const SUGGESTIONS = [
  { label: "Write", icon: PenLine, starter: "Help me write " },
  { label: "Learn", icon: GraduationCap, starter: "Explain " },
  { label: "Code", icon: CodeXml, starter: "Help me debug " },
  { label: "Life stuff", icon: Coffee, starter: "Help me plan " },
  { label: "Claude's choice", icon: Lightbulb, starter: "Surprise me — " },
];

export default function Composer() {
  const [value, setValue] = useState("");
  const [effort, setEffort] = useState<Effort>("Medium");
  const [menuOpen, setMenuOpen] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const pick = (starter: string) => {
    setValue(starter);
    areaRef.current?.focus();
  };

  return (
    <div className="anim-rise w-full" style={{ animationDelay: "120ms" }}>
      {/* composer box */}
      <div className="mx-auto flex min-h-[136px] w-full max-w-[690px] flex-col rounded-[14px] border border-composer-line bg-composer px-4 pb-2.5 pt-4 transition-all duration-200 focus-within:border-[#4c4945] focus-within:shadow-[0_0_0_3px_rgba(217,119,87,0.07)]">
        <textarea
          ref={areaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="How can I help you today?"
          rows={2}
          aria-label="Message Claude"
          className="max-h-44 w-full resize-none bg-transparent text-[15.5px] leading-6 text-ink placeholder:text-ink-muted focus:outline-none"
        />

        <div className="mt-auto flex items-center justify-between pt-2">
          <IconButton label="Add content" className="h-8 w-8 text-ink-muted hover:text-ink">
            <Plus size={18} strokeWidth={2} />
          </IconButton>

          <div className="relative flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex h-8 items-center gap-2 rounded-md px-2 transition-colors duration-150 hover:bg-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <span className="text-[13.5px] font-medium text-ink-soft">Sonnet 5</span>
              <span className="text-[13.5px] text-ink-muted">{effort}</span>
            </button>

            <IconButton
              label={micOn ? "Stop dictation" : "Dictate"}
              onClick={() => setMicOn((v) => !v)}
              className={cn("rounded-full", micOn && "anim-mic text-accent hover:text-accent")}
            >
              <Mic size={16} strokeWidth={1.9} />
            </IconButton>

            <button
              type="button"
              aria-label="Model options"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-7 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <ChevronDown size={15} strokeWidth={2} />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  className="absolute bottom-full right-0 z-20 mb-2 w-40 rounded-lg border border-line bg-elev-2 p-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                >
                  <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                    Effort
                  </p>
                  {EFFORTS.map((e) => (
                    <button
                      key={e}
                      role="menuitemradio"
                      aria-checked={effort === e}
                      onClick={() => {
                        setEffort(e);
                        setMenuOpen(false);
                      }}
                      className={cn(
                        "flex h-8 w-full items-center justify-between rounded-md px-2.5 text-[13.5px] transition-colors duration-150",
                        effort === e ? "text-ink" : "text-ink-soft hover:bg-elev-3"
                      )}
                    >
                      {e}
                      {effort === e && <Check size={14} className="text-accent" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* suggestion chips */}
      <div
        className="anim-rise mx-auto mt-12 flex max-w-[720px] flex-wrap items-center justify-center gap-2.5 px-4"
        style={{ animationDelay: "220ms" }}
      >
        {SUGGESTIONS.map(({ label, icon: Icon, starter }) => (
          <Chip key={label} icon={<Icon strokeWidth={1.8} />} onClick={() => pick(starter)}>
            {label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
