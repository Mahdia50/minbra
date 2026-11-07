"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/lib/hooks/useChat";
import { useToast } from "@/components/providers/ToastProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { playSfx } from "@/lib/audio";

export function ChatPanel({
  roomId,
  enabled,
  send,
  className,
}: {
  roomId: string | null;
  enabled: boolean;
  send: (body: string) => Promise<{ ok: boolean; error?: string }>;
  className?: string;
}) {
  const { messages, loading } = useChat(roomId, enabled);
  const { player } = useSession();
  const { push } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const result = await send(body);
    if (result.ok) {
      setText("");
      playSfx("click");
    } else {
      push(result.error ?? "تعذّر الإرسال", "error");
    }
    setBusy(false);
  }

  if (!enabled) {
    return (
      <div className={cn("panel-flat flex min-h-[180px] items-center justify-center p-5", className)}>
        <p className="text-xs text-muted">الدردشة معطّلة في هذه الغرفة.</p>
      </div>
    );
  }

  return (
    <div className={cn("panel-flat flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-sm font-bold text-ink">الدردشة</h3>
        <span className="text-[11px] text-faint">{messages.length} رسالة</span>
      </div>

      <div ref={listRef} className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {loading && <p className="text-center text-xs text-faint">جارٍ التحميل…</p>}
        {!loading && messages.length === 0 && (
          <p className="py-6 text-center text-xs text-faint">لا رسائل بعد — ابدأ الحديث.</p>
        )}
        {messages.map((message) => {
          const mine = message.player_id === player?.id;
          const system = message.kind === "system";
          if (system) {
            return (
              <p key={message.id} className="py-0.5 text-center text-[11px] leading-relaxed text-faint">
                {message.body}
              </p>
            );
          }
          return (
            <div key={message.id} className={cn("flex", mine ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-[13px] border px-3 py-2",
                  mine ? "border-brand/35 bg-brand/12" : "border-line bg-elevated",
                )}
              >
                {!mine && <div className="mb-0.5 text-[10px] text-muted">{message.author_name}</div>}
                <p className="text-[13px] leading-relaxed text-ink">{message.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={240}
          placeholder="اكتب رسالة…"
          className="h-10"
        />
        <Button type="submit" size="sm" loading={busy} disabled={!text.trim()}>
          إرسال
        </Button>
      </form>
    </div>
  );
}
