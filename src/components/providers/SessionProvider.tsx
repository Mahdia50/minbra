"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { clearProfile, loadProfile, saveProfile } from "@/lib/settings";
import { humanError } from "@/lib/constants";

export interface SessionPlayer {
  id: string;
  display_name: string;
  avatar: string;
}

type SessionStatus = "connecting" | "ready" | "error";

interface SessionContextValue {
  /** false when NEXT_PUBLIC_SUPABASE_* env vars are missing. */
  configured: boolean;
  status: SessionStatus;
  error: string | null;
  player: SessionPlayer | null;
  client: SupabaseClient | null;
  /** Names the guest and (re)creates the server-side profile row. */
  signIn: (name: string, avatar: string) => Promise<void>;
  /** Throws away the identity entirely — the next session is a brand-new guest. */
  signOut: () => Promise<void>;
  retry: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [status, setStatus] = useState<SessionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<SessionPlayer | null>(null);
  const [nonce, setNonce] = useState(0);
  const [client] = useState<SupabaseClient | null>(() => {
    if (!configured) return null;
    try {
      return getSupabaseBrowserClient();
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!configured || !client) return;

    let cancelled = false;
    const supabase = client;

    async function boot() {
      try {
        const { data: existing } = await supabase.auth.getSession();
        if (!existing.session) {
          const { error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) throw signInError;
        }

        const stored = loadProfile();
        if (stored) {
          const { data, error: rpcError } = await supabase.rpc("api_bootstrap", {
            p_display_name: stored.name,
            p_avatar: stored.avatar,
          });
          if (rpcError) throw rpcError;
          if (!cancelled && data) {
            setPlayer({
              id: (data as SessionPlayer).id,
              display_name: (data as SessionPlayer).display_name,
              avatar: (data as SessionPlayer).avatar,
            });
          }
        }

        if (!cancelled) setStatus("ready");

        // Housekeeping: drop rooms that nobody is in or that have been idle
        // for hours. Fire-and-forget — it must never block the UI.
        void supabase.rpc("api_cleanup");
      } catch (err) {
        if (cancelled) return;
        const message = humanError(err);
        setError(
          message.includes("Anonymous") || message.includes("anonymous")
            ? "تسجيل الدخول المجهول (Anonymous sign-in) غير مُفعّل في مشروع Supabase."
            : message,
        );
        setStatus("error");
      }
    }

    void boot();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setPlayer(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [configured, client, nonce]);

  const signIn = useCallback(
    async (name: string, avatar: string) => {
      if (!client) throw new Error("SUPABASE_NOT_CONFIGURED");
      const trimmed = name.trim();
      const { data, error: rpcError } = await client.rpc("api_bootstrap", {
        p_display_name: trimmed,
        p_avatar: avatar,
      });
      if (rpcError) throw rpcError;
      const row = data as SessionPlayer;
      saveProfile({ name: row.display_name, avatar: row.avatar });
      setPlayer({ id: row.id, display_name: row.display_name, avatar: row.avatar });
    },
    [client],
  );

  const signOut = useCallback(async () => {
    clearProfile();
    setPlayer(null);
    if (!client) return;
    await client.auth.signOut();
    await client.auth.signInAnonymously();
  }, [client]);

  const retry = useCallback(() => {
    setStatus("connecting");
    setError(null);
    setNonce((n) => n + 1);
  }, []);

  // Without Supabase credentials there is nothing to boot — report "ready"
  // (the UI shows setup instructions instead of an error).
  const effectiveStatus: SessionStatus = configured && client ? status : "ready";

  const value = useMemo<SessionContextValue>(
    () => ({ configured, status: effectiveStatus, error, player, client, signIn, signOut, retry }),
    [configured, effectiveStatus, error, player, client, signIn, signOut, retry],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
