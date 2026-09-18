"use client";

import Link from "next/link";
import { Bookmark, ClipboardList, ClipboardPlus, LayoutDashboard, LogOut, MapPinned, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/app-shell/brand-mark";
import { logout } from "@/features/auth/auth-context";

const items = [
  ["Dashboard", "/dashboard", LayoutDashboard],
  ["Map", "/map", MapPinned],
  ["Reports", "/reports", ClipboardList],
  ["Submit a Report", "/reports/new", ClipboardPlus],
  ["Area Intelligence", "/area-intelligence", Sparkles],
  ["Saved Areas", "/saved-areas", Bookmark],
] as const;

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/reports") return pathname === "/reports" || (pathname.startsWith("/reports/") && pathname !== "/reports/new");
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

export function ProtectedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div data-wr-app className="min-h-screen bg-[#f4efe5] text-[#171714] lg:pl-72">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-black bg-[#171714] text-[#f7f2e8] lg:block">
      <div className="flex h-full flex-col px-5 py-6">
      <Link href="/dashboard" className="border-b border-white/15 pb-6"><BrandMark inverse /></Link>
      <div className="mt-8 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[.2em] text-white/40"><span>Operations</span><span className="text-[#ff7a45]">Live</span></div>
      <nav aria-label="Main navigation" className="mt-3 space-y-1">{items.map(([label, href, Icon], index) => { const active = isNavActive(pathname, href); return <Link key={href} href={href} className={`group relative flex min-h-12 items-center gap-3 border-l-2 px-3 text-sm font-semibold transition ${active ? "border-[#f05a28] bg-white/[.08] text-white" : "border-transparent text-white/55 hover:border-white/25 hover:bg-white/[.04] hover:text-white"}`}><span className="w-5 text-[10px] font-bold text-white/25">0{index + 1}</span><Icon className={`size-4 ${active ? "text-[#ff7a45]" : "text-white/40 group-hover:text-white"}`} />{label}</Link>; })}</nav>
      <div className="mt-auto border-t border-white/15 pt-5 text-xs leading-5 text-white/45"><span className="mr-2 inline-block size-2 rounded-full bg-[#33b6a0]" />Network connected<br /><span className="pl-4">Report signals are active</span></div>
      </div>
    </aside>
    <header className="sticky top-0 z-30 flex min-h-16 items-center border-b border-[#171714] bg-[#f7f2e8]/95 px-5 backdrop-blur-xl"><Link href="/dashboard" className="lg:hidden"><BrandMark compact /></Link><div className="ml-auto flex items-center gap-2"><Link href="/reports/new" className="border border-[#171714] bg-[#f05a28] px-3 py-2 text-xs font-bold uppercase tracking-[.08em] text-white lg:hidden">Submit report</Link><button type="button" onClick={() => void logout()} className="inline-flex min-h-10 items-center gap-2 border border-[#171714] px-3 text-xs font-bold uppercase tracking-[.08em] text-[#171714] transition hover:bg-[#171714] hover:text-white"><LogOut className="size-4" />Sign out</button></div></header>
    <nav aria-label="Mobile navigation" className="sticky top-16 z-20 flex gap-2 overflow-x-auto border-b border-[#171714] bg-[#fffdf7]/95 px-4 py-2 backdrop-blur-xl lg:hidden">{items.map(([label, href, Icon]) => {
      const active = isNavActive(pathname, href);
      return <Link key={href} href={href} className={`inline-flex min-h-10 shrink-0 items-center gap-2 border px-3 text-xs font-bold uppercase tracking-[.06em] transition ${active ? "border-[#171714] bg-[#171714] text-white" : "border-[#bbb5a9] bg-transparent text-[#555149] hover:border-[#171714]"}`}><Icon className="size-3.5" />{label}</Link>;
    })}</nav>
    <div className="wr-app-content">{children}</div>
  </div>;
}
