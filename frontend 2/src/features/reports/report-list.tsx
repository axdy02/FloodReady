"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppMode } from "@/features/app-mode/app-mode-context";
import { demoDisplayReports, demoMapIncidents, toLiveDisplayReport, type DisplayReport } from "@/features/app-mode/mode-data";
import { useIncidentsQuery } from "@/features/incidents/queries";
import { type MapLayerState, MapCanvas } from "@/features/map/map-canvas";
import { useOwnReportsQuery } from "@/features/reports/queries";
import { loadClientEnvironment } from "@/lib/env/client";
import { BlurText } from "@/components/motion/blur-text";
import { Counter } from "@/components/motion/counter";
import { Reveal } from "@/components/motion/reveal";

const mapLayers: MapLayerState = { roads: true, markers: true, heatmap: false, shelters: false, weather: false, traffic: false };

export function ReportList() {
  const env = loadClientEnvironment();
  const { mode } = useAppMode();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("All severities");
  const [status, setStatus] = useState("All statuses");
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<DisplayReport | null>(null);
  const liveReports = useOwnReportsQuery("", null);
  const liveIncidents = useIncidentsQuery(mode === "live" ? "?limit=100&sort=desc" : "");
  const sourceReports = mode === "demo" ? demoDisplayReports : liveReports.data?.items.map(toLiveDisplayReport) ?? [];
  const records = useMemo(
    () => sourceReports.filter((record) => {
      const matchesTerm = `${record.title} ${record.address} ${record.reporter}`.toLowerCase().includes(query.toLowerCase());
      const matchesSeverity = severity === "All severities" || record.severity === severity;
      const matchesStatus = status === "All statuses" || record.status === status;
      return matchesTerm && matchesSeverity && matchesStatus;
    }),
    [query, severity, sourceReports, status],
  );
  const mapRecords = mode === "demo" ? demoMapIncidents.filter((incident) => records.some((record) => record.id === incident.id)) : liveIncidents.data?.items ?? [];
  const liveNotice = liveReports.isLoading ? "Loading your live reports…" : liveReports.isError ? "Live reports are unavailable. Demo reports are not shown while Live is selected." : "Live mode is active. Only reports from your connected account are shown.";

  return <main className="mx-auto max-w-7xl px-5 py-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold tracking-[.18em] text-blue-400">INCIDENT MANAGEMENT · {mode.toUpperCase()} DATA</p>
        <BlurText as="h1" text="Reports" delay={140} className="mt-2 text-3xl font-semibold tracking-[-.04em]" />
        <p className="mt-2 text-sm text-zinc-500">{mode === "demo" ? `${demoDisplayReports.length} connected demo reports used throughout FloodReady.` : "Reports submitted from your connected live account."}</p>
      </div>
      <Link href="/reports/new" className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white">+ New report</Link>
    </div>
    {mode === "live" ? <p className="mt-5 rounded-xl border border-blue-400/15 bg-blue-500/[.06] px-3 py-2 text-xs text-blue-200">{liveNotice}</p> : null}
    <Reveal className="mt-5"><section className="rounded-2xl border border-white/[.08] bg-white/[.02] p-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-white/[.08] bg-black/20 px-3"><Search className="size-4 text-zinc-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search reports" placeholder="Search reports" className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-zinc-600" /></label>
        <Filter value={severity} onChange={setSeverity} options={["All severities", "CRITICAL", "HIGH", "MODERATE", "LOW", "IMPASSABLE", "SEVERE", "MINOR"]} />
        <Filter value={status} onChange={setStatus} options={["All statuses", "PENDING", "PENDING_REVIEW", "VERIFIED", "REJECTED", "RESOLVED", "SUBMITTED", "PROVISIONAL", "DISPUTED", "STALE"]} />
        <div className="flex rounded-xl border border-white/[.08] p-1"><button onClick={() => setView("list")} className={`rounded-lg px-3 py-1.5 text-xs ${view === "list" ? "bg-white text-zinc-950" : "text-zinc-500"}`}>List</button><button onClick={() => setView("map")} className={`rounded-lg px-3 py-1.5 text-xs ${view === "map" ? "bg-white text-zinc-950" : "text-zinc-500"}`}>Map</button></div>
      </div>
    </section></Reveal>
    {view === "map" ? <Reveal className="mt-4"><section className="relative h-[38rem] overflow-hidden rounded-2xl border border-white/[.08]"><MapCanvas viewport={{ latitude: env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE, longitude: env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE, zoom: env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM }} attribution={env.NEXT_PUBLIC_MAP_ATTRIBUTION} styleUrl={env.NEXT_PUBLIC_MAP_STYLE_URL} incidents={mapRecords} layers={mapLayers} selectedIncidentId={selected?.id} onIncidentSelect={(id) => setSelected(records.find((record) => record.id === id) ?? null)} /></section></Reveal> : <ReportTable records={records} onSelect={setSelected} />}
    <p className="mt-4 flex items-center gap-1 text-xs text-zinc-500">Showing <Counter value={records.length} fontSize={13} /> {mode === "demo" ? "demo" : "live"} report{records.length === 1 ? "" : "s"}.</p>
    {selected ? <Detail record={selected} onClose={() => setSelected(null)} /> : null}
  </main>;
}

