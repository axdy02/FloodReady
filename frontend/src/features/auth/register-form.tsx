"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/features/auth/api";
import { registerSchema } from "@/features/auth/schemas";

const fieldClassName = "mt-2 min-h-12 w-full border border-[#171714] bg-[#fffdf7] px-4 py-3 text-[#171714] outline-none transition placeholder:text-[#9a9489] focus:border-[#f05a28] focus:ring-2 focus:ring-[#f05a28]";

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

  return <form noValidate onSubmit={(event) => void submit(event)} className="mt-7 grid gap-5"><div><label className="text-xs font-bold uppercase tracking-[.1em] text-[#34322d]" htmlFor="name">Name</label><input className={fieldClassName} id="name" name="name" autoComplete="name" placeholder="Your name" required /></div><div><label className="text-xs font-bold uppercase tracking-[.1em] text-[#34322d]" htmlFor="register-email">Email</label><input className={fieldClassName} id="register-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div><div><label className="text-xs font-bold uppercase tracking-[.1em] text-[#34322d]" htmlFor="register-password">Password</label><input className={fieldClassName} id="register-password" name="password" type="password" autoComplete="new-password" aria-describedby="password-help" required /><p id="password-help" className="mt-2 text-xs text-[#777167]">Use 12–128 characters.</p></div><Button className="mt-1 h-12 rounded-none border border-[#171714] bg-[#f05a28] text-sm font-bold uppercase tracking-[.08em] text-white hover:bg-[#171714]" type="submit" disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</Button>{error ? <p role="alert" className="border border-[#c83820] bg-[#fff0eb] px-4 py-3 text-sm leading-6 text-[#8d2818]">{error}</p> : null}</form>;
}
