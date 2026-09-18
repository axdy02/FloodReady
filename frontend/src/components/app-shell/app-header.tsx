"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/app-shell/brand-mark";
import { PillNav } from "@/components/app-shell/pill-nav";
const appRoutes = ["/dashboard", "/map", "/reports", "/area-intelligence", "/saved-areas", "/route-planner", "/community", "/profile", "/settings"];
const landingItems = [
  { label: "Overview", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "Live map", href: "/map" },
  { label: "About", href: "/#about" },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  if (appRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return null;

  return <header className="sticky top-0 z-50 border-b border-[#171714] bg-[#f7f2e8]/95 backdrop-blur-xl">
    <div className="flex min-h-[4.75rem] w-full items-center justify-between gap-2 px-3 sm:gap-4 sm:px-8 xl:px-12">
      <Link href="/" aria-label="WaterRadar home" className="shrink-0"><BrandMark compact /></Link>
      <div className="hidden md:block"><PillNav items={landingItems} activeHref={pathname} /></div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="md:hidden"><PillNav items={landingItems} activeHref={pathname} /></div>
        <Link className="hidden text-xs font-bold uppercase tracking-[.12em] text-[#34322d] underline-offset-4 hover:underline lg:block" href="/login">Sign in</Link>
        <Link href="/map" aria-label="View live radar" className="inline-flex min-h-11 items-center gap-2 border border-[#171714] bg-[#171714] px-3 text-xs font-bold uppercase tracking-[.1em] text-[#f7f2e8] transition hover:bg-[#f05a28] hover:text-white sm:px-4"><span className="lg:hidden">Radar</span><span className="hidden lg:inline">View live radar</span><ArrowUpRight className="size-3.5" /></Link>
      </div>
    </div>
  </header>;
}
