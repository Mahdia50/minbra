"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { RoomController } from "@/lib/hooks/useRoom";
import { PhaseShell } from "./PhaseShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Layout";
import { useToast } from "@/components/providers/ToastProvider";
import { playSfx } from "@/lib/audio";

export function PhaseReveal({ controller }: { controller: RoomController }) {
  const { room, round, myRole, players, now, actions } = controller;
  const { push } = useToast();
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!room || !round) return null;

  const isOutlier = myRole?.role === "outlier";
  const confirmed = myRole?.confirmed ?? false;
  const total = players.length;
  const confirmedCount = round.confirmed_count;

  async function confirm() {
    setBusy(true);
    const result = await actions.confirmRole();
    if (!result.ok) push(result.error, "error");
    setBusy(false);
    playSfx("reveal");
  }

  return (
    <PhaseShell
      phase="reveal"
      endsAt={round.phase_ends_at}
      total={room.reveal_seconds}
      now={now}
      badge={<Badge tone="neutral">{`الجولة ${round.round_number}/${room.rounds_count}`}</Badge>}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="numeric text-xs text-muted">
            {confirmedCount}/{total} أكّدوا اطّلاعهم
          </span>
          <Button onClick={confirm} loading={busy} disabled={confirmed} variant={confirmed ? "success" : "primary"}>
            {confirmed ? "✓ اطّلعت" : "اطّلعت على دوري"}
          </Button>
        </div>
      }
    >
      {!revealed ? (
        <button
          type="button"
          onClick={() => {
            setRevealed(true);
            playSfx("reveal");
          }}
          className="group relative flex h-56 w-full flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed border-line bg-base/50 transition-colors hover:border-brand/50"
        >
          <motion.span
            className="text-5xl"
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            🤫
          </motion.span>
          <span className="text-sm font-semibold text-muted group-hover:text-ink">
            اضغط لكشف دورك — تأكّد أن لا أحد يرى شاشتك
          </span>
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className={
            isOutlier
              ? "flex h-56 flex-col items-center justify-center gap-3 rounded-[18px] border border-bad/50 bg-bad/10 p-6 text-center"
              : "flex h-56 flex-col items-center justify-center gap-3 rounded-[18px] border border-brand/50 bg-brand/10 p-6 text-center"
          }
        >
          {isOutlier ? (
            <>
              <span className="text-3xl">🕵️</span>
              <h3 className="text-xl font-bold text-bad">أنت خارج السالفة!</h3>
              <p className="max-w-sm text-sm leading-relaxed text-ink/85">
                لا تعرف الكلمة السرية. استمع جيدًا لتلميحات الآخرين، أعطِ تلميحًا يبدو مقنعًا، وحاول
                معرفة الكلمة قبل أن يكتشفوك.
              </p>
            </>
          ) : (
            <>
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-soft">
                الكلمة السرية
              </span>
              <h3 className="text-4xl font-bold text-ink">{myRole?.word_text}</h3>
              <p className="max-w-sm text-sm leading-relaxed text-ink/80">
                لا تذكر الكلمة مباشرة. أعطِ تلميحًا واحدًا ذكيًا حتى يعرفها الفريق ولا يفهمها الدخيل.
              </p>
            </>
          )}
        </motion.div>
      )}

      {isOutlier && revealed && (
        <div className="mt-4">
          <Notice tone="warn">
            إن صوّتت الأغلبية عليك، ستحصل على فرصة واحدة لتخمين الكلمة. تخمين صحيح = فوز لك وحدك.
          </Notice>
        </div>
      )}
    </PhaseShell>
  );
}
