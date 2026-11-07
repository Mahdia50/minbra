"use client";

import { cn } from "@/lib/utils/cn";
import { playSfx } from "@/lib/audio";

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        playSfx("click");
        onChange(!checked);
      }}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-[14px] border border-line bg-base/50 px-4 py-3 text-right transition-colors",
        "hover:border-brand/40 disabled:opacity-50",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{hint}</span>}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-250",
          checked ? "bg-brand" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all duration-250",
            checked ? "right-0.5" : "right-[22px]",
          )}
        />
      </span>
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  label,
  hint,
  unit,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label: string;
  hint?: string;
  unit?: string;
}) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  return (
    <div className="flex items-center justify-between gap-4 rounded-[14px] border border-line bg-base/50 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`إنقاص ${label}`}
          disabled={value <= min}
          onClick={() => {
            playSfx("click");
            onChange(clamp(value - 1));
          }}
          className="size-8 rounded-[10px] border border-line bg-elevated text-lg leading-none text-muted transition-colors hover:text-ink disabled:opacity-30"
        >
          −
        </button>
        <span className="numeric w-14 text-center text-sm font-bold text-ink">
          {value}
          {unit ? <span className="text-muted"> {unit}</span> : null}
        </span>
        <button
          type="button"
          aria-label={`زيادة ${label}`}
          disabled={value >= max}
          onClick={() => {
            playSfx("click");
            onChange(clamp(value + 1));
          }}
          className="size-8 rounded-[10px] border border-line bg-elevated text-lg leading-none text-muted transition-colors hover:text-ink disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex w-full items-center gap-1 rounded-[14px] border border-line bg-base/60 p-1",
        size === "sm" && "rounded-[12px]",
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => {
              playSfx("click");
              onChange(option.value);
            }}
            className={cn(
              "relative flex-1 rounded-[11px] font-semibold transition-colors duration-200",
              size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-[13px]",
              active ? "bg-elevated text-ink shadow" : "text-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
