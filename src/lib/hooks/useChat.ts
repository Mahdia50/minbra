"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { humanError } from "@/lib/constants";
import type { ChatMessage } from "@/lib/types";

const BACKLOG = 80;

/** Live chat backlog for one room. New rows arrive over Realtime. */
export function useChat(roomId: string | null, enabled: boolean) {
  const { client } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const load = useCallback(() => {
    if (!client || !roomId) return;
    // State updates live inside promise callbacks so React can tell they are
    // asynchronous (a synchronous setState in an effect body would cascade).
    return Promise.resolve(
      client
        .from("chat_messages")
        .select("id, room_id, player_id, author_name, kind, body, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(BACKLOG),
    )
      .then(({ data, error: queryError }) => {
        if (queryError) throw queryError;
        const rows = (data as ChatMessage[]).slice().reverse();
        seenRef.current = new Set(rows.map((r) => r.id));
        setMessages(rows);
        setError(null);
      })
      .catch((err) => setError(humanError(err)))
      .finally(() => setLoading(false));
  }, [client, roomId]);

  useEffect(() => {
    if (!enabled || !roomId) return;
    void load();
  }, [enabled, roomId, load]);

  useEffect(() => {
    if (!client || !roomId || !enabled) return;

    const channel = client
      .channel(`chat-${roomId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as ChatMessage;
          if (seenRef.current.has(row.id)) return;
          seenRef.current.add(row.id);
          setMessages((prev) => [...prev, row].slice(-BACKLOG));
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [client, roomId, enabled]);

  return { messages, loading, error, reload: load };
}
