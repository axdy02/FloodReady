"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { createQueryClient } from "@/lib/query/client";
import { AuthProvider } from "@/features/auth/auth-context";
import { AppModeProvider } from "@/features/app-mode/app-mode-context";

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}><AppModeProvider><AuthProvider>{children}</AuthProvider></AppModeProvider></QueryClientProvider>;
}
