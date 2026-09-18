"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, MapPinned, PlusCircle } from "lucide-react";
import { BlurText } from "@/components/motion/blur-text";
import { Counter } from "@/components/motion/counter";
import { Reveal } from "@/components/motion/reveal";
import { type MapLayerState, MapCanvas } from "@/features/map/map-canvas";
import { useReportMapQuery } from "@/features/map/queries";
import { useOwnReportsQuery } from "@/features/reports/queries";
import { loadClientEnvironment } from "@/lib/env/client";

const layers: MapLayerState = { roads: false, markers: true, heatmap: false, shelters: false, weather: false, traffic: false };

export function DashboardView() {
  const env = loadClientEnvironment();
  const ownReports = useOwnReportsQuery("", null);
  const mapReports = useReportMapQuery(`?west=${(env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE - 0.45).toFixed(6)}&south=${(env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE - 0.45).toFixed(6)}&east=${(env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE + 0.45).toFixed(6)}&north=${(env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE + 0.45).toFixed(6)}&limit=100&sort=desc`);
  const submitted = ownReports.data?.items ?? [];
  const validating = submitted.filter((report) => report.aiAnalysis === null || report.aiAnalysis.status === "PROCESSING").length;
  const completed = submitted.filter((report) => report.aiAnalysis?.status === "SUCCEEDED").length;

  return <main className="mx-auto max-w-7xl px-5 py-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold tracking-[.18em] text-blue-400">LIVE OVERVIEW</p>
        <BlurText as="h1" text="FloodReady dashboard" delay={105} className="mt-2 text-3xl font-semibold" />
        <p className="mt-2 text-sm text-zinc-400">Current information from your submitted reports and the shared reports map.</p>
      </div>
      <Link href="/reports/new" className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white"><PlusCircle className="size-4" />Submit a report</Link>
    </header>

    <section className="mt-7 grid gap-3 sm:grid-cols-3">
      <Metric icon={<Clock3 />} value={validating} label="Reports validating" delay={0} />
      <Metric icon={<CheckCircle2 />} value={completed} label="AI validation complete" delay={0.08} />
      <Metric icon={<MapPinned />} value={mapReports.data?.totalCount ?? 0} label="Reports on the map" delay={0.16} />
    </section>

    <Reveal className="mt-4" delay={0.08}>
      <section className="relative h-[28rem] overflow-hidden rounded-2xl border border-white/[.08]">
        <div className="absolute left-5 top-5 z-10 rounded-xl border border-white/10 bg-[#111113]/90 px-4 py-3 backdrop-blur"><p className="text-sm font-semibold">Reports map</p><p className="mt-1 text-xs text-zinc-400">{mapReports.isLoading ? "Loading current reports…" : `${mapReports.data?.totalCount ?? 0} reports in this area`}</p></div>
        <MapCanvas viewport={{ latitude: env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE, longitude: env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE, zoom: env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM }} attribution={env.NEXT_PUBLIC_MAP_ATTRIBUTION} styleUrl={env.NEXT_PUBLIC_MAP_STYLE_URL} incidents={mapReports.data?.items ?? []} layers={layers} />
      </section>
    </Reveal>

    <Reveal className="mt-4" delay={0.12}>
      <section className="rounded-2xl border border-white/[.08] bg-white/[.02] p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Recent reports</h2><Link href="/reports" className="text-xs font-semibold text-blue-300">View all</Link></div>
        {ownReports.isLoading ? <p className="mt-4 text-sm text-zinc-400">Loading your reports…</p> : submitted.length === 0 ? <p className="mt-4 text-sm text-zinc-400">You have not submitted a report yet.</p> : <div className="mt-4 divide-y divide-white/[.06]">{submitted.slice(0, 3).map((report) => <Link href={`/map?report=${report.id}&lat=${report.latitude}&lng=${report.longitude}`} key={report.id} className="flex items-center justify-between gap-4 py-3 text-sm hover:text-blue-200"><span className="font-medium">{report.category.replaceAll("_", " ")}</span><span className="text-xs text-zinc-400">{report.aiAnalysis === null || report.aiAnalysis.status === "PROCESSING" ? "Validating…" : report.aiAnalysis.status === "SUCCEEDED" ? "Validated" : "Manual review"}</span></Link>)}</div>}
      </section>
    </Reveal>
  </main>;
}

function Metric({ icon, value, label, delay }: { icon: React.ReactNode; value: number; label: string; delay: number }) {
  return <Reveal delay={delay}><article className="surface-card rounded-2xl p-5"><span className="text-blue-400">{icon}</span><p className="mt-5 flex h-9 items-center text-3xl font-semibold"><Counter value={value} fontSize={36} /></p><p className="mt-1 text-xs text-zinc-400">{label}</p></article></Reveal>;
}
