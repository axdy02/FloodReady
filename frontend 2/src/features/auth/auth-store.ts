import type { UserDto } from "@/lib/api/contracts";
import type { AuthState, Session } from "@/features/auth/types";

let session: Session | null = null;
let state: AuthState = { kind: "RESTORING" };
const listeners = new Set<() => void>();

export const authStore = {
  getAccessToken: () => session?.accessToken,
  getState: () => state,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
  setSession: (accessToken: string, user: UserDto, expiresInSeconds: number) => { session = { accessToken, user, expiresAt: Date.now() + expiresInSeconds * 1000 }; state = { kind: "AUTHENTICATED", ...session }; listeners.forEach((listener) => listener()); },
  setRestoring: () => { state = { kind: "RESTORING" }; listeners.forEach((listener) => listener()); },
  setRefreshing: () => { if (session !== null) state = { kind: "REFRESHING", user: session.user }; listeners.forEach((listener) => listener()); },
  setUnavailable: (message: string) => { session = null; state = { kind: "SESSION_UNAVAILABLE", message }; listeners.forEach((listener) => listener()); },
  clearSession: () => { session = null; state = { kind: "ANONYMOUS" }; listeners.forEach((listener) => listener()); },
  updateUser: (user: UserDto) => { if (session !== null) { session = { ...session, user }; state = { kind: "AUTHENTICATED", ...session }; listeners.forEach((listener) => listener()); } }
};
