"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { RoomController } from "@/lib/hooks/useRoom";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/providers/ToastProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { cn } from "@/lib/utils/cn";

const WINNER_COPY = {
  civilians: { title: "الفريق فاز!", body: "كشفتم خارج السالفة في أغلب الجولات.", icon: "🎉", tone: "good" as const },
  outliers: { title: "خارج السالفة فاز!", body: "غالط الجميع ونجح في التمرير.", icon: "🕵️", tone: "bad" as const },
  draw: { title: "تعادل", body: "لا أحد حسم المباراة.", icon: "⚖️", tone: "warn" as const },
};

export function FinishedView({ controller }: { controller: RoomController }) {
  const { game, players, myPlayerId, isHost, actions } = controller;
  const router = useRouter();
  const { push } = useToast();
  const { player } = useSession();

  const winner = game?.winner ?? "draw";
  const copy = WINNER_COPY[winner];
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const meRank = ranked.findIndex((p) => p.player_id === myPlayerId) + 1;

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative overflow-hidden rounded-[22px] border p-8 text-center",
          copy.tone === "good" && "border-good/45 bg-good/10",
          copy.tone === "bad" && "border-bad/45 bg-bad/10",
          copy.tone === "warn" && "border-warn/45 bg-warn/10",
        )}
      >
        <div className="pointer-events-none absolute inset-0 app-grid" aria-hidden />
        <div className="relative flex flex-col items-center gap-2">
          <motion.span
            className="text-5xl"
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3.4, ease: "easeInOut" }}
          >
            {copy.icon}
          </motion.span>
          <h1 className="text-2xl font-bold text-ink">{copy.title}</h1>
          <p className="text-sm text-muted">{copy.body}</p>
          {meRank > 0 && (
            <Badge tone={copy.tone}>
              مركزك: {meRank} من {ranked.length} · {player?.display_name}
            </Badge>
          )}
        </div>
      </motion.div>

      <div className="panel-flat p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">الترتيب النهائي</h2>
        <ol className="space-y-2">
          {ranked.map((roomPlayer, index) => {
            const medal = ["🥇", "🥈", "🥉"][index];
            return (
              <motion.li
                key={roomPlayer.id}
                layout
                className={cn(
                  "flex items-center gap-3 rounded-[14px] border px-3.5 py-2.5",
                  roomPlayer.player_id === myPlayerId ? "border-brand/45 bg-brand/10" : "border-line bg-base/40",
                )}
              >
                <span className="numeric w-6 text-center text-sm text-faint">{medal ?? index + 1}</span>
                <Avatar emoji={roomPlayer.avatar} size="sm" ring={index === 0 ? "good" : null} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                  {roomPlayer.display_name}
                  {roomPlayer.is_host && <span className="ml-1.5 text-[10px]">👑</span>}
                </span>
                <span className="numeric text-sm font-bold text-brand-soft">{roomPlayer.score} نقطة</span>
              </motion.li>
            );
          })}
        </ol>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => router.push("/stats")}>
          إحصائياتي
        </Button>
        {isHost && (
          <>
            <Button
              variant="secondary"
              onClick={async () => {
                const result = await actions.stopGame();
                if (!result.ok) push(result.error, "error");
              }}
            >
              العودة إلى اللوبي
            </Button>
            <Button
              onClick={async () => {
                const result = await actions.restartGame();
                if (result.ok) push("انطلقت مباراة جديدة", "success");
                else push(result.error, "error");
              }}
            >
              🔁 العبوا مرة أخرى
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
