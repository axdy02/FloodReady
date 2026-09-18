import Link from "next/link";
import { Camera } from "lucide-react";
import { BrandMark } from "@/components/app-shell/brand-mark";
import { RegisterForm } from "@/features/auth/register-form";

export default function RegisterPage() {
  return <main className="grid min-h-[calc(100vh-4.75rem)] place-items-center bg-[#f4efe5] px-5 py-10 sm:px-8"><section className="grid w-full max-w-5xl border border-[#171714] bg-[#fffdf7] lg:grid-cols-[.82fr_1.18fr]"><div className="flex min-h-72 flex-col bg-[#006b65] p-7 text-white sm:p-10"><BrandMark inverse /><div className="mt-auto pt-16"><Camera className="size-7 text-[#ffd36a]" /><p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-white/55">Join the signal network</p><h1 className="mt-3 text-4xl font-black uppercase leading-[.9] tracking-[-.06em] sm:text-5xl">See it.<br />Report it.</h1><p className="mt-5 max-w-sm text-sm leading-6 text-white/65">Create an account to submit observations and follow each report through validation.</p></div></div><div className="p-7 sm:p-10"><p className="font-mono text-xs font-bold text-[#f05a28]">WR / REGISTER</p><h2 className="mt-3 text-2xl font-black uppercase tracking-[-.04em]">Create your account</h2><RegisterForm /><p className="mt-6 border-t border-[#171714]/20 pt-5 text-sm text-[#656158]">Already have an account? <Link className="font-bold text-[#006b65] underline decoration-2 underline-offset-4" href="/login">Sign in</Link></p></div></section></main>;
}
