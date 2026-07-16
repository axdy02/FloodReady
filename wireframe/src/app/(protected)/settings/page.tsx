"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, RefreshCw, Settings2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { authStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api/client";
import type { ServicesHealthDto } from "@/lib/api/contracts";

type ServiceStatus = ServicesHealthDto["backend"] | "checking";

const labels = {
  frontend: "Frontend",
  backend: "Backend",
  aiService: "AI Service",
} as const;

export default function SettingsPage() {
  const [status, setStatus] = useState<Record<keyof typeof labels, ServiceStatus>>({ frontend: "checking", backend: "checking", aiService: "checking" });
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkServices = useCallback(async () => {
    setStatus({ frontend: "checking", backend: "checking", aiService: "checking" });
    setError(null);
    const token = authStore.getAccessToken();
    if (token === undefined) {
      setStatus({ frontend: "ready", backend: "unavailable", aiService: "unavailable" });
      setError("Your session expired. Sign in again to check the services.");
      return;
    }
    try {
      const result = await api.services(token);
      setStatus({ frontend: "ready", backend: result.backend, aiService: result.aiService });
      setCheckedAt(result.checkedAt);
    } catch {
      setStatus({ frontend: "ready", backend: "unavailable", aiService: "unavailable" });
      setError("The service status check could not reach Backend 1.");
    }
  }, []);

  useEffect(() => { void checkServices(); }, [checkServices]);

  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <header className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">System settings</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-950">Settings</h1>
      <p className="mt-1 text-sm text-slate-600">Check whether the FloodReady services are available.</p>
    </header>
    <section aria-labelledby="service-status-heading" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="service-status-heading" className="flex items-center gap-2 text-lg font-semibold text-slate-950"><Settings2 className="size-5 text-slate-700" />Service status</h2><p className="mt-1 text-sm text-slate-600">Frontend is checked locally. Backend checks its API and AI Service readiness.</p></div>
        <button type="button" onClick={() => void checkServices()} disabled={Object.values(status).some((value) => value === "checking")} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw className={`size-4 ${Object.values(status).some((value) => value === "checking") ? "animate-spin" : ""}`} />Refresh</button>
      </div>
      {error !== null ? <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">{(Object.keys(labels) as Array<keyof typeof labels>).map((key) => <ServiceCard key={key} label={labels[key]} status={status[key]} />)}</div>
      <p className="mt-4 text-xs text-slate-500">{checkedAt === null ? "Checking now…" : `Last checked ${new Date(checkedAt).toLocaleString()}`}</p>
    </section>
  </main>;
}

function ServiceCard({ label, status }: { label: string; status: ServiceStatus }) {
  const checking = status === "checking";
  const ready = status === "ready";
  const Icon = checking ? LoaderCircle : ready ? CheckCircle2 : status === "degraded" ? CircleAlert : XCircle;
  const color = checking ? "text-slate-500" : ready ? "text-emerald-700" : status === "degraded" ? "text-amber-700" : "text-red-700";
  return <article className="rounded-md border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">{label}</h3><Icon className={`size-5 ${color} ${checking ? "animate-spin" : ""}`} aria-hidden="true" /></div><p className={`mt-2 text-sm font-medium ${color}`}>{checking ? "Checking…" : status === "ready" ? "Ready" : status === "degraded" ? "Degraded" : "Unavailable"}</p></article>;
}
