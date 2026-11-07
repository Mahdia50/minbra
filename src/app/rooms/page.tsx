"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SessionGate } from "@/components/session/SessionGate";
import { ProfileSetup } from "@/components/session/ProfileSetup";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PageShell, TopBar, EmptyState, Notice, LoadingScreen } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { humanError, LANGUAGE_LABEL } from "@/lib/constants";
import type { PublicRoom, RoomStatus } from "@/lib/types";

const STATUS_LABEL: Record<RoomStatus, string> = {
  lobby: "في اللوبي",
  playing: "مباراة جارية",
  finished: "انتهت",
};

export default function PublicRoomsPage() {
  return (
    <PageShell>
      <SessionGate>
        <TopBar back={{ href: "/", label: "الرئيسية" }}>
          <CreateRoomButton />
        </TopBar>
        <Rooms />
      </SessionGate>
    </PageShell>
  );
}

function CreateRoomButton() {
  const router = useRouter();
  return (
    <Button size="sm" variant="secondary" onClick={() => router.push("/create")}>
      أنشئ غرفة
    </Button>
  );
}

function Rooms() {
  const router = useRouter();
  const { player, client } = useSession();
  const { push } = useToast();

  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | "random" | null>(null);

  const load = useCallback(() => {
    if (!client) return;
    // State updates live inside promise callbacks so React can tell they are
    // asynchronous (a synchronous setState in an effect body would cascade).
    return Promise.resolve(client.rpc("api_list_public_rooms"))
      .then(({ data, error: rpcError }) => {
        if (rpcError) throw rpcError;
        setRooms(
          ((data ?? []) as PublicRoom[]).map((room) => ({
            ...room,
            player_count: Number(room.player_count),
          })),
        );
        setError(null);
      })
      .catch((err) => setError(humanError(err)))
      .finally(() => setLoading(false));
  }, [client]);

  useEffect(() => {
    if (!player) return;
    void load();
    const id = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(id);
  }, [player, load]);

  if (!player) return <ProfileSetup />;

  async function joinById(id: string) {
    if (!client) return;
    setBusyId(id);
    try {
      const { data, error: rpcError } = await client.rpc("api_join_room", { p_room_id: id });
      if (rpcError) throw rpcError;
      router.push(`/room/${(data as { code: string }).code}`);
    } catch (err) {
      push(humanError(err), "error");
      setBusyId(null);
      void load();
    }
  }

  async function joinRandom() {
    if (!client) return;
    setBusyId("random");
    try {
      const { data, error: rpcError } = await client.rpc("api_join_random_room");
      if (rpcError) throw rpcError;
      router.push(`/room/${(data as { code: string }).code}`);
    } catch (err) {
      push(humanError(err), "error");
      setBusyId(null);
      void load();
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">الغرف العامة</h1>
          <p className="mt-1 text-sm text-muted">يُحدَّث العرض كل 10 ثوانٍ تلقائيًا.</p>
        </div>
        <Button onClick={joinRandom} loading={busyId === "random"} variant="primary">
          🎲 انضمام عشوائي
        </Button>
      </div>

      {error && <Notice tone="bad">{error}</Notice>}

      {loading ? (
        <LoadingScreen label="جارٍ جلب الغرف…" />
      ) : rooms.length === 0 ? (
        <EmptyState
          icon="🌙"
          title="لا توجد غرف عامة الآن"
          description="أنشئ غرفة عامة وسيظهر اسمك للبقية. أو شارك رمز غرفة خاصة مع أصدقائك."
          action={
            <Button onClick={() => router.push("/create")}>أنشئ غرفة عامة</Button>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          <AnimatePresence initial={false}>
            {rooms.map((room) => {
              const full = Number(room.player_count) >= room.max_players;
              const inProgress = room.status !== "lobby";
              return (
                <motion.li
                  key={room.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="flex items-center justify-between gap-4 rounded-[16px] border border-line bg-surface/80 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-ink">{room.name}</h3>
                        <Badge tone={inProgress ? "warn" : "good"}>{STATUS_LABEL[room.status]}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                        <span className="numeric">
                          👥 {room.player_count}/{room.max_players}
                        </span>
                        <span>🎯 {room.rounds_count} جولات</span>
                        <span>🗣 {LANGUAGE_LABEL[room.language]}</span>
                        {room.host_name && <span>👑 {room.host_name}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={full ? "secondary" : "primary"}
                      disabled={full}
                      loading={busyId === room.id}
                      onClick={() => joinById(room.id)}
                    >
                      {full ? "ممتلئة" : "انضم"}
                    </Button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
