"use client";

import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import type { RevealPlayer, RoomPlayer } from "@/lib/types";

export function PlayerGrid({
  players,
  myPlayerId,
  speakingOrder,
  currentTurn,
  selectable,
  selectedId,
  disabledIds,
  onSelect,
  showScores,
  reveal,
  hostActions,
}: {
  players: RoomPlayer[];
  myPlayerId: string | null;
  speakingOrder?: string[];
  currentTurn?: number;
  selectable?: boolean;
  selectedId?: string | null;
  disabledIds?: string[];
  onSelect?: (playerId: string) => void;
  showScores?: boolean;
  reveal?: RevealPlayer[] | null;
  hostActions?: (player: RoomPlayer) => React.ReactNode;
}) {
  const currentSpeakerId =
    speakingOrder && typeof currentTurn === "number" ? speakingOrder[currentTurn] : undefined;

  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {players.map((player) => {
        const isMe = player.player_id === myPlayerId;
        const isSpeaker = player.player_id === currentSpeakerId;
        const selected = selectedId === player.player_id;
        const disabled = disabledIds?.includes(player.player_id) ?? false;
        const revealed = reveal?.find((r) => r.player_id === player.player_id);
        const outlier = revealed?.role === "outlier";

        const card = (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22 }}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-[16px] border p-3 text-center transition-colors duration-200",
              "border-line bg-surface/80",
              isSpeaker && "border-warn/70 animate-ring-pulse",
              selected && "border-brand bg-brand/12",
              !selected && selectable && !disabled && "hover:border-brand/50 hover:bg-elevated",
              disabled && "opacity-55",
              reveal && outlier && "border-bad/60 bg-bad/10",
              reveal && revealed && !outlier && "border-good/35",
            )}
          >
            <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
              {player.is_host && <span title="المضيف">👑</span>}
              {!player.is_connected && <span title="غير متصل">🔌</span>}
            </div>

            <Avatar
              emoji={player.avatar}
              size="md"
              ring={isSpeaker ? "warn" : isMe ? "brand" : reveal ? (outlier ? "bad" : "good") : null}
              muted={!player.is_connected}
            />

            <div className="w-full min-w-0">
              <div className="flex items-center justify-center gap-1">
                <span className="truncate text-[13px] font-bold text-ink">{player.display_name}</span>
                {isMe && <span className="text-[10px] text-brand-soft">(أنت)</span>}
              </div>

              {reveal && revealed && (
                <div className="mt-1">
                  <Badge tone={outlier ? "bad" : "good"}>
                    {outlier ? "خارج السالفة" : "يعرف الكلمة"}
                  </Badge>
                </div>
              )}

              {!reveal && (
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                  {isSpeaker && <Badge tone="warn">يتكلّم الآن</Badge>}
                  {!isSpeaker && player.is_ready && <Badge tone="good">جاهز</Badge>}
                </div>
              )}
            </div>

            {showScores && (
              <div className="numeric text-[11px] text-muted">
                {player.score} نقطة
                {revealed ? ` · ${revealed.vote_count} صوت` : ""}
              </div>
            )}

            {hostActions && !isMe && (
              <div className="mt-1 flex gap-1.5">{hostActions(player)}</div>
            )}
          </motion.div>
        );

        if (selectable && !disabled) {
          return (
            <li key={player.id}>
              <button type="button" onClick={() => onSelect?.(player.player_id)} className="block w-full text-right">
                {card}
              </button>
            </li>
          );
        }
        return <li key={player.id}>{card}</li>;
      })}
    </ul>
  );
}
