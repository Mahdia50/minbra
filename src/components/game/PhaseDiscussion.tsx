"use client";

import type { RoomController } from "@/lib/hooks/useRoom";
import { PhaseShell } from "./PhaseShell";
import { MyRoleStrip } from "./MyRoleStrip";
import { ClueRecap } from "./ClueRecap";
import { PlayerGrid } from "./PlayerGrid";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Layout";
import { useToast } from "@/components/providers/ToastProvider";

export function PhaseDiscussion({ controller }: { controller: RoomController }) {
  const { room, round, players, clues, myPlayerId, myRole, isHost, now, actions } = controller;
  const { push } = useToast();

  if (!room || !round) return null;

  return (
    <div className="space-y-4">
      <MyRoleStrip myRole={myRole} />

      <PhaseShell
        phase="discussion"
        endsAt={round.phase_ends_at}
        total={room.discussion_seconds}
        now={now}
        badge={<Badge tone="accent">نقاش حر</Badge>}
        footer={
          isHost ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">يمكنك بدء التصويت قبل انتهاء الوقت.</span>
              <Button size="sm" onClick={async () => {
                const result = await actions.advance(true);
                if (!result.ok) push(result.error, "error");
              }}>
                ابدأ التصويت الآن
              </Button>
            </div>
          ) : undefined
        }
      >
        <Notice tone="brand">
          ناقشوا التلميحات: من بدا غامضًا أو متأخرًا؟ تذكّروا أن خارج السالفة لا يعرف الكلمة —
          تلميحه غالبًا عام أو بعيد.
        </Notice>

        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold text-muted">التلميحات ({clues.length})</h3>
          <ClueRecap clues={clues} players={players} />
        </div>

        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold text-muted">اللاعبون</h3>
          <PlayerGrid players={players} myPlayerId={myPlayerId} speakingOrder={round.speaking_order} currentTurn={round.current_turn} />
        </div>
      </PhaseShell>
    </div>
  );
}
