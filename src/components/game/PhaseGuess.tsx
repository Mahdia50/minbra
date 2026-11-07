"use client";

import { useState } from "react";
import type { RoomController } from "@/lib/hooks/useRoom";
import { PhaseShell } from "./PhaseShell";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Layout";
import { useToast } from "@/components/providers/ToastProvider";
import { playSfx } from "@/lib/audio";

export function PhaseGuess({ controller }: { controller: RoomController }) {
  const { room, round, players, myPlayerId, now, actions } = controller;
  const { push } = useToast();
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!room || !round) return null;

  const accused = players.find((p) => p.player_id === round.accused_id);
  const iAmAccused = round.accused_id === myPlayerId;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!guess.trim()) return;
    setBusy(true);
    const result = await actions.submitGuess(guess.trim());
    if (result.ok) {
      setDone(true);
      playSfx(result.correct ? "win" : "lose");
      push(result.correct ? "تخمين صحيح! خارج السالفة يفوز." : "تخمين خاطئ — الفريق يفوز.", result.correct ? "success" : "info");
    } else {
      push(result.error, "error");
    }
    setBusy(false);
  }

  return (
    <PhaseShell
      phase="guess"
      endsAt={round.phase_ends_at}
      total={room.guess_seconds}
      now={now}
      badge={<Badge tone="bad">كُشف خارج السالفة</Badge>}
    >
      <div className="flex flex-col items-center gap-2 pb-4 text-center">
        <Avatar emoji={accused?.avatar ?? "🕵️"} size="xl" ring="bad" />
        <h3 className="text-lg font-bold text-ink">
          {accused?.display_name ?? "لاعب"} هو «خارج السالفة»
        </h3>
        <p className="max-w-sm text-sm leading-relaxed text-muted">
          {iAmAccused
            ? "كُشفت! لديك فرصة واحدة لتخمين الكلمة السرية."
            : "لديه فرصة واحدة لتخمين الكلمة. إن نجح فاز وحده."}
        </p>
      </div>

      {iAmAccused && !done ? (
        <form onSubmit={submit} className="rounded-[16px] border border-bad/45 bg-bad/10 p-4">
          <div className="flex gap-2">
            <Input
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              maxLength={60}
              autoFocus
              placeholder="اكتب الكلمة السرية…"
            />
            <Button type="submit" loading={busy} disabled={!guess.trim()}>
              تخمين
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            علامات التشكيل والهمزات لا تفرق — الكتابة الصحيحة تكفي.
          </p>
        </form>
      ) : (
        <Notice tone={done ? "good" : "neutral"}>
          {done
            ? "تم إرسال تخمينك، في انتظار بقية اللاعبين…"
            : "في انتظار تخمين خارج السالفة…"}
        </Notice>
      )}
    </PhaseShell>
  );
}
