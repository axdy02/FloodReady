"use client";

import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

export type AppMode = "live" | "demo";
type AppModeContextValue = { mode: AppMode; setMode: (mode: AppMode) => void };
const AppModeContext = createContext<AppModeContextValue | null>(null);
export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("live");
  const value = useMemo(() => ({ mode, setMode: setModeState }), [mode]);
  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}
const previewMode: AppModeContextValue = { mode: "live", setMode: () => undefined };
export function useAppMode() { return useContext(AppModeContext) ?? previewMode; }
