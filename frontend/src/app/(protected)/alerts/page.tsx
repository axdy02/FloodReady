"use client";

import { BellRing, CheckCheck, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { demoAlerts, demoIncidents } from "@/data/demo/incidents";
import { useAppMode } from "@/features/app-mode/app-mode-context";
import { incidentToDisplayAlert, type DisplayAlert } from "@/features/app-mode/mode-data";
import { useIncidentsQuery } from "@/features/incidents/queries";

export default function AlertsPage() {
  const router = useRouter();
  const { mode } = useAppMode();
  const [filter, setFilter] = useState("All");
  const [term, setTerm] = useState("");
  const [read, setRead] = useState<string[]>([]);
  const liveIncidents = useIncidentsQuery(mode === "live" ? "?limit=100&sort=desc" : "");
  const demoSource: DisplayAlert[] = demoAlerts.map((alert) => ({ ...alert, level: alert.level as DisplayAlert["level"], address: demoIncidents.find((incident) => incident.id === alert.incidentId)?.address ?? "Gurugram, Haryana" }));
  const source = mode === "demo" ? demoSource : liveIncidents.data?.items.map(incidentToDisplayAlert) ?? [];
  const alerts = useMemo(() => source.filter((alert) => (filter === "All" || filter === "Nearby" || alert.level === filter) && `${alert.title} ${alert.detail} ${alert.address}`.toLowerCase().includes(term.toLowerCase())), [filter, source, term]);
  const liveNotice = liveIncidents.isLoading ? "Loading live alerts…" : liveIncidents.isError ? "Live alerts are unavailable. Demo alerts are not shown while Live is selected." : "Live alerts are derived from current incidents on the live map.";
  const openAlert = (alert: DisplayAlert) => { setRead((current) => current.includes(alert.id) ? current : [...current, alert.id]); router.push(`/map?incident=${alert.incidentId}`); };

  return <main className="mx-auto max-w-5xl px-5 py-10">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold tracking-[.18em] text-blue-400">NOTIFICATION CENTER · {mode.toUpperCase()} DATA</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Alerts</h1><p className="mt-2 text-sm text-zinc-500">{mode === "demo" ? `Alerts generated from the same ${demoIncidents.length} demo reports.` : "Alerts generated from incidents returned by the live map service."}</p></div><button onClick={() => setRead(source.map((alert) => alert.id))} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/[.04]"><CheckCheck className="size-4" />Mark all read</button></div>
    {mode === "live" ? <p className="mt-5 rounded-xl border border-blue-400/15 bg-blue-500/[.06] px-3 py-2 text-xs text-blue-200">{liveNotice}</p> : null}
    <div className="mt-8 flex flex-wrap gap-2"><label className="flex min-w-52 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3"><Search className="size-4 text-zinc-500" /><input value={term} onChange={(event) => setTerm(event.target.value)} aria-label="Search alerts" placeholder="Search alerts" className="w-full bg-transparent py-2.5 text-sm outline-none" /></label>{["All", "Critical", "Nearby", "Resolved"].map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-xl px-3 py-2 text-xs ${filter === item ? "bg-white text-zinc-950" : "border border-white/10 text-zinc-400 hover:bg-white/[.04]"}`}>{item}</button>)}</div>
    <section className="mt-4 overflow-hidden rounded-2xl border border-white/[.08]">{alerts.map((alert) => <button onClick={() => openAlert(alert)} className={`flex w-full gap-4 border-b border-white/[.06] p-5 text-left last:border-0 hover:bg-white/[.03] ${read.includes(alert.id) ? "opacity-55" : ""}`} key={alert.id}><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${alert.level === "Critical" ? "bg-red-500/15 text-red-400" : alert.level === "Resolved" ? "bg-emerald-400/15 text-emerald-400" : "bg-amber-400/15 text-amber-300"}`}>{alert.level === "Resolved" ? <CheckCheck className="size-4" /> : <TriangleAlert className="size-4" />}</span><span className="min-w-0 flex-1"><span className="flex justify-between gap-4"><span className="text-sm font-semibold">{alert.title}</span><span className="whitespace-nowrap text-xs text-zinc-600">{new Date(alert.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></span><span className="mt-1 block text-sm text-zinc-500">{alert.detail}</span><span className="mt-3 flex items-center gap-1 text-xs text-blue-300"><BellRing className="size-3" />{alert.level} · {alert.address}</span></span></button>)}{alerts.length === 0 ? <p className="p-8 text-center text-sm text-zinc-500">{mode === "live" && liveIncidents.isLoading ? "Loading alerts…" : "No alerts match this filter."}</p> : null}</section>
  </main>;
}
