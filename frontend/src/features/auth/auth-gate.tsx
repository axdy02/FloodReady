"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { isProtectedState } from "@/features/auth/auth-machine";
import { sanitizeReturnPath } from "@/lib/security/return-path";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const state = useAuth();
  const pathname = usePathname();
  if (pathname === "/map") return <>{children}</>;
  if (isProtectedState(state)) return <>{children}</>;
  if (state.kind === "RESTORING") return <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-2xl place-items-center px-4"><section aria-live="polite" className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-950 shadow-sm"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">FloodReady</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Checking your session</h1><p className="mt-3 text-slate-600">We are confirming whether a signed-in session is available.</p></section></main>;
  const target = sanitizeReturnPath(pathname);
  const unavailable = state.kind === "SESSION_UNAVAILABLE";
  return <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-2xl place-items-center px-4"><section className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-950 shadow-sm"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Protected area</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Sign in to continue</h1><p className="mt-3 text-slate-600">{unavailable ? "The backend session service is not available right now. You can still return home and check the service status." : "This page contains account-specific reports and map details."}</p>{unavailable ? <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{state.message}</p> : null}<div className="mt-6 flex flex-wrap justify-center gap-3"><Link className="rounded-md bg-slate-950 px-4 py-2 font-semibold text-white" href={`/login?returnTo=${encodeURIComponent(target)}`}>Sign in</Link><Link className="rounded-md border border-slate-300 bg-slate-50 px-4 py-2 font-semibold !text-slate-800 hover:bg-slate-100" href={`/register?returnTo=${encodeURIComponent(target)}`}>Create account</Link><Link className="rounded-md bg-sky-50 px-4 py-2 font-semibold !text-sky-800 hover:bg-sky-100" href="/">Service status</Link></div></section></main>;
}
