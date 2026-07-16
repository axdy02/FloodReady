import type { AuthState } from "@/features/auth/types";

export const authStates = ["RESTORING", "ANONYMOUS", "AUTHENTICATED", "REFRESHING", "SESSION_UNAVAILABLE"] as const;
export function isProtectedState(state: AuthState): boolean { return state.kind === "AUTHENTICATED" || state.kind === "REFRESHING"; }
