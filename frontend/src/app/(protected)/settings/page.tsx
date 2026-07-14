"use client";

import { Bell, CheckCircle2, Globe2, LoaderCircle, LockKeyhole, Moon, RefreshCw, Server, XCircle } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { BlurText } from "@/components/motion/blur-text";
import { Reveal } from "@/components/motion/reveal";

type ServiceStatus = "idle" | "checking" | "online" | "offline";

export default function SettingsPage() {
  return <main className="mx-auto max-w-4xl px-5 py-10">
    <p className="text-xs font-semibold tracking-[.18em] text-blue-400">PREFERENCES</p>
    <BlurText as="h1" text="Settings" delay={140} className="mt-2 text-3xl font-semibold tracking-[-.04em]" />
    <p className="mt-2 text-sm text-zinc-500">Control how FloodReady communicates with you and protects your account.</p>
    <div className="mt-8 space-y-3">
      <Reveal><ConnectionCheck /></Reveal>
      <Setting icon={<Bell className="size-5" />} title="Notifications" text="Critical nearby incidents, route changes, and verification updates." control={<button className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white">Enabled</button>} />
      <Setting icon={<Moon className="size-5" />} title="Appearance" text="FloodReady uses a dark map interface optimized for night-time visibility." control={<select className="rounded-lg border border-white/10 bg-[#111113] px-3 py-1.5 text-xs"><option>Dark</option><option>System</option></select>} />
      <Setting icon={<Globe2 className="size-5" />} title="Language" text="Choose the language used for alerts and navigation guidance." control={<select className="rounded-lg border border-white/10 bg-[#111113] px-3 py-1.5 text-xs"><option>English</option><option>Hindi</option></select>} />
      <Setting icon={<LockKeyhole className="size-5" />} title="Privacy and security" text="Manage your profile visibility, password, and active sessions." control={<button className="text-xs font-semibold text-blue-300">Manage</button>} />
    </div>
  </main>;
}

function ConnectionCheck() {
  const [frontend, setFrontend] = useState<ServiceStatus>("idle");
  const [backend, setBackend] = useState<ServiceStatus>("idle");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  async function checkFrontend(): Promise<void> {
    const response = await fetch("/api/health", { cache: "no-store" });
    const data: unknown = await response.json();
    if (!response.ok || typeof data !== "object" || data === null || !("status" in data) || data.status !== "ok") throw new Error("Frontend health check failed");
  }

  async function refreshConnection(): Promise<void> {
    setFrontend("checking");
    setBackend("checking");
    const [frontendResult, backendResult] = await Promise.allSettled([checkFrontend(), api.ready()]);
    setFrontend(frontendResult.status === "fulfilled" ? "online" : "offline");
    setBackend(backendResult.status === "fulfilled" ? "online" : "offline");
    setCheckedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }));
  }

  const checking = frontend === "checking" || backend === "checking";
  return <section className="surface-card rounded-2xl p-5" aria-labelledby="connection-title">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><Server className="size-5" /></span><div><h2 id="connection-title" className="text-sm font-semibold">System connection</h2><p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">Check that this frontend and the configured backend are responding. Refreshing checks only these services; it does not reload the page.</p></div></div><button type="button" onClick={() => void refreshConnection()} disabled={checking} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-xs font-semibold hover:bg-white/[.08] disabled:cursor-wait disabled:opacity-60"><RefreshCw className={`size-3.5 ${checking ? "animate-spin" : ""}`} />{checking ? "Checking…" : "Refresh status"}</button></div>
    <div className="mt-5 grid gap-2 sm:grid-cols-2" aria-live="polite"><StatusRow label="Frontend" detail="Local FloodReady application" status={frontend} /><StatusRow label="Backend" detail="API readiness connection" status={backend} /></div>
    <p className="mt-4 text-[11px] text-zinc-600">{checkedAt === null ? "Status has not been checked yet." : `Last checked at ${checkedAt}.`}</p>
  </section>;
}

function StatusRow({ label, detail, status }: { label: string; detail: string; status: ServiceStatus }) {
  const online = status === "online";
  const checking = status === "checking";
  const labelText = status === "idle" ? "Not checked" : checking ? "Checking" : online ? "Connected" : "Unavailable";
  return <div className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-black/10 p-3"><span className={`grid size-8 place-items-center rounded-lg ${online ? "bg-emerald-400/10 text-emerald-300" : status === "offline" ? "bg-red-500/10 text-red-300" : "bg-white/[.05] text-zinc-400"}`}>{checking ? <LoaderCircle className="size-4 animate-spin" /> : online ? <CheckCircle2 className="size-4" /> : status === "offline" ? <XCircle className="size-4" /> : <Server className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{label}</span><span className="mt-0.5 block text-[11px] text-zinc-500">{detail}</span></span><span className={`text-[11px] font-medium ${online ? "text-emerald-300" : status === "offline" ? "text-red-300" : "text-zinc-500"}`}>{labelText}</span></div>;
}

function Setting({ icon, title, text, control }: { icon: React.ReactNode; title: string; text: string; control: React.ReactNode }) {
  return <Reveal><section className="surface-card flex flex-wrap items-center gap-4 rounded-2xl p-5"><span className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-300">{icon}</span><div className="min-w-48 flex-1"><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-zinc-500">{text}</p></div>{control}</section></Reveal>;
}
