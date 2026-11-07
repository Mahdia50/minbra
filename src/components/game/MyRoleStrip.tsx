"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { MyRole } from "@/lib/types";

/** Persistent reminder of your role. Tucked away by default so a neighbour's glance learns nothing. */
export function MyRoleStrip({ myRole }: { myRole: MyRole | null }) {
  const [shown, setShown] = useState(false);
  if (!myRole) return null;

  const isOutlier = myRole.role === "outlier";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-[14px] border px-4 py-2.5",
        isOutlier ? "border-bad/40 bg-bad/10" : "border-brand/35 bg-brand/10",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">{isOutlier ? "🕵️" : "🔑"}</span>
        {isOutlier ? (
          <span className="text-sm font-semibold text-bad">أنت خارج السالفة — لا تعرف الكلمة</span>
        ) : (
          <span className="text-sm text-muted">
            كلمتك:{" "}
            <span
              className={cn(
                "font-bold text-ink transition-all duration-200",
                !shown && "blur-[6px] select-none",
              )}
              onClick={() => setShown((v) => !v)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => event.key === "Enter" && setShown((v) => !v)}
            >
              {myRole.word_text}
            </span>
          </span>
        )}
      </div>
      {!isOutlier && (
        <button
          onClick={() => setShown((v) => !v)}
          className="shrink-0 text-[11px] font-semibold text-muted hover:text-ink"
        >
          {shown ? "إخفاء" : "إظهار"}
        </button>
      )}
    </div>
  );
}
