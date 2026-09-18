"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Waves } from "lucide-react";

const protectedRoutes = ["/dashboard", "/map", "/reports", "/alerts", "/route-planner", "/community", "/profile", "/settings"];

export function AppHeader() {
  const pathname = usePathname();
  if (protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return null;

  return <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5"><Link href="/map" className="flex items-center gap-2 font-semibold text-slate-950"><span className="grid size-8 place-items-center rounded-md bg-slate-950 text-white"><Waves className="size-4" /></span>FloodReady</Link><div className="flex items-center gap-2">{pathname !== "/login" ? <Link href="/login" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Sign in</Link> : null}{pathname !== "/register" ? <Link href="/register" className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Create account</Link> : null}</div></div></header>;
}
