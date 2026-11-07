"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRoom } from "@/lib/hooks/useRoom";
import { SessionGate } from "@/components/session/SessionGate";
import { ProfileSetup } from "@/components/session/ProfileSetup";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PageShell, LoadingScreen, Notice, EmptyState } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { RoomHeader } from "@/components/game/RoomHeader";
import { LobbyView } from "@/components/game/LobbyView";
import { GameView } from "@/components/game/GameView";
import { FinishedView } from "@/components/game/FinishedView";
import { ChatPanel } from "@/components/game/ChatPanel";

export function RoomClient({ code }: { code: string }) {
  return (
    <PageShell wide>
      <SessionGate>
        <RoomRoom code={code} />
      </SessionGate>
    </PageShell>
  );
}

function RoomRoom({ code }: { code: string }) {
  const { player } = useSession();
  const router = useRouter();
  const controller = useRoom(code);
  const { push } = useToast();
  const [leaving, setLeaving] = useState(false);

  if (!player) {
    return (
      <div className="mx-auto max-w-md pt-6">
        <ProfileSetup />
      </div>
    );
  }

  if (controller.status === "idle") {
    return <LoadingScreen label="جارٍ تحميل الغرفة…" />;
  }

  if (controller.status === "error" || !controller.room) {
    return (
      <div className="mx-auto max-w-xl pt-6">
        <EmptyState
          icon="🚪"
          title="تعذّر الدخول إلى الغرفة"
          description={controller.error ?? "تأكّد من الرمز، أو أن الغرفة ما زالت مفتوحة."}
          action={
            <div className="flex gap-2">
              <Button onClick={() => router.push(`/join?code=${code}`)}>الانضمام بالرمز</Button>
              <Button variant="secondary" onClick={() => router.push("/")}>
                الرئيسية
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const { room, players, isMember, actions } = controller;

  async function leave() {
    setLeaving(true);
    await actions.leave();
    router.push("/");
  }

  if (!isMember) {
    return (
      <div className="mx-auto max-w-xl pt-6">
        <Notice tone="warn" title="أنت لست في هذه الغرفة">
          هذه غرفة {room.is_public ? "عامة" : "خاصة"} باسم «{room.name}».{" "}
          {room.status !== "lobby" && !room.allow_mid_game_join
            ? "المباراة انطلقت ولا يُسمح بالانضمام المتأخر."
            : "يمكنك الانضمام الآن."}
        </Notice>
        <div className="mt-4 flex gap-2">
          <Button
            disabled={room.status !== "lobby" && !room.allow_mid_game_join}
            onClick={async () => {
              const result = await actions.join();
              if (!result.ok) push(result.error, "error");
            }}
          >
            انضم إلى الغرفة
          </Button>
          <Button variant="secondary" onClick={() => router.push("/")}>
            الرئيسية
          </Button>
        </div>
      </div>
    );
  }

  const chatEnabled = room.allow_chat;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="min-w-0">
        <RoomHeader
          room={room}
          playerCount={players.length}
          maxPlayers={room.max_players}
          onLeave={leave}
          leaving={leaving}
        />

        {room.status === "lobby" && <LobbyView controller={controller} />}
        {room.status === "playing" && <GameView controller={controller} />}
        {room.status === "finished" && <FinishedView controller={controller} />}
      </div>

      <ChatPanel
        roomId={room.id}
        enabled={chatEnabled}
        send={actions.sendChat}
        className="lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)]"
      />
    </div>
  );
}
