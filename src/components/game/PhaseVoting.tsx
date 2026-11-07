"use client";

import { useState } from "react";
import type { RoomController } from "@/lib/hooks/useRoom";
import { PhaseShell } from "./PhaseShell";
import { ClueRecap } from "./ClueRecap";
import { PlayerGrid } from "./PlayerGrid";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Layout";
import { useToast } from "@/components/providers/ToastProvider";
import { playSfx } from "@/lib/audio";
import { cn } from "@/lib/utils/cn";

export function PhaseVoting({ controller }: { controller: RoomController }) {
  const { room, round, players, clues, myPlayerId, myVote, isHost, now, actions } = controller;
  const { push } = useToast();
  const [choice, setChoice] = useState<string | null>(myVote);
  const [busy, setBusy] = useState(false);

  if (!room || !round) return null;

  const voted = Boolean(myVote);
  const target = players.find((p) => p.player_id === choice);

  async function cast() {
    if (!choice) return;
    setBusy(true);
    const result = await actions.castVote(choice);
    if (result.ok) {
      playSfx("vote");
      push("تم تسجيل صوتك", "success");
    } else {
      push(result.error, "error");
    }
    setBusy(false);
  }

  return (
    <PhaseShell
      phase="voting"
      endsAt={round.phase_ends_at}
      total={room.vote_seconds}
      now={now}
      badge={
        <Badge tone="brand">
          {`صوّت ${round.votes_count}/${players.length}`}
        </Badge>
      }
      footer={
        voted ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">
              اخترت: <span className="font-bold text-ink">{target?.display_name ?? "—"}</span>
            </span>
            <Badge tone="good">✓ صوتك مسجّل</Badge>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted">
              {choice ? `اخترت: ${target?.display_name}` : "اختر لاعبًا من الأسفل ثم أكّد."}
            </span>
            <div className="flex gap-2">
              {isHost && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const result = await actions.advance(true);
                    if (!result.ok) push(result.error, "error");
                  }}
                >
                  إغلاق التصويت
                </Button>
              )}
              <Button size="sm" disabled={!choice} loading={busy} onClick={cast}>
                تأكيد التصويت
              </Button>
            </div>
          </div>
        )
      }
    >
      <Notice tone="warn">
        صوّت على اللاعب الذي تظنه <span className="font-bold">خارج السالفة</span>. لا يمكنك التصويت
        لنفسك، ولا يمكن تغيير صوتك بعد التأكيد.
      </Notice>

      <div className="mt-4">
        <h3 className="mb-2 text-xs font-semibold text-muted">التلميحات للتذكير</h3>
        <ClueRecap clues={clues} players={players} />
      </div>

      <div className={cn("mt-5", voted && "pointer-events-none opacity-70")}>
        <h3 className="mb-2 text-xs font-semibold text-muted">اختر المشتبه به</h3>
        <PlayerGrid
          players={players}
          myPlayerId={myPlayerId}
          selectable={!voted}
          selectedId={choice}
          disabledIds={myPlayerId ? [myPlayerId] : []}
          onSelect={(id) => {
            playSfx("click");
            setChoice(id);
          }}
          showScores
        />
      </div>
    </PhaseShell>
  );
}
