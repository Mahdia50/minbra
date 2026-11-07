"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "./SessionProvider";
import { SettingsProvider } from "./SettingsProvider";
import { ToastProvider } from "./ToastProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ToastProvider>
        <SessionProvider>{children}</SessionProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
