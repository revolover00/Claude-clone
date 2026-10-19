import { useEffect, useId, useState } from "react";
import { AlertTriangle, BookOpen, Check, ChevronDown, FileText, Loader2, Wrench } from "lucide-react";
import type { ToolActivityEvent } from "../../types/chat";

interface Props {
  events: ToolActivityEvent[];
  isStreaming: boolean;
  isArabic: boolean;
}

function activityTitle(event: ToolActivityEvent, isArabic: boolean): string {
  const target = event.skill?.replace(/[-_]/g, " ").trim();
  const targetSuffix = target ? ` · ${target}` : "";
  if (event.name === "load_skill") return `${isArabic ? "استخدام المهارة" : "Using skill"}${targetSuffix}`;
  if (event.name === "read_skill_file") return `${isArabic ? "قراءة ملف المهارة" : "Reading skill file"}${targetSuffix}`;
  if (event.name === "create_document") return isArabic ? "إنشاء مستند" : "Creating a document";
  const name = event.name.replace(/[-_]/g, " ");
  return `${isArabic ? "تشغيل أداة" : "Running tool"}${name ? ` · ${name}` : ""}`;
}

function statusLabel(event: ToolActivityEvent, isStreaming: boolean, isArabic: boolean): string {
  if (event.status === "completed") return isArabic ? "اكتمل" : "Done";
  if (event.status === "error") return isArabic ? "تعذر التنفيذ" : "Could not complete";
  return isStreaming
    ? (isArabic ? "جارٍ التنفيذ" : "Running")
    : (isArabic ? "توقف قبل الاكتمال" : "Stopped before completion");
}

export default function ToolActivityView({ events, isStreaming, isArabic }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  const hasRunningTool = events.some((event) => event.status === "executing");

  useEffect(() => {
    if (isStreaming && hasRunningTool) setIsOpen(true);
  }, [hasRunningTool, isStreaming]);

  if (events.length === 0) return null;

  const hasFailedTool = events.some((event) => event.status === "error") || (hasRunningTool && !isStreaming);
  const activitySummary = hasRunningTool && isStreaming
    ? (isArabic ? "جارٍ العمل" : "Working")
    : hasFailedTool
      ? (isArabic ? "خطوة تحتاج إلى مراجعة" : "A step needs attention")
      : (isArabic ? `${events.length} ${events.length === 1 ? "خطوة" : "خطوات"}` : `${events.length} ${events.length === 1 ? "step" : "steps"}`);

  return (
    <section dir={isArabic ? "rtl" : "ltr"} className="my-2 overflow-hidden rounded-xl border border-line/60 bg-elev-1/70 font-sans">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-start transition-colors hover:bg-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
      >
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${hasRunningTool && isStreaming ? "bg-accent/15 text-accent" : "bg-elev-2 text-ink-muted"}`}>
          {hasRunningTool && isStreaming ? <Loader2 size={13} className="animate-spin motion-reduce:animate-none" /> : <Wrench size={13} />}
        </span>
        <span className="min-w-0 flex-1 text-[12.5px] font-medium text-ink-soft">
          {isArabic ? "نشاط الأدوات" : "Tool activity"}
        </span>
        <span aria-live="polite" className={`text-[11px] ${hasRunningTool && isStreaming ? "text-accent" : "text-ink-muted"}`}>
          {activitySummary}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-ink-muted transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <ol id={listId} className="space-y-1 border-t border-line/50 px-3 py-2">
          {events.map((event, index) => {
            const running = event.status === "executing" && isStreaming;
            const Icon = running ? Loader2 : event.status === "completed" ? Check : AlertTriangle;
            const title = activityTitle(event, isArabic);
            return (
              <li key={event.id || `${event.name}-${index}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-[12px]">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${running ? "bg-accent/10 text-accent" : event.status === "error" || event.status === "executing" ? "bg-danger-bg text-danger" : "bg-elev-2 text-ink-muted"}`}>
                  <Icon size={12} className={running ? "animate-spin motion-reduce:animate-none" : ""} />
                </span>
                {event.name === "load_skill" ? <BookOpen size={13} className="shrink-0 text-ink-faint" /> : null}
                {event.name === "create_document" ? <FileText size={13} className="shrink-0 text-ink-faint" /> : null}
                <span className="min-w-0 flex-1 truncate text-ink-soft">{title}</span>
                <span className={`shrink-0 text-[11px] ${running ? "text-accent" : event.status === "error" || event.status === "executing" ? "text-danger" : "text-ink-muted"}`}>
                  {statusLabel(event, isStreaming, isArabic)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
