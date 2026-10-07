import React from "react";
import { ArrowDown } from "lucide-react";

interface Props {
  show: boolean;
  onClick: () => void;
}

export const ScrollToBottomButton: React.FC<Props> = ({ show, onClick }) => {
  if (!show) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="anim-fade-in absolute bottom-24 right-8 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-elev-2 text-ink shadow-md transition-all hover:bg-elev-3 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
      title="Scroll to bottom"
      aria-label="Scroll to bottom"
    >
      <ArrowDown size={17} />
    </button>
  );
};

export default ScrollToBottomButton;