function ReportTable({ records, onSelect }: { records: readonly DisplayReport[]; onSelect: (record: DisplayReport) => void }) {
  return <section className="mt-4 overflow-x-auto rounded-2xl border border-white/[.08]"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-white/[.025] text-[10px] uppercase tracking-[.13em] text-zinc-500"><tr>{["Incident", "Location", "Type", "Severity", "Status", "Reporter", "Trust", "Submitted", ""].map((heading) => <th className="px-4 py-3 font-medium" key={heading}>{heading}</th>)}</tr></thead><tbody>{records.map((record) => <tr key={record.id} onClick={() => onSelect(record)} className="cursor-pointer border-t border-white/[.06] hover:bg-white/[.03]"><td className="px-4 py-3"><span className="flex items-center gap-3"><i className={`block size-8 rounded-lg ${record.tone === "red" ? "bg-red-500/25" : record.tone === "orange" ? "bg-orange-400/25" : "bg-amber-400/25"}`} /><span className="font-medium">{record.title}</span></span></td><td className="px-4 py-3 text-zinc-400">{record.address}</td><td className="px-4 py-3 text-zinc-400">{record.category.replaceAll("_", " ")}</td><td className="px-4 py-3"><Badge value={record.severity} /></td><td className="px-4 py-3"><Badge value={record.status} /></td><td className="px-4 py-3 text-zinc-400">{record.reporter}</td><td className="px-4 py-3 text-zinc-400">{record.trustScore ?? "—"}</td><td className="px-4 py-3 text-zinc-500">{new Date(record.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td><td className="px-4 py-3 text-blue-300">Open</td></tr>)}{records.length === 0 ? <tr><td colSpan={9} className="px-4 py-12 text-center text-zinc-500">No reports match these filters.</td></tr> : null}</tbody></table></section>;
}

function Filter({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-white/[.08] bg-[#111113] px-3 text-xs">{options.map((option) => <option key={option}>{option}</option>)}</select>; }
function Badge({ value }: { value: string }) { const color = value === "CRITICAL" || value === "HIGH" || value === "IMPASSABLE" || value === "SEVERE" || value === "PENDING" ? "bg-red-500/15 text-red-300" : value === "MODERATE" ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/15 text-emerald-300"; return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${color}`}>{value.toLowerCase().replaceAll("_", " ")}</span>; }
function Detail({ record, onClose }: { record: DisplayReport; onClose: () => void }) { return <div role="dialog" aria-modal="true" aria-label="Report details" className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4"><section className="surface-card w-full max-w-xl rounded-2xl p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[.16em] text-blue-400">REPORT DETAILS</p><h2 className="mt-2 text-xl font-semibold">{record.title}</h2></div><button aria-label="Close details" onClick={onClose}><X className="size-5 text-zinc-400" /></button></div><p className="mt-4 text-sm leading-6 text-zinc-400">{record.description}</p><div className="mt-5 grid grid-cols-2 gap-3 text-xs"><Info label="Location" value={record.address} /><Info label="Reporter" value={record.trustScore === null ? record.reporter : `${record.reporter} · Trust ${record.trustScore}`} /><Info label="Category" value={record.category.replaceAll("_", " ")} /><Info label="Status" value={record.status} /></div><div className="mt-6 flex gap-3"><Link href={`/map?incident=${record.id}`} className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold">Open on map</Link><button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm">Close</button></div></section></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/[.06] bg-black/10 p-3"><p className="text-zinc-600">{label}</p><p className="mt-1 text-zinc-300">{value}</p></div>; }
