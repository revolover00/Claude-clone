import React from "react";
import { cn } from "../../utils/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = "primary",
  size = "md",
  disabled,
  children,
  ...props
}) => {
  const variantStyles = {
    primary: "bg-accent text-accent-ink hover:opacity-90 active:scale-[0.98]",
    secondary: "bg-elev-2 text-ink hover:bg-elev-3 active:scale-[0.98] border border-line",
    ghost: "bg-transparent text-ink-muted hover:bg-elev-2 hover:text-ink",
    outline: "border border-line bg-transparent text-ink hover:bg-elev-2",
    danger: "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20",
  }[variant];

  const sizeStyles = {
    sm: "px-2.5 py-1 text-xs rounded-md",
    md: "px-3.5 py-1.5 text-sm rounded-lg",
    lg: "px-4 py-2 text-base rounded-lg",
  }[size];

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
        variantStyles,
        sizeStyles,
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
