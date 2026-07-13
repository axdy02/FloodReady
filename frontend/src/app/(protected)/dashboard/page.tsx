"use client";
import { useAuth, logout } from "@/features/auth/auth-context";
import { DashboardView } from "@/features/dashboard/dashboard-view";
export default function DashboardPage() { const state = useAuth(); if (state.kind !== "AUTHENTICATED" && state.kind !== "REFRESHING") return null; return <><div className="absolute right-5 top-[4.75rem] z-10 text-xs text-zinc-500">Welcome, {state.user.name} · <button className="hover:text-white" onClick={() => void logout()} type="button">Sign out</button></div><DashboardView /></>; }
