"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "@/components/providers/SessionProvider";
import { Button } from "@/components/ui/Button";
import { LoadingScreen, Notice } from "@/components/ui/Layout";
import { inspectSupabaseUrl, pingSupabase } from "@/lib/supabase/client";

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
    return <SessionError error={error} onRetry={retry} />;
  }

  return <>{children}</>;
}

/**
 * The gate hides the app, which would also hide the diagnostics page. So the
 * connection test lives right here, next to the failure it explains.
 */
function SessionError({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const host = inspectSupabaseUrl().host;
  const [ping, setPing] = useState<null | { ok: boolean; detail: string }>(null);
  const [pinging, setPinging] = useState(false);

  async function testConnection() {
    setPinging(true);
    setPing(await pingSupabase());
    setPinging(false);
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <Notice tone="bad" title="تعذّر بدء الجلسة">
        <p>{error ?? "خطأ غير معروف."}</p>
        <p className="mt-2 text-xs text-muted">
          الرابط المستخدم:{" "}
          <span className="font-mono" dir="ltr">
            {host ?? "غير معروف"}
          </span>
        </p>
      </Notice>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={onRetry}>أعد المحاولة</Button>
        <Button variant="secondary" loading={pinging} onClick={() => void testConnection()}>
          اختبر الاتصال بـ Supabase
        </Button>
        <Link href="/settings">
          <Button variant="ghost">الإعدادات</Button>
        </Link>
      </div>

      {ping && (
        <p className={ping.ok ? "mt-3 text-sm font-semibold text-good" : "mt-3 text-sm font-semibold text-bad"}>
          {ping.detail}
        </p>
      )}
    </div>
  );
}
