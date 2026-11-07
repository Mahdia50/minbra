"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/* ------------------------------------------------------------------ Brand */

export function Logo({ size = "md", href = "/" }: { size?: "sm" | "md" | "lg"; href?: string | null }) {
  const dims = {
    sm: "size-8 text-base rounded-[10px]",
    md: "size-10 text-xl rounded-[13px]",
    lg: "size-14 text-3xl rounded-[18px]",
  }[size];

  const mark = (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={cn(
          "relative grid place-items-center border border-brand/40 bg-gradient-to-br from-brand/25 to-accent/10 font-bold",
          dims,
        )}
      >
        <span className="absolute inset-0 rounded-[inherit] brand-glow" aria-hidden />
        <span className="relative">🕵️</span>
      </span>
      <span className="flex flex-col leading-tight">
        <span className={cn("font-[family-name:var(--font-display)] font-bold text-ink", size === "lg" ? "text-xl" : "text-[15px]")}>
          مين برّة السالفة
        </span>
        <span className="text-[10px] tracking-wide text-faint">لعبة الاستنتاج الجماعية</span>
      </span>
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} className="transition-opacity hover:opacity-85">
      {mark}
    </Link>
  );
}

/* ------------------------------------------------------------- Page shell */

export function PageShell({
  children,
  className,
  wide,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className="relative min-h-dvh app-aurora">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 app-grid" aria-hidden />
      <div className={cn("relative mx-auto w-full px-4 pb-16 pt-6 sm:px-6", wide ? "max-w-5xl" : "max-w-3xl", className)}>
        {children}
      </div>
    </div>
  );
}

export function TopBar({ children, back }: { children?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-8 flex items-center justify-between gap-4">
      <Logo size="sm" href={back ? null : "/"} />
      <div className="flex items-center gap-2">
        {back && (
          <Link
            href={back.href}
            className="rounded-[10px] px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            ← {back.label}
          </Link>
        )}
        {children}
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- States */

export function LoadingScreen({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-muted">
      <motion.span
        className="size-9 rounded-full border-2 border-brand/30 border-t-brand"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.85, ease: "linear" }}
      />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon = "🗒️",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed border-line px-6 py-14 text-center">
      <span className="text-3xl">{icon}</span>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "neutral",
  children,
  title,
}: {
  tone?: "neutral" | "brand" | "good" | "bad" | "warn";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    neutral: "border-line bg-elevated/60 text-muted",
    brand: "border-brand/30 bg-brand/10 text-brand-soft",
    good: "border-good/30 bg-good/10 text-good",
    bad: "border-bad/30 bg-bad/10 text-bad",
    warn: "border-warn/30 bg-warn/10 text-warn",
  };
  return (
    <div className={cn("rounded-[14px] border px-4 py-3 text-sm leading-relaxed", tones[tone])}>
      {title && <div className="mb-1 font-bold">{title}</div>}
      <div className="text-ink/85">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------- Stat */

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neutral" | "brand" | "good" | "bad" | "warn";
  icon?: string;
}) {
  const tones = {
    neutral: "text-ink",
    brand: "text-brand-soft",
    good: "text-good",
    bad: "text-bad",
    warn: "text-warn",
  };
  return (
    <div className="rounded-[16px] border border-line bg-surface/80 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        {icon && <span className="text-base">{icon}</span>}
      </div>
      <div className={cn("numeric mt-2 text-2xl font-bold", tones[tone])}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-faint">{hint}</div>}
    </div>
  );
}
