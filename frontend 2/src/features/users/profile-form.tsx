"use client";

import { useState } from "react";
import { authStore } from "@/features/auth/auth-store";
import { usersApi } from "@/features/users/api";
import { profileSchema } from "@/features/users/schemas";

export function ProfileForm() {
  const state = authStore.getState(); const initial = state.kind === "AUTHENTICATED" ? state.user.name : ""; const [name, setName] = useState(initial); const [message, setMessage] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const parsed = profileSchema.safeParse({ name }); if (!parsed.success) { setMessage("Enter a valid name."); return; } const token = authStore.getAccessToken(); if (token === undefined) return; try { const user = await usersApi.updateMe(JSON.stringify(parsed.data), token); authStore.updateUser(user); setMessage("Profile updated."); } catch (error) { void error; setMessage("Unable to update profile."); } }
  return <form onSubmit={submit} className="grid gap-4"><label htmlFor="profile-name">Name</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /><button type="submit">Save name</button>{message ? <p role="status">{message}</p> : null}</form>;
}
