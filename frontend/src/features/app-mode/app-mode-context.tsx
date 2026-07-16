"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type AppMode = "live" | "demo";
type AppModeContextValue = { mode: AppMode; setMode: (mode: AppMode) => void };
const AppModeContext = createContext<AppModeContextValue | null>(null);
const modeCookie = "floodready-app-mode";

function readStoredMode(): AppMode | null {
  const encoded = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${modeCookie}=`))
    ?.split("=")[1];
  const mode = encoded === undefined ? null : decodeURIComponent(encoded);
  return mode === "live" || mode === "demo" ? mode : null;
}

function persistMode(mode: AppMode): void {
  document.cookie = `${modeCookie}=${encodeURIComponent(mode)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("demo");
  useEffect(() => {
    const stored = readStoredMode();
    if (stored !== null) setModeState(stored);
  }, []);
  const value = useMemo(() => ({
    mode,
    setMode: (next: AppMode) => {
      setModeState(next);
      persistMode(next);
    },
  }), [mode]);
  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}
const previewMode: AppModeContextValue = { mode: "demo", setMode: () => undefined };
export function useAppMode() { return useContext(AppModeContext) ?? previewMode; }
