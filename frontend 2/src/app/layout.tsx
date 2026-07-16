import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-shell/app-header";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

export const metadata: Metadata = { title: "FloodReady", description: "Flood reporting and incident awareness" };

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  return <html lang="en"><body><AppProviders><AppHeader />{children}</AppProviders></body></html>;
}
