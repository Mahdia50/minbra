import { cn } from "@/lib/utils/cn";

const SIZES = {
  xs: "size-7 text-sm rounded-[9px]",
  sm: "size-9 text-lg rounded-[11px]",
  md: "size-11 text-xl rounded-[13px]",
  lg: "size-14 text-2xl rounded-[16px]",
  xl: "size-20 text-4xl rounded-[22px]",
} as const;

export function Avatar({
  emoji,
  size = "md",
  className,
  ring,
  muted,
}: {
  emoji: string;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: "brand" | "good" | "bad" | "warn" | null;
  muted?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-line bg-elevated leading-none",
        SIZES[size],
        ring === "brand" && "border-brand/70 shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-brand)_22%,transparent)]",
        ring === "good" && "border-good/70 shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-good)_22%,transparent)]",
        ring === "bad" && "border-bad/70 shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-bad)_22%,transparent)]",
        ring === "warn" && "border-warn/70 shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-warn)_22%,transparent)]",
        muted && "opacity-45 grayscale",
        className,
      )}
    >
      {emoji}
    </span>
  );
}
