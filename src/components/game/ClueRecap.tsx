"use client";

import { Avatar } from "@/components/ui/Avatar";
import type { Clue, RoomPlayer } from "@/lib/types";

/** Compact recap of every clue given this round, in speaking order. */
export function ClueRecap({ clues, players }: { clues: Clue[]; players: RoomPlayer[] }) {
  const playerById = new Map(players.map((p) => [p.player_id, p]));
  const ordered = [...clues].sort((a, b) => a.turn_index - b.turn_index);

  if (ordered.length === 0) {
    return <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
      لا تلميحات بعد.
    </p>;
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {ordered.map((clue) => {
        const player = playerById.get(clue.player_id);
        return (
          <li
            key={clue.id}
            className="flex items-center gap-3 rounded-[14px] border border-line bg-base/40 px-3.5 py-2.5"
          >
            <Avatar emoji={player?.avatar ?? "❓"} size="xs" />
            <div className="min-w-0">
              <div className="truncate text-[11px] text-muted">{player?.display_name ?? "لاعب"}</div>
              <div className="truncate text-[13px] font-semibold text-ink">{clue.body}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
