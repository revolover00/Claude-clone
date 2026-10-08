import React from "react";
import { ArrowDown } from "lucide-react";

interface Props {
  show: boolean;
  onClick: () => void;
  hasNewText?: boolean;
}

export const ScrollToBottomButton: React.FC<Props> = ({ 
  show, 
  onClick,
  hasNewText = false,
}) => {
  if (!show) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="anim-fade-in anim-sheet-up absolute bottom-24 right-8 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-elev-2 text-ink shadow-md transition-all duration-200 hover:bg-elev-3 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
      title={hasNewText ? "New responses below" : "Scroll to bottom"}
      aria-label={hasNewText ? "New responses below" : "Scroll to bottom"}
    >
      <ArrowDown size={17} />
      {hasNewText && (
        <span 
          className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-white ring-2 ring-elev-2"
          title="New text arrived"
        >
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
        </span>
      )}
    </button>
  );
};

export default ScrollToBottomButton;
