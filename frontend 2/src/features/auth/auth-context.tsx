"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { authApi } from "@/features/auth/api";
import { authStore } from "@/features/auth/auth-store";
import type { AuthState } from "@/features/auth/types";

const AuthContext = createContext<AuthState>(authStore.getState());
let refreshPromise: Promise<void> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getState);
  useEffect(() => { if (state.kind !== "RESTORING") return; void restore(); }, [state.kind]);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

async function restore(): Promise<void> {
  if (refreshPromise !== null) return refreshPromise;
  refreshPromise = authApi.refresh().then((auth) => authStore.setSession(auth.accessToken, auth.user, auth.expiresInSeconds)).catch((error: unknown) => { if (error instanceof Error && "code" in error && error.code === "INVALID_REFRESH_TOKEN") authStore.clearSession(); else authStore.setUnavailable("Session restoration is unavailable."); }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export function useAuth(): AuthState { return useContext(AuthContext); }
export function restoreSession(): Promise<void> { authStore.setRestoring(); return restore(); }
export async function logout(): Promise<void> { try { await authApi.logout(); } catch (error) { void error; } finally { authStore.clearSession(); } }
