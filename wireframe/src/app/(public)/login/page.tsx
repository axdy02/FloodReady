import Link from "next/link";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 py-10"><section className="w-full max-w-md overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl shadow-blue-950/15"><div className="bg-[linear-gradient(135deg,_#071a36,_#0b396d)] px-7 py-8 text-white"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">FloodReady</p><h1 className="mt-3 text-3xl font-bold">Welcome back</h1><p className="mt-2 text-blue-100">Sign in to view your reports and profile.</p></div><div className="p-7"><LoginForm /><p className="mt-6 text-center text-sm text-slate-600">New to FloodReady? <Link className="font-semibold text-blue-800 hover:underline" href="/register">Create an account</Link></p></div></section></main>;
}
