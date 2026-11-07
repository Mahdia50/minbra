"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RoomController } from "@/lib/hooks/useRoom";
import { PlayerGrid } from "./PlayerGrid";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Layout";
import { RoomSettingsEditor } from "@/components/room/RoomSettingsEditor";
import { useCategories } from "@/lib/hooks/useCategories";
import { useToast } from "@/components/providers/ToastProvider";
import { DEFAULT_SETTINGS, type RoomSettings } from "@/lib/constants";

export function LobbyView({ controller }: { controller: RoomController }) {
  const { room, players, me, isHost, myPlayerId, actions } = controller;
  const { push } = useToast();
  const { categories } = useCategories();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (!room) return null;

  const readyCount = players.filter((p) => p.is_ready || p.is_host).length;
  const canStart = players.length >= room.min_players;
  const settings: RoomSettings = {
    ...DEFAULT_SETTINGS,
    min_players: room.min_players,
    max_players: room.max_players,
    outliers_count: room.outliers_count,
    rounds_count: room.rounds_count,
    clue_seconds: room.clue_seconds,
    discussion_seconds: room.discussion_seconds,
    vote_seconds: room.vote_seconds,
    guess_seconds: room.guess_seconds,
    result_seconds: room.result_seconds,
    reveal_seconds: room.reveal_seconds,
    word_mode: room.word_mode,
    language: room.language,
    category_ids: room.category_ids,
    excluded_category_ids: room.excluded_category_ids,
    allow_chat: room.allow_chat,
    allow_mid_game_join: room.allow_mid_game_join,
  };

  async function withBusy(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    const result = await fn();
    if (!result.ok) push(result.error ?? "تعذّر التنفيذ", "error");
    setBusy(null);
  }

  async function saveSettings(patch: Partial<RoomSettings>) {
    const result = await actions.updateSettings(patch);
    if (!result.ok) push(result.error, "error");
  }

  return (
    <div className="space-y-5">
      <div className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">اللوبي</h2>
            <p className="mt-0.5 text-xs text-muted">
              {players.length} لاعب · {readyCount} جاهز · الحد الأدنى {room.min_players}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isHost ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
                  ⚙️ إعدادات المباراة
                </Button>
                <Button
                  size="sm"
                  disabled={!canStart}
                  loading={busy === "start"}
                  onClick={() => withBusy("start", actions.startGame)}
                >
                  ابدأ المباراة
                </Button>
              </>
            ) : (
              <Button
                variant={me?.is_ready ? "success" : "secondary"}
                size="sm"
                loading={busy === "ready"}
                onClick={() => withBusy("ready", () => actions.setReady(!me?.is_ready))}
              >
                {me?.is_ready ? "✓ أنا جاهز" : "أنا جاهز"}
              </Button>
            )}
          </div>
        </div>

        {!canStart && (
          <Notice tone="warn" title="في انتظار اللاعبين">
            تحتاج إلى {room.min_players - players.length} لاعب إضافي على الأقل. شارك الرمز{" "}
            <span className="numeric font-bold">{room.code}</span> أو رابط الدعوة.
          </Notice>
        )}

        <div className="mt-4">
          <PlayerGrid
            players={players}
            myPlayerId={myPlayerId}
            hostActions={
              isHost
                ? (player) => (
                    <>
                      <button
                        className="rounded-[8px] px-1.5 py-0.5 text-[10px] font-semibold text-muted hover:bg-elevated hover:text-ink"
                        onClick={() => withBusy(`host-${player.id}`, () => actions.transferHost(player.player_id))}
                      >
                        نقل الملك
                      </button>
                      <button
                        className="rounded-[8px] px-1.5 py-0.5 text-[10px] font-semibold text-bad hover:bg-bad/15"
                        onClick={() => withBusy(`kick-${player.id}`, () => actions.kick(player.player_id))}
                      >
                        إخراج
                      </button>
                    </>
                  )
                : undefined
            }
          />
        </div>
      </div>

      <MatchRules room={room} />

      <AnimatePresence>
        {settingsOpen && (
          <Modal
            open
            wide
            onClose={() => setSettingsOpen(false)}
            title="إعدادات المباراة"
            description="تُطبَّق فورًا على كل اللاعبين، وقبل بدء المباراة فقط."
          >
            <div className="no-scrollbar max-h-[60vh] overflow-y-auto pr-1">
              <RoomSettingsEditor
                value={settings}
                onChange={saveSettings}
                categories={categories}
              />
            </div>
            <motion.div layout className="mt-5 flex justify-end">
              <Button onClick={() => setSettingsOpen(false)}>تم</Button>
            </motion.div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function MatchRules({ room }: { room: NonNullable<RoomController["room"]> }) {
  const rules = [
    { label: "الجولات", value: room.rounds_count },
    { label: "خارج السالفة", value: room.outliers_count },
    { label: "التلميحات", value: `${room.clue_seconds}ث` },
    { label: "النقاش", value: `${room.discussion_seconds}ث` },
    { label: "التصويت", value: `${room.vote_seconds}ث` },
    { label: "التخمين", value: `${room.guess_seconds}ث` },
  ];
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
      {rules.map((rule) => (
        <div key={rule.label} className="rounded-[14px] border border-line bg-surface/70 p-3 text-center">
          <div className="text-[10px] text-muted">{rule.label}</div>
          <div className="numeric mt-1 text-sm font-bold text-ink">{rule.value}</div>
        </div>
      ))}
    </div>
  );
}
