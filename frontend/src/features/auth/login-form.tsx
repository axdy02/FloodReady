"use client";

import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/features/auth/api";
import { authStore } from "@/features/auth/auth-store";
import { loginSchema } from "@/features/auth/schemas";
import { sanitizeReturnPath } from "@/lib/security/return-path";

const fieldClassName = "mt-2 min-h-12 w-full border border-[#171714] bg-[#fffdf7] px-4 py-3 text-[#171714] outline-none transition placeholder:text-[#9a9489] focus:border-[#f05a28] focus:ring-2 focus:ring-[#f05a28]";

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

  return <form noValidate onSubmit={(event) => void submit(event)} className="mt-7 grid gap-5"><div><label className="text-xs font-bold uppercase tracking-[.1em] text-[#34322d]" htmlFor="email">Email</label><input className={fieldClassName} id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div><div><label className="text-xs font-bold uppercase tracking-[.1em] text-[#34322d]" htmlFor="password">Password</label><input className={fieldClassName} id="password" name="password" type="password" autoComplete="current-password" aria-describedby="login-password-help" required /><p id="login-password-help" className="mt-2 text-xs text-[#777167]">Passwords are at least 12 characters.</p></div><Button className="mt-1 h-12 rounded-none border border-[#171714] bg-[#f05a28] text-sm font-bold uppercase tracking-[.08em] text-white hover:bg-[#171714]" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</Button>{error ? <p role="alert" className="border border-[#c83820] bg-[#fff0eb] px-4 py-3 text-sm leading-6 text-[#8d2818]">{error}</p> : null}</form>;
}
