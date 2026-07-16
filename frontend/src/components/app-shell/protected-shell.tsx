"use client";

import Link from "next/link";
import { Bookmark, ClipboardList, ClipboardPlus, LayoutDashboard, LogOut, MapPinned, Sparkles, Waves } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
  return <div className="min-h-screen bg-[radial-gradient(circle_at_100%_0%,rgba(37,99,235,.11),transparent_28rem),#09090b] text-zinc-50 lg:pl-72">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 p-4 lg:block">
      <div className="flex h-full flex-col rounded-[1.75rem] border border-white/[.08] bg-[#101014]/85 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <Link href="/dashboard" className="flex items-center gap-2 rounded-2xl px-3 py-3 font-semibold"><span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 text-[#07101e] shadow-[0_8px_20px_rgba(34,211,238,.16)]"><Waves className="size-4" /></span>FloodReady <span className="text-[10px] text-zinc-500">LIVE</span></Link>
      <p className="mt-8 px-3 text-[10px] font-semibold tracking-[.16em] text-zinc-600">WORKSPACE</p>
      <nav aria-label="Main navigation" className="mt-3 space-y-1">{items.map(([label, href, Icon]) => { const active = isNavActive(pathname, href); return <Link key={href} href={href} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${active ? "bg-blue-500 text-white shadow-[0_10px_24px_rgba(37,99,235,.22)]" : "text-zinc-400 hover:bg-white/[.055] hover:text-zinc-100"}`}><span className={`grid size-7 place-items-center rounded-lg transition ${active ? "bg-white/15" : "bg-white/[.04] group-hover:bg-white/[.08]"}`}><Icon className="size-4" /></span>{label}</Link>; })}</nav>
      <div className="mt-auto rounded-2xl border border-white/[.07] bg-white/[.025] p-3 text-xs leading-5 text-zinc-500"><span className="mr-2 inline-block size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />Your report workspace</div>
      </div>
    </aside>
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-white/[.06] bg-[#09090b]/80 px-5 backdrop-blur-xl"><Link href="/dashboard" className="flex items-center gap-2 font-semibold lg:hidden"><span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 text-[#07101e]"><Waves className="size-4" /></span>FloodReady</Link><div className="ml-auto flex items-center gap-2"><Link href="/reports/new" className="rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(239,68,68,.16)] lg:hidden">Submit a Report</Link><button type="button" onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.025] px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/[.07]"><LogOut className="size-4" />Sign out</button></div></header>
    <nav aria-label="Mobile navigation" className="sticky top-16 z-20 flex gap-2 overflow-x-auto border-b border-white/[.06] bg-[#09090b]/90 px-4 py-2 backdrop-blur-xl lg:hidden">{items.map(([label, href, Icon]) => {
      const active = isNavActive(pathname, href);
      return <Link key={href} href={href} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${active ? "bg-blue-500 text-white shadow-[0_8px_20px_rgba(37,99,235,.2)]" : "border border-white/[.08] bg-white/[.025] text-zinc-300 hover:bg-white/[.07]"}`}><Icon className="size-3.5" />{label}</Link>;
    })}</nav>
    <div>{children}</div>
  </div>;
}
