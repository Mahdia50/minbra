"use client";

import { motion } from "framer-motion";
import type { RoomController } from "@/lib/hooks/useRoom";
import { PhaseReveal } from "./PhaseReveal";
import { PhaseClues } from "./PhaseClues";
import { PhaseDiscussion } from "./PhaseDiscussion";
import { PhaseVoting } from "./PhaseVoting";
import { PhaseGuess } from "./PhaseGuess";
import { PhaseResult } from "./PhaseResult";
import { Avatar } from "@/components/ui/Avatar";
import { PHASE_LABEL, PHASE_ORDER } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";

export function GameView({ controller }: { controller: RoomController }) {
  const { room, round, players, myPlayerId } = controller;
  if (!room || !round) return null;

  const phaseIndex = PHASE_ORDER.indexOf(round.phase);
  const ranked = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        {/* round + phase progress */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-semibold text-muted">
            الجولة <span className="numeric text-ink">{round.round_number}</span> / {room.rounds_count}
          </span>
          <ol className="flex items-center gap-1">
            {PHASE_ORDER.filter((phase) => phase !== "guess").map((phase, index) => {
              const active = phase === round.phase;
              const passed = index < (round.phase === "guess" ? PHASE_ORDER.length : phaseIndex);
              return (
                <li key={phase} className="flex items-center gap-1">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors",
                      active
                        ? "bg-brand text-white"
                        : passed
                          ? "bg-elevated text-muted"
                          : "text-faint",
                    )}
                  >
                    {PHASE_LABEL[phase]}
                  </span>
                  {index < 3 && <span className="text-faint">·</span>}
                </li>
              );
            })}
          </ol>
        </div>

        {round.phase === "reveal" && <PhaseReveal controller={controller} />}
        {round.phase === "clues" && <PhaseClues controller={controller} />}
        {round.phase === "discussion" && <PhaseDiscussion controller={controller} />}
        {round.phase === "voting" && <PhaseVoting controller={controller} />}
        {round.phase === "guess" && <PhaseGuess controller={controller} />}
        {round.phase === "result" && <PhaseResult controller={controller} />}
      </div>

      {/* live scoreboard */}
      <aside className="panel-flat h-fit p-4 lg:sticky lg:top-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">لوحة النقاط</h3>
        <ol className="space-y-1.5">
          {ranked.map((player, index) => (
            <motion.li
              key={player.id}
              layout
              className={cn(
                "flex items-center gap-2.5 rounded-[12px] border px-3 py-2",
                player.player_id === myPlayerId ? "border-brand/40 bg-brand/8" : "border-line bg-base/40",
              )}
            >
              <span className="numeric w-4 text-center text-[11px] text-faint">{index + 1}</span>
              <Avatar emoji={player.avatar} size="xs" muted={!player.is_connected} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">
                {player.display_name}
              </span>
              {player.is_host && <span className="text-[10px]">👑</span>}
              <span className="numeric text-xs font-bold text-brand-soft">{player.score}</span>
            </motion.li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
