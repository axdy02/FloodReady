"use client";

import Link from "next/link";
import { Bell, ChevronDown, LayoutDashboard, Map, Route, Search, Settings, UserRound, Waves } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { demoIncidents } from "@/data/demo/incidents";
import { useAppMode } from "@/features/app-mode/app-mode-context";

const items = [["Dashboard", "/dashboard", LayoutDashboard], ["Live Flood Map", "/map", Map], ["Report Incident", "/reports/new", Waves], ["Reports", "/reports", Search], ["Alerts", "/alerts", Bell], ["Route Planner", "/route-planner", Route], ["Community", "/community", UserRound], ["Profile", "/profile", UserRound], ["Settings", "/settings", Settings]] as const;

export function ProtectedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { mode, setMode } = useAppMode();
  return <div className="min-h-screen bg-[#09090b] text-zinc-50 lg:pl-60">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-white/[.06] bg-[#0c0c0f] p-3 lg:flex lg:flex-col">
      <Link href="/dashboard" className="flex items-center gap-2 px-2 py-2 font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-blue-500"><Waves className="size-4" /></span>FloodReady <span className="text-[10px] text-zinc-500">LIVE</span></Link>
      <button className="mt-5 flex items-center justify-between rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2.5 text-xs text-zinc-300">Gurugram, Haryana <ChevronDown className="size-3" /></button>
      <nav className="mt-5 space-y-1">{items.map(([label, href, Icon]) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`)) ? "bg-white/[.08] font-medium text-white" : "text-zinc-500 hover:bg-white/[.04] hover:text-zinc-200"}`}><Icon className="size-4" />{label}</Link>)}</nav>
      <div className="mt-auto rounded-xl border border-white/[.07] bg-white/[.025] p-3 text-xs"><p className="flex items-center gap-2 font-medium"><i className="size-2 rounded-full bg-emerald-400" />{mode === "demo" ? "Demo data" : "Live"}</p><p className="mt-2 leading-5 text-zinc-500">{mode === "demo" ? `${demoIncidents.length} demo reports` : "Live reports updating"}<br />Heavy rainfall · 28°C</p></div>
    </aside>
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/[.06] bg-[#09090b]/90 px-5 backdrop-blur-xl"><div className="hidden max-w-md flex-1 items-center gap-2 rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-2 text-sm text-zinc-500 md:flex"><Search className="size-4" />Search roads, areas, incidents...</div><div className="ml-auto flex items-center gap-4"><div className="flex rounded-lg border border-white/[.08] bg-white/[.025] p-0.5 text-[10px]"><button onClick={() => setMode("live")} className={`rounded-md px-2.5 py-1.5 font-semibold ${mode === "live" ? "bg-blue-500 text-white" : "text-zinc-500"}`}>LIVE</button><button onClick={() => setMode("demo")} className={`rounded-md px-2.5 py-1.5 font-semibold ${mode === "demo" ? "bg-blue-500 text-white" : "text-zinc-500"}`}>DEMO</button></div><button aria-label="Notifications" className="relative text-zinc-300"><Bell className="size-5" /><i className="absolute -right-1 -top-1 size-2 rounded-full bg-red-500" /></button><button aria-label="Profile menu" className="grid size-8 place-items-center rounded-full bg-zinc-700"><UserRound className="size-4" /></button></div></header>
    <div>{children}</div>
  </div>;
}
