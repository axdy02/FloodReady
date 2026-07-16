"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type AppMode = "live" | "demo";
type AppModeContextValue = { mode: AppMode; setMode: (mode: AppMode) => void };
const AppModeContext = createContext<AppModeContextValue | null>(null);
const storageKey = "floodready-app-mode";

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("demo");
  useEffect(() => { const stored = window.localStorage.getItem(storageKey); if (stored === "live" || stored === "demo") setModeState(stored); }, []);
  const value = useMemo(() => ({ mode, setMode: (next: AppMode) => { setModeState(next); window.localStorage.setItem(storageKey, next); } }), [mode]);
  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}
const previewMode: AppModeContextValue = { mode: "demo", setMode: () => undefined };
export function useAppMode() { return useContext(AppModeContext) ?? previewMode; }
