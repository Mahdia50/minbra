"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { RoomController } from "@/lib/hooks/useRoom";
import { PhaseShell } from "./PhaseShell";
import { MyRoleStrip } from "./MyRoleStrip";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Layout";
import { useToast } from "@/components/providers/ToastProvider";
import { cn } from "@/lib/utils/cn";

export function PhaseClues({ controller }: { controller: RoomController }) {
  const { room, round, players, myPlayerId, myRole, isHost, now, actions } = controller;
  const { push } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!room || !round) return null;

  const order = round.speaking_order ?? [];
  const currentPlayerId = order[round.current_turn];
  const isMyTurn = currentPlayerId === myPlayerId;
  const cluesByPlayer = new Map(controller.clues.map((clue) => [clue.player_id, clue]));
  const playerById = new Map(players.map((p) => [p.player_id, p]));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    const result = await actions.submitClue(trimmed);
    if (result.ok) {
      setText("");
    } else {
      push(result.error, "error");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <MyRoleStrip myRole={myRole} />

      <PhaseShell
        phase="clues"
        endsAt={round.phase_ends_at}
        total={room.clue_seconds}
        now={now}
        badge={<Badge tone="warn">التلميح {Math.min(round.current_turn + 1, order.length)}/{order.length}</Badge>}
        footer={
          isHost ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">كمضيف يمكنك تخطّي دور اللاعب المتأخر.</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const result = await actions.advance(true);
                  if (!result.ok) push(result.error, "error");
                }}
              >
                تخطّي الدور
              </Button>
            </div>
          ) : undefined
        }
      >
        {isMyTurn ? (
          <form onSubmit={submit} className="mb-5 rounded-[16px] border border-warn/45 bg-warn/10 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="animate-ring-pulse grid size-8 place-items-center rounded-full bg-warn/20">✍️</span>
              <span className="text-sm font-bold text-ink">دورك الآن — قل تلميحًا واحدًا</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={60}
                autoFocus
                placeholder="مثال: شيء موجود في كل بيت…"
              />
              <Button type="submit" loading={busy} disabled={!text.trim()}>
                أرسل
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              لا يمكنك ذكر الكلمة نفسها — سيرفضها النظام تلقائيًا. ({text.length}/60)
            </p>
          </form>
        ) : (
          <div className="mb-5">
            <Notice tone="brand">
              دور{" "}
              <span className="font-bold">
                {playerById.get(currentPlayerId ?? "")?.display_name ?? "…"}
              </span>{" "}
              الآن — استعد لتلميحاتهم.
            </Notice>
          </div>
        )}

        <ol className="space-y-2">
          {order.map((playerId, index) => {
            const player = playerById.get(playerId);
            const clue = cluesByPlayer.get(playerId);
            const isCurrent = index === round.current_turn;
            if (!player) return null;
            return (
              <motion.li
                key={playerId}
                layout
                className={cn(
                  "flex items-center gap-3 rounded-[14px] border px-3.5 py-2.5 transition-colors",
                  isCurrent ? "border-warn/60 bg-warn/8" : "border-line bg-base/40",
                  clue && "border-good/35",
                )}
              >
                <span className="numeric w-5 shrink-0 text-center text-xs text-faint">{index + 1}</span>
                <Avatar emoji={player.avatar} size="xs" ring={isCurrent ? "warn" : null} />
                <span className="w-24 shrink-0 truncate text-[13px] font-semibold text-ink sm:w-32">
                  {player.display_name}
                  {playerId === myPlayerId && <span className="text-[10px] text-brand-soft"> (أنت)</span>}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {clue ? (
                    <span className="text-ink">{clue.body}</span>
                  ) : isCurrent ? (
                    <span className="text-warn">يكتب…</span>
                  ) : (
                    <span className="text-faint">بانتظار دوره</span>
                  )}
                </span>
              </motion.li>
            );
          })}
        </ol>
      </PhaseShell>
    </div>
  );
}
