"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3, MapPinned, PlusCircle } from "lucide-react";
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

  return <main className="mx-auto max-w-[86rem] px-5 py-8 sm:px-8 lg:py-10">
    <header className="grid gap-6 border-b border-[#171714] pb-7 md:grid-cols-[1fr_auto] md:items-end">
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
        <span className="font-mono text-xs font-bold text-[#f05a28]">WR / 01</span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#006b65]">Operations overview</p>
          <BlurText as="h1" text="Your water radar" delay={105} className="mt-2 text-4xl font-black uppercase leading-none tracking-[-.06em] sm:text-6xl" />
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#656158]">Current conditions from your submitted evidence and the shared street-level map.</p>
        </div>
      </div>
      <Link href="/reports/new" className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#171714] bg-[#f05a28] px-5 text-sm font-bold uppercase tracking-[.08em] text-white transition hover:bg-[#171714]"><PlusCircle className="size-4" />Submit a report</Link>
    </header>

    <section className="mt-7 grid border border-[#171714] bg-[#fffdf7] sm:grid-cols-3">
      <Metric number="01" icon={<Clock3 />} value={validating} label="Reports validating" delay={0} />
      <Metric number="02" icon={<CheckCircle2 />} value={completed} label="AI validation complete" delay={0.08} />
      <Metric number="03" icon={<MapPinned />} value={mapReports.data?.totalCount ?? 0} label="Reports on the map" delay={0.16} />
    </section>

    <Reveal className="mt-5" delay={0.08}>
      <section className="relative h-[30rem] overflow-hidden border border-[#171714] bg-[#171714] p-1">
        <div className="absolute left-5 top-5 z-10 max-w-xs border border-white/25 bg-[#171714]/95 px-4 py-3 text-white backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff7a45]">Live signal map</p><p className="mt-1 text-sm font-semibold">{mapReports.isLoading ? "Loading current reports…" : `${mapReports.data?.totalCount ?? 0} reports in this area`}</p></div>
        <MapCanvas viewport={{ latitude: env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE, longitude: env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE, zoom: env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM }} attribution={env.NEXT_PUBLIC_MAP_ATTRIBUTION} styleUrl={env.NEXT_PUBLIC_MAP_STYLE_URL} incidents={mapReports.data?.items ?? []} layers={layers} />
      </section>
    </Reveal>

    <Reveal className="mt-5" delay={0.12}>
      <section className="border border-[#171714] bg-[#fffdf7]">
        <div className="flex items-center justify-between gap-3 border-b border-[#171714] px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#006b65]">Evidence log</p><h2 className="mt-1 text-lg font-black uppercase tracking-[-.03em]">Recent reports</h2></div><Link href="/reports" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[.08em] text-[#171714] underline decoration-[#f05a28] decoration-2 underline-offset-4">View all <ArrowUpRight className="size-3.5" /></Link></div>
        {ownReports.isLoading ? <p className="mt-4 text-sm text-zinc-400">Loading your reports…</p> : submitted.length === 0 ? <p className="mt-4 text-sm text-zinc-400">You have not submitted a report yet.</p> : <div className="mt-4 divide-y divide-white/[.06]">{submitted.slice(0, 3).map((report) => <Link href={`/map?report=${report.id}&lat=${report.latitude}&lng=${report.longitude}`} key={report.id} className="flex items-center justify-between gap-4 py-3 text-sm hover:text-blue-200"><span className="font-medium">{report.category.replaceAll("_", " ")}</span><span className="text-xs text-zinc-400">{report.aiAnalysis === null || report.aiAnalysis.status === "PROCESSING" ? "Validating…" : report.aiAnalysis.status === "SUCCEEDED" ? "Validated" : "Manual review"}</span></Link>)}</div>}
      </section>
    </Reveal>
  </main>;
}

function Metric({ number, icon, value, label, delay }: { number: string; icon: React.ReactNode; value: number; label: string; delay: number }) {
  return <Reveal delay={delay}><article className="min-h-44 border-b border-[#171714] p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><div className="flex items-start justify-between"><span className="text-[#006b65] [&_svg]:size-5">{icon}</span><span className="font-mono text-[10px] font-bold text-[#8c867b]">{number}</span></div><p className="mt-8 flex h-11 items-center text-5xl font-black tracking-[-.07em]"><Counter value={value} fontSize={44} /></p><p className="mt-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#656158]">{label}</p></article></Reveal>;
}
