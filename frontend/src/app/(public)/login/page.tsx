import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/app-shell/brand-mark";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return <main className="grid min-h-[calc(100vh-4.75rem)] place-items-center bg-[#f4efe5] px-5 py-10 sm:px-8"><section className="grid w-full max-w-5xl border border-[#171714] bg-[#fffdf7] lg:grid-cols-[.82fr_1.18fr]"><div className="flex min-h-72 flex-col bg-[#171714] p-7 text-white sm:p-10"><BrandMark inverse /><div className="mt-auto pt-16"><ShieldCheck className="size-7 text-[#ff7a45]" /><p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-white/45">Secure report workspace</p><h1 className="mt-3 text-4xl font-black uppercase leading-[.9] tracking-[-.06em] sm:text-5xl">Welcome<br />back.</h1><p className="mt-5 max-w-sm text-sm leading-6 text-white/55">Sign in to review your reports, monitor validation, and scan the shared map.</p></div></div><div className="p-7 sm:p-10"><p className="font-mono text-xs font-bold text-[#f05a28]">WR / SIGN IN</p><h2 className="mt-3 text-2xl font-black uppercase tracking-[-.04em]">Access your radar</h2><LoginForm /><p className="mt-6 border-t border-[#171714]/20 pt-5 text-sm text-[#656158]">New to WaterRadar? <Link className="font-bold text-[#006b65] underline decoration-2 underline-offset-4" href="/register">Create an account</Link></p></div></section></main>;
}
