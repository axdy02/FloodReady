import type { ReactNode } from "react";
import { AuthGate } from "@/features/auth/auth-gate";
import { ProtectedShell } from "@/components/app-shell/protected-shell";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AuthGate><ProtectedShell>{children}</ProtectedShell></AuthGate>;
}
