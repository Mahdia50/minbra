import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "brand" | "good" | "bad" | "warn" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-elevated text-muted border-line",
  brand: "bg-brand/15 text-brand-soft border-brand/30",
  good: "bg-good/15 text-good border-good/30",
  bad: "bg-bad/15 text-bad border-bad/30",
  warn: "bg-warn/15 text-warn border-warn/30",
  accent: "bg-accent/15 text-accent border-accent/30",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  const color: Record<Tone, string> = {
    neutral: "bg-faint",
    brand: "bg-brand",
    good: "bg-good",
    bad: "bg-bad",
    warn: "bg-warn",
    accent: "bg-accent",
  };
  return <span className={cn("size-1.5 rounded-full", color[tone])} aria-hidden />;
}
