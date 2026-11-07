"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSession } from "@/components/providers/SessionProvider";
import { Button } from "@/components/ui/Button";
import { LoadingScreen, Notice } from "@/components/ui/Layout";

/**
 * Blocks the game UI until we have a live Supabase session.
 * Handles the three setup failure modes explicitly instead of pretending.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { configured, status, error, retry } = useSession();

  if (!configured) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Notice tone="warn" title="Supabase غير مربوط بعد">
          <p className="mb-3">
            أضف متغيّري البيئة التاليين في ملف <code className="rounded bg-base px-1.5 py-0.5 text-xs">.env.local</code> ثم أعد تشغيل الخادم:
          </p>
          <pre className="no-scrollbar overflow-x-auto rounded-[10px] border border-line bg-base p-3 text-left text-[11px] leading-relaxed text-muted" dir="ltr">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...`}
          </pre>
          <p className="mt-3 text-xs">
            تجدها في Supabase → Project Settings → API. وتأكّد من تفعيل
            <span className="font-bold"> Authentication → Providers → Anonymous Sign-Ins</span>.
          </p>
        </Notice>
        <div className="mt-4">
          <Link href="/settings">
            <Button variant="secondary">فتح الإعدادات</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "connecting") {
    return <LoadingScreen label="جارٍ تجهيز الجلسة…" />;
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Notice tone="bad" title="تعذّر بدء الجلسة">
          {error ?? "خطأ غير معروف."}
        </Notice>
        <div className="mt-4 flex gap-2">
          <Button onClick={retry}>أعد المحاولة</Button>
          <Link href="/settings">
            <Button variant="secondary">الإعدادات</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
