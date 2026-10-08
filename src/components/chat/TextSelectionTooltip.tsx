import { Copy, Quote } from "lucide-react";

interface TextSelectionTooltipProps {
  selection: { text: string; x: number; y: number } | null;
  onCopy: () => void;
  onQuote: () => void;
}

export default function TextSelectionTooltip({
  selection,
  onCopy,
  onQuote,
}: TextSelectionTooltipProps) {
  if (!selection) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: `${selection.y}px`,
        left: `${selection.x}px`,
        transform: "translate(-50%, -100%)",
        zIndex: 1000,
      }}
      className="flex items-center gap-1 rounded-lg border border-line bg-[#1e1c1a] p-1 shadow-lg anim-fade-in anim-sheet-up font-sans select-none"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
        }}
        className="inline-flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-white hover:bg-[#2e2b28] transition-colors font-medium cursor-pointer"
      >
        <Copy size={13} />
        <span>Copy</span>
      </button>
      <div className="h-4 w-px bg-line/60 mx-0.5" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onQuote();
        }}
        className="inline-flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-white hover:bg-[#2e2b28] transition-colors font-medium cursor-pointer"
      >
        <Quote size={13} />
        <span>Quote</span>
      </button>
    </div>
  );
}
