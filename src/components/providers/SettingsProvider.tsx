"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { setSfxEnabled } from "@/lib/audio";
import {
  DEFAULT_AVATAR,
  DEFAULT_SETTINGS,
  type RoomSettings,
} from "@/lib/constants";
import { useLocalPrefs, type LocalPrefs } from "@/lib/settings";

interface SettingsContextValue {
  prefs: LocalPrefs;
  hydrated: boolean;
  update: (patch: Partial<LocalPrefs>) => void;
  reset: () => void;
  /** Default match settings applied to the create-room form. */
  defaults: RoomSettings;
  defaultAvatar: string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { prefs, hydrated, update, reset } = useLocalPrefs();

  useEffect(() => {
    setSfxEnabled(prefs.sound);
  }, [prefs.sound]);

  // The two visual preferences are attributes on <html> so that plain CSS can
  // act on them (see globals.css) without threading props through every view.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.effects = prefs.effects ? "on" : "off";
    root.dataset.density = prefs.compact ? "compact" : "cozy";
  }, [prefs.effects, prefs.compact]);

  return (
    <SettingsContext.Provider
      value={{
        prefs,
        hydrated,
        update,
        reset,
        defaults: { ...DEFAULT_SETTINGS, ...prefs.defaults },
        defaultAvatar: DEFAULT_AVATAR,
      }}
    >
      <MotionConfig reducedMotion={prefs.effects ? "never" : "always"}>{children}</MotionConfig>
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
