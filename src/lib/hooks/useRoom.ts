"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSession } from "@/components/providers/SessionProvider";
import { humanError, type RoomSettings } from "@/lib/constants";
import type { RoomState } from "@/lib/types";
import { secondsLeft, useNow } from "./useNow";

export type RoomLoadStatus = "idle" | "ready" | "error";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type GuessResult =
  | { ok: true; correct: boolean }
  | { ok: false; error: string };

const RESYNC_INTERVAL = 30_000;
const HEARTBEAT_INTERVAL = 20_000;
const EVENT_DEBOUNCE = 140;
const ADVANCE_RETRY_DELAY = 1_200;

/**
 * The single source of truth for one room.
 *
 * - mounts  : full `api_room_state` snapshot
 * - live    : `postgres_changes` on the 8 realtime tables, debounced into one refetch
 * - health  : `api_heartbeat` every 20s so the room can show who is online
 * - clock   : advances expired phases server-side (validated by the engine)
 * - resync  : on reconnect, on tab focus, and every 30s as a safety net
 */
export function useRoom(code: string) {
  const { client, player, status: sessionStatus } = useSession();
  const [state, setState] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<RoomLoadStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const now = useNow(500);
  const channelId = useId();
  const requestIdRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const advanceRef = useRef<string | null>(null);

  const ready = sessionStatus === "ready";
  const surface = code.trim();

  // -------------------------------------------------------------------------
  // Snapshot fetch
  // -------------------------------------------------------------------------
  const fetchState = useCallback(() => {
    if (!client || !surface) return;
    const requestId = ++requestIdRef.current;
    // State updates live inside promise callbacks so React can tell they are
    // asynchronous (a synchronous setState in an effect body would cascade).
    return Promise.resolve(client.rpc("api_room_state", { p_code: surface }))
      .then(({ data, error: rpcError }) => {
        if (requestId !== requestIdRef.current) return; // a newer fetch already won
        if (rpcError) {
          setError(humanError(rpcError));
          setStatus("error");
          return;
        }
        setState(data as RoomState);
        setError(null);
        setStatus("ready");
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setError(humanError(err));
        setStatus("error");
      });
  }, [client, surface]);

  const reload = useCallback(() => fetchState(), [fetchState]);
  const resync = useCallback(() => fetchState(), [fetchState]);

  useEffect(() => {
    if (!ready || !client || !surface) return;
    void fetchState();
  }, [ready, client, surface, fetchState]);

  // -------------------------------------------------------------------------
  // Realtime — every mutation lands here and turns into one debounced refetch
  // -------------------------------------------------------------------------
  const roomId = state?.room.id ?? null;

  useEffect(() => {
    if (!client || !roomId) return;

    const schedule = () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void fetchState();
      }, EVENT_DEBOUNCE);
    };

    const channel = client.channel(channelId);
    const tables: Array<{ table: string; column: string }> = [
      { table: "rooms", column: "id" },
      { table: "room_players", column: "room_id" },
      { table: "games", column: "room_id" },
      { table: "game_players", column: "room_id" },
      { table: "game_rounds", column: "room_id" },
      { table: "clues", column: "room_id" },
      { table: "votes", column: "room_id" },
      { table: "chat_messages", column: "room_id" },
    ];

    for (const { table, column } of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `${column}=eq.${roomId}` },
        schedule,
      );
    }

    channel.subscribe((subStatus) => {
      if (subStatus === "SUBSCRIBED") void fetchState();
      if (subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT") {
        // the socket dropped — the snapshot is now possibly stale
        window.setTimeout(() => void fetchState(), 800);
      }
    });

    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
      void client.removeChannel(channel);
    };
  }, [client, roomId, fetchState, channelId]);

  // -------------------------------------------------------------------------
  // Heartbeat + periodic safety resync + reconnect handling
  // -------------------------------------------------------------------------
  const isMember = state?.is_member ?? false;

  useEffect(() => {
    if (!client || !roomId || !isMember) return;

    const beat = () => {
      void client.rpc("api_heartbeat", { p_room_id: roomId });
    };
    beat();
    const beatId = window.setInterval(beat, HEARTBEAT_INTERVAL);
    const syncId = window.setInterval(() => void fetchState(), RESYNC_INTERVAL);

    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchState();
    };
    const onOnline = () => void fetchState();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onOnline);

    return () => {
      window.clearInterval(beatId);
      window.clearInterval(syncId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onOnline);
    };
  }, [client, roomId, isMember, fetchState]);

  // -------------------------------------------------------------------------
  // Phase clock — whoever notices first asks the engine to move on.
  // -------------------------------------------------------------------------
  const round = state?.round ?? null;
  const roundPhase = round?.phase ?? null;
  const roundEndsAt = round?.phase_ends_at ?? null;
  const roundId = round?.id ?? null;

  useEffect(() => {
    if (!client || !roundId || !roundPhase || !isMember) return;
    if (secondsLeft(roundEndsAt, now) !== 0) return;

    const key = `${roundId}:${roundPhase}`;
    if (advanceRef.current === key) return;
    advanceRef.current = key;

    void (async () => {
      const { error: rpcError } = await client.rpc("api_advance", {
        p_round_id: roundId,
        p_force: false,
      });
      if (rpcError) {
        // let someone else try again shortly
        window.setTimeout(() => {
          if (advanceRef.current === key) advanceRef.current = null;
        }, ADVANCE_RETRY_DELAY);
      }
      void fetchState();
    })();
  }, [client, roundId, roundPhase, roundEndsAt, isMember, now, fetchState]);

  // -------------------------------------------------------------------------
  // Actions — thin wrappers that refetch after the engine accepts
  // -------------------------------------------------------------------------
  const run = useCallback(
    async (fn: (c: SupabaseClient) => PromiseLike<{ error: unknown }>): Promise<ActionResult> => {
      if (!client) return { ok: false, error: "لم يتم ربط Supabase بعد." };
      try {
        const { error: rpcError } = await fn(client);
        if (rpcError) throw rpcError;
        void fetchState();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: humanError(err) };
      }
    },
    [client, fetchState],
  );

  const actions = useMemo(() => {
    const need = (id: string | null | undefined) => {
      if (!id) throw new Error("ROOM_NOT_FOUND");
      return id;
    };
    return {
      join: () => run((c) => c.rpc("api_join_room", { p_room_id: need(roomId) })),
      leave: () => run((c) => c.rpc("api_leave_room", { p_room_id: need(roomId) })),
      setReady: (value: boolean) =>
        run((c) => c.rpc("api_set_ready", { p_room_id: need(roomId), p_ready: value })),
      updateSettings: (settings: Partial<RoomSettings>) =>
        run((c) => c.rpc("api_update_settings", { p_room_id: need(roomId), p_settings: settings })),
      kick: (playerId: string) =>
        run((c) => c.rpc("api_kick_player", { p_room_id: need(roomId), p_player_id: playerId })),
      transferHost: (playerId: string) =>
        run((c) => c.rpc("api_transfer_host", { p_room_id: need(roomId), p_player_id: playerId })),
      startGame: () => run((c) => c.rpc("api_start_game", { p_room_id: need(roomId) })),
      restartGame: () => run((c) => c.rpc("api_restart_game", { p_room_id: need(roomId) })),
      stopGame: () => run((c) => c.rpc("api_stop_game", { p_room_id: need(roomId) })),
      confirmRole: () => run((c) => c.rpc("api_confirm_role", { p_round_id: need(roundId) })),
      submitClue: (text: string) =>
        run((c) => c.rpc("api_submit_clue", { p_round_id: need(roundId), p_text: text })),
      castVote: (targetId: string) =>
        run((c) => c.rpc("api_cast_vote", { p_round_id: need(roundId), p_target_id: targetId })),
      advance: (force = false) =>
        run((c) => c.rpc("api_advance", { p_round_id: need(roundId), p_force: force })),
      sendChat: (body: string) =>
        run((c) => c.rpc("api_send_chat", { p_room_id: need(roomId), p_body: body })),
      submitGuess: async (guess: string): Promise<GuessResult> => {
        if (!client) return { ok: false, error: "لم يتم ربط Supabase بعد." };
        try {
          const { data, error: rpcError } = await client.rpc("api_submit_guess", {
            p_round_id: need(roundId),
            p_guess: guess,
          });
          if (rpcError) throw rpcError;
          void fetchState();
          return { ok: true, correct: Boolean(data) };
        } catch (err) {
          return { ok: false, error: humanError(err) };
        }
      },
    };
  }, [run, roomId, roundId, client, fetchState]);

  // -------------------------------------------------------------------------
  // Derived helpers for the UI
  // -------------------------------------------------------------------------
  const myPlayerId = player?.id ?? null;
  const me = useMemo(
    () => state?.players.find((p) => p.player_id === myPlayerId) ?? null,
    [state?.players, myPlayerId],
  );

  return {
    state,
    status,
    error,
    now,
    reload,
    resync,
    actions,
    myPlayerId,
    me,
    isMember: state?.is_member ?? false,
    isHost: Boolean(me?.is_host),
    room: state?.room ?? null,
    players: state?.players ?? [],
    game: state?.game ?? null,
    round: state?.round ?? null,
    myRole: state?.my_role ?? null,
    myVote: state?.my_vote ?? null,
    clues: state?.clues ?? [],
    reveal: state?.reveal ?? null,
  };
}

export type RoomController = ReturnType<typeof useRoom>;
