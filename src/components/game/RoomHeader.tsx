"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { copyText, roomInviteLink } from "@/lib/utils/clipboard";
import { useToast } from "@/components/providers/ToastProvider";
import type { Room, RoomStatus } from "@/lib/types";

const STATUS: Record<RoomStatus, { label: string; tone: "good" | "warn" | "neutral" }> = {
  lobby: { label: "لوبي", tone: "good" },
  playing: { label: "مباراة جارية", tone: "warn" },
  finished: { label: "انتهت", tone: "neutral" },
};

export function RoomHeader({
  room,
  playerCount,
  maxPlayers,
  onLeave,
  leaving,
  children,
}: {
  room: Room;
  playerCount: number;
  maxPlayers: number;
  onLeave: () => void;
  leaving?: boolean;
  children?: React.ReactNode;
}) {
  const { push } = useToast();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(kind: "code" | "link") {
    const value = kind === "code" ? room.code : roomInviteLink(room.code);
    const ok = await copyText(value);
    if (ok) {
      setCopied(kind);
      push(kind === "code" ? "تم نسخ الرمز" : "تم نسخ رابط الدعوة", "success");
      window.setTimeout(() => setCopied(null), 1800);
    } else {
      push("تعذّر النسخ، انسخه يدويًا.", "error");
    }
  }

  return (
    <header className="panel-flat mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-bold text-ink">{room.name}</h1>
            <Badge tone={STATUS[room.status].tone}>{STATUS[room.status].label}</Badge>
            <Badge tone={room.is_public ? "accent" : "neutral"}>
              {room.is_public ? "عامة" : "خاصة"}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
            <span className="numeric">
              👥 {playerCount}/{maxPlayers}
            </span>
            <span className="numeric">🎯 {room.rounds_count} جولات</span>
            <span className="numeric">🎭 {room.outliers_count} خارج السالفة</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {children}
          <button
            onClick={() => copy("code")}
            title="نسخ رمز الغرفة"
            className="flex items-center gap-2 rounded-[12px] border border-line bg-base/60 px-3 py-2 transition-colors hover:border-brand/50"
          >
            <span className="numeric text-lg font-bold tracking-[0.22em] text-ink">{room.code}</span>
            <span className="text-xs text-muted">{copied === "code" ? "✓" : "📋"}</span>
          </button>
          <Button size="sm" variant="secondary" onClick={() => copy("link")}>
            {copied === "link" ? "✓ نُسخ" : "رابط الدعوة"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onLeave} loading={leaving}>
            خروج
          </Button>
        </div>
      </div>
    </header>
  );
}
