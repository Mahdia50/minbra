"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { playSfx } from "@/lib/audio";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_8px_30px_-10px_var(--color-brand)] hover:bg-brand-deep active:bg-brand-deep",
  secondary:
    "bg-elevated text-ink border border-line hover:bg-hover active:bg-hover",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-elevated/70",
  danger: "bg-bad/15 text-bad border border-bad/35 hover:bg-bad/25",
  success: "bg-good/15 text-good border border-good/35 hover:bg-good/25",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-[10px] gap-1.5",
  md: "h-11 px-5 text-sm rounded-[14px] gap-2",
  lg: "h-13 px-7 text-base rounded-[16px] gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, block, disabled, onClick, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      onClick={(event) => {
        playSfx("click");
        onClick?.(event);
      }}
      className={cn(
        "relative inline-flex select-none items-center justify-center font-semibold",
        "transition-[background-color,color,transform,box-shadow] duration-200",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
        />
      )}
      {children}
    </button>
  );
});
