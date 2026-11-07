"use client";

import { motion } from "framer-motion";
import type { RoomController } from "@/lib/hooks/useRoom";
import { PhaseShell } from "./PhaseShell";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/Layout";
import { useToast } from "@/components/providers/ToastProvider";
import { cn } from "@/lib/utils/cn";

const OUTCOME_COPY = {
  civilians: { label: "الفريق فاز بالجولة", tone: "good" as const, icon: "🎉" },
  outliers: { label: "خارج السالفة فاز بالجولة", tone: "bad" as const, icon: "🕵️" },
  skip: { label: "بدون حسم (تعادل أو غياب تصويت)", tone: "warn" as const, icon: "⚖️" },
};

export function PhaseResult({ controller }: { controller: RoomController }) {
  const { room, round, reveal, isHost, now, actions } = controller;
  const { push } = useToast();

  if (!room || !round || !reveal) return null;

  const outcome = OUTCOME_COPY[reveal.outcome ?? "skip"];
  const outliers = reveal.players.filter((p) => p.role === "outlier");
  const decisiveVotes = [...reveal.players]
    .filter((p) => p.vote_count > 0)
    .sort((a, b) => b.vote_count - a.vote_count);

  return (
    <PhaseShell
      phase="result"
      endsAt={round.phase_ends_at}
      total={room.result_seconds}
      now={now}
      badge={<Badge tone={outcome.tone}>{outcome.label}</Badge>}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted">
            {round.round_number >= room.rounds_count
              ? "هذه آخر جولة — ستُعلن النتيجة النهائية بعد قليل."
              : "ستنتقل الجولة التالية تلقائيًا."}
          </span>
          {isHost && (
            <Button
              size="sm"
              onClick={async () => {
                const result = await actions.advance(true);
                if (!result.ok) push(result.error, "error");
              }}
            >
              الجولة التالية
            </Button>
          )}
        </div>
      }
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-[18px] border p-6 text-center",
          outcome.tone === "good" && "border-good/45 bg-good/10",
          outcome.tone === "bad" && "border-bad/45 bg-bad/10",
          outcome.tone === "warn" && "border-warn/45 bg-warn/10",
        )}
      >
        <span className="text-3xl">{outcome.icon}</span>
        <span className="text-sm font-bold text-ink">{outcome.label}</span>
        <div className="mt-1 flex flex-col items-center">
          <span className="text-[11px] uppercase tracking-wide text-muted">الكلمة السرية</span>
          <span className="text-3xl font-bold text-ink">{reveal.word}</span>
          {reveal.word_alt && reveal.word_alt !== reveal.word && (
            <span className="mt-0.5 text-xs text-muted">({reveal.word_alt})</span>
          )}
          <span className="mt-1 text-[11px] text-faint">
            {reveal.category.emoji} {reveal.category.name_ar} · {reveal.category.name_darija}
          </span>
        </div>
      </motion.div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard
          label="خارج السالفة"
          value={outliers.map((o) => o.display_name).join("، ") || "—"}
          tone="bad"
          icon="🕵️"
        />
        <StatCard
          label="المُتَّهم"
          value={reveal.players.find((p) => p.player_id === round.accused_id)?.display_name ?? "—"}
          tone="warn"
          icon="👉"
        />
        <StatCard
          label="التخمين الأخير"
          value={
            reveal.outlier_guess
              ? reveal.outlier_guessed_correctly
                ? `صحيح: ${reveal.outlier_guess}`
                : `خاطئ: ${reveal.outlier_guess}`
              : "لم يُخمّن"
          }
          tone={reveal.outlier_guessed_correctly ? "bad" : "good"}
          icon="🎯"
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted">توزيع الأصوات</h3>
          <ul className="space-y-1.5">
            {decisiveVotes.length === 0 && <li className="text-xs text-faint">لا أصوات.</li>}
            {decisiveVotes.map((player) => (
              <li
                key={player.player_id}
                className="flex items-center gap-2.5 rounded-[12px] border border-line bg-base/40 px-3 py-2"
              >
                <Avatar emoji={player.avatar} size="xs" ring={player.role === "outlier" ? "bad" : "good"} />
                <span className="flex-1 truncate text-[13px] font-semibold text-ink">
                  {player.display_name}
                </span>
                <Badge tone={player.role === "outlier" ? "bad" : "neutral"}>
                  {player.role === "outlier" ? "خارج السالفة" : "فريق"}
                </Badge>
                <span className="numeric text-xs text-muted">{player.vote_count} صوت</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted">من صوّت لمن</h3>
          <ul className="space-y-1.5">
            {reveal.players.map((player) => {
              const targetId = reveal.votes.find((v) => v.voter_id === player.player_id)?.target_id;
              const target = reveal.players.find((p) => p.player_id === targetId);
              return (
                <li key={player.player_id} className="flex items-center gap-2 text-[12px]">
                  <span className="w-20 shrink-0 truncate text-muted">{player.display_name}</span>
                  <span className="text-faint">←</span>
                  <span className="truncate font-semibold text-ink">
                    {target?.display_name ?? "لم يصوّت"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-xs font-semibold text-muted">التلميحات</h3>
        <ul className="flex flex-wrap gap-1.5">
          {reveal.clues.map((clue) => (
            <li
              key={clue.player_id}
              className="rounded-full border border-line bg-base/50 px-2.5 py-1 text-[11px]"
            >
              <span className="text-muted">{clue.display_name}:</span>{" "}
              <span className="font-semibold text-ink">{clue.body}</span>
            </li>
          ))}
        </ul>
      </div>
    </PhaseShell>
  );
}
