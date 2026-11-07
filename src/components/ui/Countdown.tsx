"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

/**
 * Circular phase countdown. The ring drains as the phase runs out and turns
 * amber → rose in the final seconds.
 */
export function CountdownRing({
  seconds,
  total,
  size = 72,
  label,
  className,
}: {
  seconds: number;
  total: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const safeTotal = Math.max(1, total);
  const ratio = Math.max(0, Math.min(1, seconds / safeTotal));
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const urgent = seconds <= 5;
  const warning = seconds <= 10 && !urgent;
  const stroke = urgent
    ? "var(--color-bad)"
    : warning
      ? "var(--color-warn)"
      : "var(--color-brand)";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={4}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: circumference * (1 - ratio) }}
          transition={{ duration: 0.45, ease: "linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "numeric font-bold leading-none",
            urgent ? "text-bad" : warning ? "text-warn" : "text-ink",
          )}
          style={{ fontSize: size * 0.3 }}
        >
          {seconds}
        </span>
        {label && <span className="mt-0.5 text-[9px] text-muted">{label}</span>}
      </div>
    </div>
  );
}

/** Horizontal slim timer for compact headers. */
export function CountdownBar({ seconds, total }: { seconds: number; total: number }) {
  const ratio = Math.max(0, Math.min(1, seconds / Math.max(1, total)));
  const urgent = seconds <= 5;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <motion.div
        className={cn("h-full rounded-full", urgent ? "bg-bad" : "bg-brand")}
        animate={{ width: `${ratio * 100}%` }}
        transition={{ duration: 0.45, ease: "linear" }}
      />
    </div>
  );
}
