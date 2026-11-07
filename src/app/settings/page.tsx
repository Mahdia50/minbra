"use client";

import { useState } from "react";
import { SessionGate } from "@/components/session/SessionGate";
import { ProfileSetup } from "@/components/session/ProfileSetup";
import { useSession } from "@/components/providers/SessionProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useCategories } from "@/lib/hooks/useCategories";
import { RoomSettingsEditor } from "@/components/room/RoomSettingsEditor";
import { PageShell, TopBar, Notice } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Controls";
import { Modal } from "@/components/ui/Modal";
import { inspectSupabaseUrl, pingSupabase } from "@/lib/supabase/client";
import type { RoomSettings } from "@/lib/constants";

export default function SettingsPage() {
  return (
    <PageShell>
      <SessionGate>
        <TopBar back={{ href: "/", label: "الرئيسية" }} />
        <Settings />
      </SessionGate>
    </PageShell>
  );
}

function Settings() {
  const { configured, player, signOut } = useSession();
  const { prefs, update, reset, defaults } = useSettings();
  const { categories } = useCategories();
  const { push } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [ping, setPing] = useState<null | { ok: boolean; detail: string }>(null);
  const [pinging, setPinging] = useState(false);

  const urlInfo = inspectSupabaseUrl();

  async function testConnection() {
    setPinging(true);
    setPing(await pingSupabase());
    setPinging(false);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">الإعدادات</h1>
        <p className="mt-1 text-sm text-muted">
          كل هذه الإعدادات محلية على جهازك — لا تُرسل إلى الخادم.
        </p>
      </header>

      {/* Profile */}
      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-ink">ملفي</h2>
            <p className="mt-0.5 text-xs text-muted">
              {player ? `تسجّل باسم «${player.display_name}»` : "لم تُنشئ ملفًا بعد"}
            </p>
          </div>
          {player && (
            <Button size="sm" variant="secondary" onClick={() => setEditingProfile(true)}>
              تعديل الاسم واللافتة
            </Button>
          )}
        </div>

        {!player && <ProfileSetup compact />}

        {player && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                await signOut();
                push("تم إنشاء هوية جديدة", "success");
              }}
            >
              هوية جديدة (مسح الملف)
            </Button>
          </div>
        )}
      </section>

      {/* Preferences */}
      <section className="panel space-y-2.5 p-5">
        <h2 className="mb-3 text-sm font-bold text-ink">التجربة</h2>
        <Toggle
          label="المؤثرات الصوتية"
          hint="أصوات التلميح والتصويت ونتيجة الجولة."
          checked={prefs.sound}
          onChange={(sound) => update({ sound })}
        />
        <Toggle
          label="الحركات والانتقالات"
          hint="أطفئها إن أردت واجهة أهدأ أو كنت على جهاز بطيء."
          checked={prefs.effects}
          onChange={(effects) => update({ effects })}
        />
        <Toggle
          label="عرض مضغوط"
          hint="تقليل التباعد لإظهار لاعبين أكثر على الشاشة."
          checked={prefs.compact}
          onChange={(compact) => update({ compact })}
        />
      </section>

      {/* Default match settings */}
      <section className="panel p-5">
        <h2 className="text-sm font-bold text-ink">إعدادات المباراة الافتراضية</h2>
        <p className="mt-0.5 mb-4 text-xs text-muted">
          تُستخدم تلقائيًا عند إنشاء غرفة جديدة.
        </p>
        <RoomSettingsEditor
          value={defaults}
          onChange={(patch: Partial<RoomSettings>) => update({ defaults: { ...defaults, ...patch } })}
          categories={categories}
        />
      </section>

      {/* Diagnostics */}
      <section className="panel p-5">
        <h2 className="mb-3 text-sm font-bold text-ink">حالة الخادم</h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted">Supabase</dt>
            <dd className={configured ? "font-semibold text-good" : "font-semibold text-bad"}>
              {configured ? "مربوط ✓" : "غير مربوط ✗"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-muted">الرابط</dt>
            <dd className="truncate font-mono text-xs text-ink" dir="ltr">
              {urlInfo.host ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">بنك الكلمات</dt>
            <dd className="numeric font-semibold text-ink">
              {categories.reduce((sum, c) => sum + c.word_count, 0).toLocaleString("ar-MA")} كلمة ·{" "}
              {categories.length} فئة
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" loading={pinging} onClick={() => void testConnection()}>
            اختبر الاتصال بـ Supabase
          </Button>
          {ping && (
            <span className={ping.ok ? "text-xs font-semibold text-good" : "text-xs font-semibold text-bad"}>
              {ping.detail}
            </span>
          )}
        </div>

        {!configured && (
          <div className="mt-4">
            <Notice tone="warn" title="كيف أربط Supabase؟">
              أنشئ مشروعًا على supabase.com ثم أضف في <code dir="ltr">.env.local</code>:
              <pre className="no-scrollbar mt-2 overflow-x-auto rounded-[10px] border border-line bg-base p-3 text-[11px] text-muted" dir="ltr">
{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_DB_URL=...   # لتطبيق الترحيلات`}
              </pre>
              ثم فعّل <span className="font-bold">Authentication → Anonymous Sign-Ins</span> وشغّل
              الترحيلات الثلاثة من مجلد <code dir="ltr">supabase/migrations</code>.
            </Notice>
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => setConfirmReset(true)}>
          استعادة الإعدادات الافتراضية
        </Button>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="استعادة الافتراضيات؟"
        description="سيُعاد ضبط الأصوات والحركات وإعدادات المباراة الافتراضية."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                reset();
                setConfirmReset(false);
                push("تمت الاستعادة", "success");
              }}
            >
              استعادة
            </Button>
          </>
        }
      />

      <Modal
        open={editingProfile}
        onClose={() => setEditingProfile(false)}
        title="تعديل الملف"
      >
        <ProfileSetup compact onDone={() => setEditingProfile(false)} />
      </Modal>
    </div>
  );
}
