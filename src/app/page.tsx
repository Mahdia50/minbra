"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SessionGate } from "@/components/session/SessionGate";
import { ProfileSetup } from "@/components/session/ProfileSetup";
import { useSession } from "@/components/providers/SessionProvider";
import { PageShell, TopBar, Notice } from "@/components/ui/Layout";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { SCORE_RULES } from "@/lib/constants";

const ENTRIES = [
  {
    href: "/create",
    icon: "🎛️",
    title: "أنشئ غرفة",
    body: "اضبط عدد اللاعبين، عدد الخارجين، مدّة كل مرحلة والفئات. تحكّم كامل كمضيف.",
    tone: "brand" as const,
    cta: "إنشاء غرفة خاصة أو عامة",
  },
  {
    href: "/join",
    icon: "🔑",
    title: "انضم برمز",
    body: "لديك رمز من صديق؟ أدخله مباشرة وادخل إلى اللوبي في ثانية.",
    tone: "accent" as const,
    cta: "إدخال رمز الغرفة",
  },
  {
    href: "/rooms",
    icon: "🌐",
    title: "غرف عامة",
    body: "تصفّح الغرف المتاحة، شاهد عدد اللاعبين، وانضم عشوائيًا لأي غرفة.",
    tone: "good" as const,
    cta: "استعراض الغرف",
  },
];

const FLOW = [
  { n: "1", t: "توزيع الأدوار", d: "الجميع يعرف الكلمة السرية… إلا واحد: «خارج السالفة»." },
  { n: "2", t: "تلميح واحد", d: "كل لاعب يقول تلميحًا يصف الكلمة دون ذكرها." },
  { n: "3", t: "نقاش وتصويت", d: "حلّلوا التلميحات وصوّتوا على من تظنونه الدخيل." },
  { n: "4", t: "تخمين أخير", d: "إن كُشف، يحق له تخمين الكلمة — إن نجح فاز وحده." },
];

export default function HomePage() {
  return (
    <PageShell wide>
      <SessionGate>
        <Home />
      </SessionGate>
    </PageShell>
  );
}

function Home() {
  const { player } = useSession();

  return (
    <>
      <TopBar>
        <Link
          href="/stats"
          className="rounded-[10px] px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          الإحصائيات
        </Link>
        <Link
          href="/settings"
          className="rounded-[10px] px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          الإعدادات
        </Link>
      </TopBar>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[24px] border border-line bg-surface/70 px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute inset-0 app-grid" aria-hidden />
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative max-w-2xl"
        >
          <Badge tone="brand">لعبة جماعية أونلاين · بلا تسجيل</Badge>
          <h1 className="text-balance mt-4 text-4xl font-bold leading-[1.15] text-ink sm:text-5xl">
            واحد منكم <span className="text-brand-soft">خارج السالفة</span>، والباقي يعرفون الكلمة.
          </h1>
          <p className="mt-4 max-w-xl text-balance text-[15px] leading-relaxed text-muted">
            تلميح واحد لكل لاعب، نقاش سريع، ثم تصويت. الفريق يحاول كشف الدخيل، والدخيل يحاول التمرير
            وفهم الكلمة. مئات الكلمات بالفصحى والدارجة المغربية.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {player ? (
              <div className="flex items-center gap-3 rounded-[16px] border border-line bg-base/60 px-4 py-2.5">
                <Avatar emoji={player.avatar} size="sm" ring="brand" />
                <div className="leading-tight">
                  <div className="text-sm font-bold text-ink">{player.display_name}</div>
                  <div className="text-[11px] text-faint">جاهز للعب</div>
                </div>
              </div>
            ) : (
              <span className="text-sm text-muted">اكتب اسمك بالأسفل لتبدأ ↓</span>
            )}
          </div>
        </motion.div>
      </section>

      {/* Name entry when needed */}
      {!player && (
        <div className="mt-6">
          <ProfileSetup />
        </div>
      )}

      {/* Entries */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {ENTRIES.map((entry, index) => (
          <motion.div
            key={entry.href}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06 * index, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              href={entry.href}
              className="group flex h-full flex-col rounded-[18px] border border-line bg-surface/80 p-5 transition-all duration-250 hover:border-brand/45 hover:bg-elevated"
            >
              <div className="mb-3 grid size-11 place-items-center rounded-[13px] border border-line bg-base/60 text-xl">
                {entry.icon}
              </div>
              <h2 className="text-base font-bold text-ink">{entry.title}</h2>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-muted">{entry.body}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-soft">
                {entry.cta}
                <span className="transition-transform duration-250 group-hover:-translate-x-1">←</span>
              </span>
            </Link>
          </motion.div>
        ))}
      </section>

      {/* How it plays */}
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-ink">كيف تُلعب؟</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FLOW.map((step) => (
            <div key={step.n} className="flex gap-3 rounded-[16px] border border-line bg-surface/60 p-4">
              <span className="numeric grid size-8 shrink-0 place-items-center rounded-full border border-brand/35 bg-brand/12 text-sm font-bold text-brand-soft">
                {step.n}
              </span>
              <div>
                <div className="text-sm font-bold text-ink">{step.t}</div>
                <div className="mt-0.5 text-[13px] leading-relaxed text-muted">{step.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Scoring */}
      <section className="mt-8">
        <Notice tone="neutral" title="نظام النقاط">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {SCORE_RULES.map((rule) => (
              <li key={rule.label} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span>{rule.label}</span>
                <span className="shrink-0 font-bold text-brand-soft">{rule.value}</span>
              </li>
            ))}
          </ul>
        </Notice>
      </section>

      <footer className="mt-10 text-center text-[11px] text-faint">
        مين برّة السالفة · مزامنة فورية عبر Supabase Realtime
      </footer>
    </>
  );
}
