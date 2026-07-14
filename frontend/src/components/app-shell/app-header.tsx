"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Waves } from "lucide-react";
import { PillNav } from "@/components/app-shell/pill-nav";

const appRoutes = ["/dashboard", "/map", "/reports", "/alerts", "/route-planner", "/community", "/profile", "/settings"];

const landingItems = [
  { label: "Overview", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "Live map", href: "/map" },
  { label: "About", href: "/#about" }
];

export function AppHeader() {
  const pathname = usePathname();

  if (appRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return null;

  return <header className="sticky top-0 z-50 border-b border-white/[.06] bg-[#09090b]/80 backdrop-blur-xl">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-blue-400 to-cyan-400 text-[#07101e]"><Waves className="size-4" /></span>
        FloodReady
        <span className="text-[10px] font-medium text-zinc-500">LIVE</span>
      </Link>

      <div className="hidden md:block">
        <PillNav items={landingItems} activeHref={pathname} initialLoadAnimation={false} showBrand={false} />
      </div>

      <div className="flex items-center gap-3">
        <Link className="hidden text-xs font-medium text-zinc-300 sm:block" href="/login">Sign in</Link>
        <Link href="/map" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-950 transition-transform hover:scale-[1.02]">
          Open app <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </div>
  </header>;
}
