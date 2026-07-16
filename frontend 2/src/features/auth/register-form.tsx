"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/features/auth/api";
import { registerSchema } from "@/features/auth/schemas";

const fieldClassName = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-800 focus:ring-4 focus:ring-blue-100";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setError("Enter a name (2–100 characters), a valid email address, and a password with at least 12 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.register(JSON.stringify(parsed.data));
      router.replace("/login?registered=1");
    } catch {
      setError("Unable to create an account. Check that the backend is running, then try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <form noValidate onSubmit={(event) => void submit(event)} className="mt-7 grid gap-5"><div><label className="text-sm font-semibold text-slate-800" htmlFor="name">Name</label><input className={fieldClassName} id="name" name="name" autoComplete="name" placeholder="Your name" required /></div><div><label className="text-sm font-semibold text-slate-800" htmlFor="register-email">Email</label><input className={fieldClassName} id="register-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div><div><label className="text-sm font-semibold text-slate-800" htmlFor="register-password">Password</label><input className={fieldClassName} id="register-password" name="password" type="password" autoComplete="new-password" aria-describedby="password-help" required /><p id="password-help" className="mt-2 text-sm text-slate-500">Use 12–128 characters.</p></div><Button className="mt-1 h-12 rounded-xl bg-[#0b2d58] text-base hover:bg-[#071f42]" type="submit" disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</Button>{error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">{error}</p> : null}</form>;
}
