import { Quote } from "lucide-react";

interface QuoteBannerProps {
  activeQuote: string | null;
  onClear: () => void;
}

export default function QuoteBanner({ activeQuote, onClear }: QuoteBannerProps) {
  if (!activeQuote) return null;

  return (
    <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-[#d97757]/30 bg-[#d97757]/10 px-3 py-2 text-[13px] text-ink shadow-sm relative pr-8 max-w-full">
      <Quote size={12} className="text-[#d97757] shrink-0" />
      <span className="font-semibold text-[#d97757] shrink-0 text-[12.5px] select-none">Quote:</span>
      <span className="truncate flex-1 italic text-ink-soft select-none">"{activeQuote}"</span>
      <button
        type="button"
        onClick={onClear}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-ink-muted hover:bg-[#d97757]/20 hover:text-ink cursor-pointer flex items-center justify-center h-5 w-5"
        title="Remove quote"
      >
        <span className="text-[10px] font-bold">✕</span>
      </button>
    </div>
  );
}
