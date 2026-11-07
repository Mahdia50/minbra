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

export type SupabaseUrlState = "missing" | "key-missing" | "not-https" | "placeholder" | "malformed" | "ok";

export interface SupabaseUrlInfo {
  state: SupabaseUrlState;
  url: string | null;
  host: string | null;
}

/**
 * Looks at the configured URL *before* any request is made. A wrong URL is the
 * usual reason a browser reports "Failed to fetch", and a generic
 * "check your internet" message would hide it.
 */
export function inspectSupabaseUrl(): SupabaseUrlInfo {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return { state: "missing", url: null, host: null };
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return { state: "key-missing", url, host: null };
  if (!/^https:\/\//i.test(url)) return { state: "not-https", url, host: null };
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return { state: "malformed", url, host: null };
  }
  if (!host || /(^|\.)x{4,}|your-project|placeholder|example\.com/i.test(host)) {
    return { state: "placeholder", url, host };
  }
  return { state: "ok", url, host };
}

/** Human-readable explanation for a bad URL, or null when the URL looks usable. */
export function describeSupabaseUrl(info: SupabaseUrlInfo): string | null {
  switch (info.state) {
    case "missing":
      return "المتغيّر NEXT_PUBLIC_SUPABASE_URL غير موجود. أضفه في .env.local ثم أعد تشغيل الخادم.";
    case "key-missing":
      return "المتغيّر NEXT_PUBLIC_SUPABASE_ANON_KEY غير موجود. انسخ المفتاح العام من Supabase → Project Settings → API.";
    case "not-https":
      return "رابط Supabase يجب أن يبدأ بـ https:// — القيمة الحالية تبدأ بغير ذلك.";
    case "placeholder":
      return "رابط Supabase ما زال قيمة مؤقتة (xxxx…). انسخ الرابط الحقيقي من Supabase → Project Settings → API.";
    case "malformed":
      return "رابط Supabase غير صالح. انسخه كاملًا من Supabase → Project Settings → API.";
    default:
      return null;
  }
}

/**
 * Pings Supabase's public auth health endpoint so the settings page can show a
 * concrete answer (HTTP status / unreachable host) instead of a guess.
 */
export async function pingSupabase(): Promise<{ ok: boolean; detail: string }> {
  const info = inspectSupabaseUrl();
  const problem = describeSupabaseUrl(info);
  if (problem) return { ok: false, detail: problem };

  const base = (info.url as string).replace(/\/+$/, "");
  const key = getSupabaseConfig()?.key ?? "";
  try {
    const response = await fetch(`${base}/auth/v1/health`, { headers: { apikey: key } });
    if (response.ok) return { ok: true, detail: `تم الاتصال بـ ${info.host} بنجاح (HTTP ${response.status}).` };
    if (response.status === 502 || response.status === 503) {
      return {
        ok: false,
        detail: `${info.host} ردّ بـ HTTP ${response.status}. غالبًا مشروع Supabase موقوف (Paused) — افتح لوحة Supabase واضغط Restore.`,
      };
    }
    return { ok: false, detail: `${info.host} ردّ بـ HTTP ${response.status}. تحقّق أن المشروع نشِط وأن الرابط صحيح.` };
  } catch {
    return {
      ok: false,
      detail: `تعذّر الوصول إلى ${info.host}. الرابط غير صحيح أو المشروع محذوف/موقوف، أو الشبكة تحجب الاتصال.`,
    };
  }
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
