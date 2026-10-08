import React from "react";
import { FileText, X } from "lucide-react";
import type { Attachment } from "../../types/chat";

interface Props {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export const AttachmentChips: React.FC<Props> = ({ attachments, onRemove }) => {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-2 pt-1 font-sans">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="group anim-popover-in relative flex items-center gap-2 rounded-lg border border-line bg-elev-1 p-1.5 pr-2.5 text-[12.5px] text-ink cursor-help"
        >
          {/* Hover preview popover for pasted text */}
          {att.isPastedText && (
            <div className="absolute bottom-full left-0 z-50 mb-2 hidden w-72 max-h-48 overflow-y-auto rounded-lg border border-line bg-elev-3 p-3 text-[11.5px] leading-relaxed text-ink-soft shadow-lg group-hover:block scroll-slim pointer-events-none select-none">
              <div className="font-semibold text-accent mb-1 border-b border-line pb-1">Pasted Text Preview</div>
              <p className="whitespace-pre-wrap">{att.url.slice(0, 400)}{att.url.length > 400 ? "..." : ""}</p>
            </div>
          )}

          {att.isImage ? (
            <img
              src={att.url}
              alt={att.name}
              className="h-9 w-9 rounded object-cover border border-line/60"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded bg-elev-2 text-accent">
              <FileText size={18} />
            </div>
          )}
          <div className="min-w-0 max-w-[140px]">
            <p className="truncate font-medium">{att.isPastedText ? "Pasted text" : att.name}</p>
            <p className="text-[10.5px] text-ink-muted">
              {att.isPastedText 
                ? `${att.wordCount?.toLocaleString() || 0} words`
                : `${(att.size / 1024).toFixed(0)} KB`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(att.id)}
            className="ml-1 text-ink-muted hover:text-ink focus-visible:outline-none"
            title="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default AttachmentChips;
