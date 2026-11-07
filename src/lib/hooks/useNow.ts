"use client";

import { useEffect, useState } from "react";

/**
 * A coarse ticking clock. Every subscriber shares one interval, so adding
 * countdowns all over a page costs a single timer.
 */
export function useNow(intervalMs = 500) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}

/** Seconds left until an ISO timestamp (never negative). */
export function secondsLeft(endsAt: string | null | undefined, now: number) {
  if (!endsAt) return null;
  const end = Date.parse(endsAt);
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - now) / 1000));
}

/** mm:ss formatter for the phase timers. */
export function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
