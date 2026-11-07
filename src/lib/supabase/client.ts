import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client.
 *
 * The project is configured for *anonymous* sign-in, so the visitor never sees
 * an account screen: the session is a technical detail used only so that
 * Postgres Row Level Security can tell players apart.
 */
let cached: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured() {
  return getSupabaseConfig() !== null;
}

export function getSupabaseBrowserClient() {
  if (cached) return cached;
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
  cached = createBrowserClient(config.url, config.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 20 },
    },
  });
  return cached;
}
