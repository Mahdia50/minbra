"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { CountdownRing } from "@/components/ui/Countdown";
import { Badge } from "@/components/ui/Badge";
import { PHASE_HINT, PHASE_LABEL } from "@/lib/constants";
import { secondsLeft } from "@/lib/hooks/useNow";
import type { RoundPhase } from "@/lib/types";

export function PhaseShell({
  phase,
  endsAt,
  total,
  now,
  badge,
  children,
  footer,
}: {
  phase: RoundPhase;
  endsAt: string | null;
  total: number;
  now: number;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const left = secondsLeft(endsAt, now);

  return (
    <motion.section
      key={phase}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="panel overflow-hidden"
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink">{PHASE_LABEL[phase]}</h2>
            {badge}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{PHASE_HINT[phase]}</p>
        </div>
        {left !== null && <CountdownRing seconds={left} total={total} size={64} />}
      </div>

      <div className="p-4 sm:p-5">{children}</div>
      {footer && <div className="border-t border-line px-4 py-3.5 sm:px-5">{footer}</div>}
    </motion.section>
  );
}

export function PhaseBadge({ children }: { children: ReactNode }) {
  return <Badge tone="brand">{children}</Badge>;
}
