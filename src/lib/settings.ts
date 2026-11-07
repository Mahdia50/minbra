"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_AVATAR, DEFAULT_SETTINGS, type RoomSettings } from "./constants";

// ---------------------------------------------------------------------------
// Local, per-device preferences. Nothing here is sent to the server.
// ---------------------------------------------------------------------------
export interface LocalProfile {
  name: string;
  avatar: string;
}

export interface LocalPrefs {
  sound: boolean;
  effects: boolean;
  compact: boolean;
  defaults: RoomSettings;
}

const PROFILE_KEY = "minbra.profile.v1";
const PREFS_KEY = "minbra.prefs.v1";

const FALLBACK_PREFS: LocalPrefs = {
  sound: true,
  effects: true,
  compact: false,
  defaults: DEFAULT_SETTINGS,
};

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage disabled — preferences simply won't persist */
  }
}

export function loadProfile(): LocalProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalProfile>;
    if (!parsed.name) return null;
    return { name: parsed.name, avatar: parsed.avatar || DEFAULT_AVATAR };
  } catch {
    return null;
  }
}

export function saveProfile(profile: LocalProfile) {
  writeJson(PROFILE_KEY, profile);
}

export function clearProfile() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROFILE_KEY);
}

/**
 * Reactive preferences backed by localStorage.
 *
 * Implemented as an external store so React can read it during render
 * (server snapshot = defaults) instead of hydrating through an effect.
 */
const listeners = new Set<() => void>();
let cache: LocalPrefs = FALLBACK_PREFS;
let cacheKey: string | null = null;

function readPrefs(): LocalPrefs {
  if (typeof window === "undefined") return FALLBACK_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw === cacheKey) return cache;
    cacheKey = raw;
    cache = raw ? { ...FALLBACK_PREFS, ...(JSON.parse(raw) as Partial<LocalPrefs>) } : FALLBACK_PREFS;
  } catch {
    cache = FALLBACK_PREFS;
  }
  return cache;
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === PREFS_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function serverPrefs() {
  return FALLBACK_PREFS;
}

function serverHydrated() {
  return false;
}

function clientHydrated() {
  return true;
}

export function useLocalPrefs() {
  const prefs = useSyncExternalStore(subscribe, readPrefs, serverPrefs);
  const hydrated = useSyncExternalStore(subscribe, clientHydrated, serverHydrated);

  const update = useCallback((patch: Partial<LocalPrefs>) => {
    writeJson(PREFS_KEY, { ...readPrefs(), ...patch });
    emit();
  }, []);

  const reset = useCallback(() => {
    writeJson(PREFS_KEY, FALLBACK_PREFS);
    emit();
  }, []);

  return useMemo(() => ({ prefs, hydrated, update, reset }), [prefs, hydrated, update, reset]);
}
