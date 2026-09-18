"use client";

import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/features/auth/api";
import { authStore } from "@/features/auth/auth-store";
import { loginSchema } from "@/features/auth/schemas";
import { sanitizeReturnPath } from "@/lib/security/return-path";

const fieldClassName = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-800 focus:ring-4 focus:ring-blue-100";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setError("Enter a valid email address and a password with at least 12 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const auth = await authApi.login(JSON.stringify(parsed.data));
      authStore.setSession(auth.accessToken, auth.user, auth.expiresInSeconds);
      router.replace(sanitizeReturnPath(params.get("returnTo")));
    } catch {
      setError("Unable to sign in. Check your email and password, and make sure the backend is running.");
    } finally {
      setSubmitting(false);
    }
  }

  return <form noValidate onSubmit={(event) => void submit(event)} className="mt-7 grid gap-5"><div><label className="text-sm font-semibold text-slate-800" htmlFor="email">Email</label><input className={fieldClassName} id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div><div><label className="text-sm font-semibold text-slate-800" htmlFor="password">Password</label><input className={fieldClassName} id="password" name="password" type="password" autoComplete="current-password" aria-describedby="login-password-help" required /><p id="login-password-help" className="mt-2 text-sm text-slate-500">Passwords are at least 12 characters.</p></div><Button className="mt-1 h-12 rounded-xl bg-[#0b2d58] text-base hover:bg-[#071f42]" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</Button>{error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">{error}</p> : null}</form>;
}
