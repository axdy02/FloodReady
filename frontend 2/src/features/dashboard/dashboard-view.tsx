"use client";

import Link from "next/link";
import { Activity, ArrowUpRight, MapPinned, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { BlurText } from "@/components/motion/blur-text";
import { Counter } from "@/components/motion/counter";
import { Reveal } from "@/components/motion/reveal";
import { useAppMode } from "@/features/app-mode/app-mode-context";
import { demoAverageConfidence, demoContributors, demoDisplayReports, demoMapIncidents } from "@/features/app-mode/mode-data";
import { useDashboardQueries } from "@/features/dashboard/queries";
import { demoPreviewRoadPaths } from "@/features/map/demo-preview-incidents";
import { MapCanvas, type MapLayerState } from "@/features/map/map-canvas";
import { loadClientEnvironment } from "@/lib/env/client";

const mapLayers: MapLayerState = { roads: true, markers: true, heatmap: false, shelters: false, weather: false, traffic: false };

export function DashboardView() {
  const env = loadClientEnvironment();
  const { mode } = useAppMode();
  const { reports, incidents } = useDashboardQueries();
  const demo = mode === "demo";
  const active = demo ? demoMapIncidents.length : incidents.data?.totalCount ?? 0;
  const submitted = demo ? demoDisplayReports.length : reports.data?.totalCount ?? 0;
  const contributors = demo ? demoContributors : null;
  const mapData = demo ? demoMapIncidents : incidents.data?.items ?? [];

  return <main className="mx-auto max-w-7xl px-5 py-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold tracking-[.18em] text-blue-400">OVERVIEW · {demo ? "DEMO DATA" : "LIVE DATA"}</p><BlurText as="h1" text="City pulse" delay={140} className="mt-2 text-3xl font-semibold" /><p className="mt-2 text-sm text-zinc-500">{demo ? `${demoDisplayReports.length} connected demo reports around Gurugram.` : "Current reports from the live service."}</p></div>
      <div className="flex gap-2"><Link href="/reports/new" className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white">Report flooding</Link><Link href="/map" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold">View live map</Link></div>
    </div>
    <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<TriangleAlert />} value={active} label="Active incidents" tone="text-red-400" /><Metric icon={<Activity />} value={submitted} label="Reports this week" tone="text-amber-300" /><Metric icon={<ShieldCheck />} value={demo ? demoAverageConfidence : null} suffix="%" label="AI confidence" tone="text-emerald-400" /><Metric icon={<Users />} value={contributors} label="People contributing" tone="text-blue-400" /></section>
    <Reveal className="mt-3"><section className="relative h-[28rem] overflow-hidden rounded-2xl border border-white/[.08]"><div className="absolute left-5 top-5 z-10 rounded-xl border border-white/10 bg-[#111113]/90 px-4 py-3 backdrop-blur"><p className="text-sm font-semibold">Flood map</p><p className="mt-1 text-xs text-zinc-500">{demo ? `${demoMapIncidents.length} demo incidents` : `${active} live incidents`}</p></div><MapCanvas viewport={{ latitude: env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE, longitude: env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE, zoom: env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM }} attribution={env.NEXT_PUBLIC_MAP_ATTRIBUTION} styleUrl={env.NEXT_PUBLIC_MAP_STYLE_URL} incidents={mapData} roadPaths={demo ? demoPreviewRoadPaths : {}} layers={mapLayers} /></section></Reveal>
    <section className="mt-3 grid gap-3 lg:grid-cols-2"><Feed title="Recent reports" rows={demo ? demoDisplayReports.map((report) => report.title) : reports.data?.items.slice(0, 3).map((report) => report.category.replaceAll("_", " ")) ?? []} /><Reveal><article className="surface-card rounded-2xl p-5"><p className="flex items-center gap-2 text-sm font-semibold"><MapPinned className="size-4 text-blue-400" />AI insight</p><p className="mt-5 text-sm leading-6 text-zinc-400">{demo ? "Sohna Road has the highest verified severity in the current demo set." : "Live insights appear when reports have been verified."}</p><Link href="/map" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-blue-300">Open map <ArrowUpRight className="size-3" /></Link></article></Reveal></section>
  </main>;
}

function Metric({ icon, value, suffix = "", label, tone }: { icon: React.ReactNode; value: number | null; suffix?: string; label: string; tone: string }) {
  return <Reveal><article className="surface-card rounded-2xl p-5"><span className={tone}>{icon}</span><p className="mt-5 flex items-baseline text-3xl font-semibold">{value === null ? "—" : <><Counter value={value} fontSize={36} />{suffix}</>}</p><p className="mt-1 text-xs text-zinc-500">{label}</p></article></Reveal>;
}

function Feed({ title, rows }: { title: string; rows: string[] }) {
  return <Reveal><article className="surface-card rounded-2xl p-5"><p className="text-sm font-semibold">{title}</p><div className="mt-4 divide-y divide-white/[.06]">{rows.length ? rows.map((row) => <p key={row} className="py-3 text-xs text-zinc-400">{row}</p>) : <p className="py-5 text-xs text-zinc-500">No live reports yet.</p>}</div></article></Reveal>;
}
