"use client";

import Link from "next/link";
import { ClipboardList, ClipboardPlus, LayoutDashboard, LogOut, MapPinned, Settings, Waves } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { logout } from "@/features/auth/auth-context";

const items = [
  { label: "Dashboard", mobileLabel: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Map", mobileLabel: "Map", href: "/map", icon: MapPinned },
  { label: "Reports", mobileLabel: "Reports", href: "/reports", icon: ClipboardList },
  { label: "Submit a Report", mobileLabel: "Submit", href: "/reports/new", icon: ClipboardPlus },
] as const;

export function ProtectedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return <div className="min-h-screen bg-slate-50 text-slate-950">
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
        <Link href="/map" className="mr-auto flex items-center gap-2 font-semibold"><span className="grid size-8 place-items-center rounded-md bg-slate-950 text-white"><Waves className="size-4" /></span><span>FloodReady</span></Link>
        <nav aria-label="Milestone 2 navigation" className="order-3 flex w-full gap-2 sm:order-none sm:w-auto">{items.map(({ label, mobileLabel, href, icon: Icon }) => { const active = pathname === href; return <Link key={href} href={href} aria-label={label} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium sm:flex-none ${active ? "bg-slate-950 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}><Icon className="size-4" aria-hidden="true" /><span aria-hidden="true" className="lg:hidden">{mobileLabel}</span><span aria-hidden="true" className="hidden lg:inline">{label}</span></Link>; })}</nav>
        <Link href="/settings" aria-label="Settings" aria-current={pathname === "/settings" ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-2 rounded-md px-2 py-2 text-sm ${pathname === "/settings" ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-100"}`}><Settings className="size-4" /><span className="hidden sm:inline">Settings</span></Link><button type="button" onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-600 hover:bg-slate-100"><LogOut className="size-4" /><span className="hidden sm:inline">Sign out</span></button>
      </div>
    </header>
    {children}
  </div>;
}
