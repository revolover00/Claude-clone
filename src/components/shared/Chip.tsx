import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  children: ReactNode;
};

export default function Chip({ icon, children, className, ...rest }: Props) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-line-soft bg-elev-2 px-3.5",
        "text-[14px] font-medium text-ink-soft transition-all duration-150",
        "hover:border-elev-3 hover:bg-elev-3 hover:text-ink active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        className
      )}
      {...rest}
    >
      <span className="text-ink-muted [&>svg]:h-[17px] [&>svg]:w-[17px]">{icon}</span>
      {children}
    </button>
  );
}
