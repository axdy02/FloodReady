import type { AuthDto, UserDto } from "@/lib/api/contracts";

export type AuthState = { kind: "RESTORING" } | { kind: "ANONYMOUS" } | { kind: "AUTHENTICATED"; user: UserDto; accessToken: string; expiresAt: number } | { kind: "REFRESHING"; user: UserDto } | { kind: "SESSION_UNAVAILABLE"; message: string };
export type Session = Pick<AuthDto, "accessToken" | "user"> & { expiresAt: number };
