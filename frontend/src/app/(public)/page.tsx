"use client";

import Link from "next/link";
import { ArrowRight, Camera, ChevronRight, MapPin, Navigation, Radar, ScanLine, ShieldCheck, TriangleAlert, Waves, type LucideIcon } from "lucide-react";
import ClickSpark from "@/components/ClickSpark";
import Magnet from "@/components/Magnet";
import Noise from "@/components/Noise";
import ScrollFloat from "@/components/ScrollFloat";
import ScrollReveal from "@/components/ScrollReveal";
import { Reveal } from "@/components/motion/reveal";
import { useAppMode } from "@/features/app-mode/app-mode-context";
import { demoAverageConfidence, demoDisplayReports, demoMapIncidents } from "@/features/app-mode/mode-data";
import { useIncidentsQuery } from "@/features/incidents/queries";
import { LandingMapPreview } from "@/features/map/landing-map-preview";

const capabilities: { icon: LucideIcon; index: string; title: string; text: string }[] = [
  { icon: Camera, index: "01", title: "Street reports", text: "Local evidence from people already moving through the area." },
  { icon: ScanLine, index: "02", title: "Signal verification", text: "AI confidence checks help separate urgent evidence from noise." },
  { icon: Navigation, index: "03", title: "Route context", text: "Water conditions sit next to the decision you need to make." },
  { icon: ShieldCheck, index: "04", title: "Clear uncertainty", text: "Freshness, confidence, and gaps remain visible at every step." },
];

const steps = [
  ["01", "Observe", "Capture the water level, blockage, or road condition."],
  ["02", "Verify", "Combine evidence, AI assessment, and nearby reports."],
  ["03", "Decide", "Read the street signal before you commit to a route."],
] as const;

export default function PublicLandingPage() {
  const { mode } = useAppMode();
  const liveIncidents = useIncidentsQuery(mode === "live" ? "?limit=100&sort=desc" : "");
  const demo = mode === "demo";
  const reportCount = demo ? demoDisplayReports.length : liveIncidents.data?.totalCount ?? 0;
  const demoNearby = demoDisplayReports[0];
  const liveNearby = liveIncidents.data?.items[0];
  const nearbyTitle = demo ? demoNearby?.title ?? "No report nearby" : liveNearby ? liveNearby.category.replaceAll("_", " ") : "No live report nearby";
  const nearbyDetail = demo ? `AI confidence ${demoNearby?.trustScore ?? "—"}%` : liveNearby?.confidenceScore === null || liveNearby === undefined ? "Waiting for live reports" : `AI confidence ${Math.round(liveNearby.confidenceScore)}%`;
  const stats = demo
    ? [[String(demoDisplayReports.length), "Connected reports"], [String(new Set(demoDisplayReports.map((report) => report.reporter)).size), "Contributors"], [String(demoMapIncidents.length), "Map incidents"], [`${demoAverageConfidence}%`, "Avg. confidence"]]
    : [[String(reportCount), "Live incidents"], ["—", "Contributors"], [String(reportCount), "Map incidents"], ["—", "Live confidence"]];
  const modeMessage = demo ? `${reportCount} verified demo reports` : liveIncidents.isLoading ? "Loading current reports" : `${reportCount} current incidents`;

  return <main data-scroll-reveal-page className="wr-landing overflow-hidden bg-[#f4efe5] text-[#171714]">
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] opacity-[.07] mix-blend-multiply"><Noise patternSize={180} patternRefreshInterval={8} patternAlpha={18} /></div>
    <section id="overview" className="border-b border-[#171714]">
      <div className="w-full px-5 py-5 sm:px-8 xl:px-12">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#656158]">
          <p>Water intelligence / Gurugram</p>
          <p className="flex items-center gap-2 text-[#006b65]"><span className="size-2 rounded-full bg-[#33b6a0]" />Network active · {modeMessage}</p>
          <p className="hidden lg:block">Community + AI / Advisory only</p>
        </div>
      </div>
      <div className="grid w-full border-x border-[#171714] lg:grid-cols-[minmax(0,.9fr)_minmax(34rem,1.1fr)]">
        <ClickSpark sparkColor="#f05a28" sparkCount={6} sparkRadius={24} sparkSize={7} duration={360}>
        <div className="flex min-h-[43rem] min-w-0 flex-col overflow-hidden border-b border-[#171714] p-6 sm:p-10 lg:border-b-0 lg:border-r xl:p-14">
          <Reveal delay={0.02}>
            <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[.2em] text-[#f05a28]"><Radar className="size-4" />Street-level awareness</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-8 w-full max-w-full text-[clamp(4rem,7vw,7rem)] font-black uppercase leading-[.78] tracking-[-.085em]">Read the<br /><span className="text-[#006b65]">water.</span><br />Move smarter.</h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-8 max-w-lg border-l-4 border-[#f05a28] pl-5 text-base leading-7 text-[#555149]">Real-time flood intelligence made from local reports, clear confidence signals, and the streets you actually use.</p>
          </Reveal>
          <Reveal delay={0.22}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnet padding={42} magnetStrength={5}><Link className="inline-flex min-h-12 items-center gap-2 border border-[#171714] bg-[#171714] px-5 text-sm font-bold uppercase tracking-[.08em] text-white transition hover:bg-[#f05a28]" href="/map"><MapPin className="size-4" />Open live radar <ArrowRight className="size-4" /></Link></Magnet>
              <Magnet padding={36} magnetStrength={6}><Link className="inline-flex min-h-12 items-center gap-2 border border-[#171714] px-5 text-sm font-bold uppercase tracking-[.08em] transition hover:bg-[#fffdf7]" href="/reports/new"><Camera className="size-4" />Report water</Link></Magnet>
            </div>
          </Reveal>
          <div className="mt-auto grid grid-cols-2 gap-px border border-[#171714] bg-[#171714] sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {stats.map(([stat, label]) => <div key={label} className="bg-[#fffdf7] p-4"><p className="text-2xl font-black tracking-[-.05em]">{stat}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#777167]">{label}</p></div>)}
          </div>
        </div>
        </ClickSpark>

        <Reveal className="relative min-h-[38rem] bg-[#171714] p-3 sm:p-5" delay={0.22}>
          <div className="relative h-full min-h-[36rem] overflow-hidden border border-white/25">
            <LandingMapPreview fill />
            <div className="absolute left-4 top-4 max-w-[calc(100%-2rem)] border border-white/25 bg-[#171714]/95 px-4 py-3 text-white backdrop-blur">
              <p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#ff7a45]">Current scan</p>
              <p className="mt-1 text-sm font-semibold">{demo ? `${demoDisplayReports.length} connected demo reports` : "Live conditions from the map"}</p>
            </div>
            <div className="absolute bottom-4 left-4 hidden border border-white/25 bg-[#fffdf7] p-4 text-[#171714] sm:block">
              <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#777167]">Signal key</p>
              <div className="mt-3 grid gap-2 text-xs font-semibold"><p><i className="mr-2 inline-block h-1 w-6 bg-[#d93622]" />Impassable</p><p><i className="mr-2 inline-block h-1 w-6 bg-[#f05a28]" />Heavy water</p><p><i className="mr-2 inline-block h-1 w-6 bg-[#e6b84a]" />Minor water</p></div>
            </div>
            <div className="absolute bottom-4 right-4 hidden max-w-xs border border-white/25 bg-[#171714]/95 p-4 text-white backdrop-blur sm:block"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#33b6a0]">Nearest signal</p><p className="mt-2 text-sm font-semibold capitalize">{nearbyTitle}</p><p className="mt-1 text-xs text-white/55">{nearbyDetail}</p></div>
          </div>
        </Reveal>
      </div>
    </section>

    <section id="features" className="w-full border-x border-[#171714]">
      <div className="grid border-b border-[#171714] lg:grid-cols-[.42fr_1.58fr]">
        <Reveal className="border-b border-[#171714] p-6 sm:p-10 lg:border-b-0 lg:border-r">
          <p className="font-mono text-xs font-bold text-[#f05a28]">WR / METHOD</p>
          <ScrollFloat containerClassName="!my-5" textClassName="!text-4xl sm:!text-6xl font-black uppercase !leading-[.9] tracking-[-.055em]" scrollStart="top bottom-=5%" scrollEnd="bottom center+=20%" stagger={0.018}>One signal. Three moves.</ScrollFloat>
          <p className="mt-6 max-w-sm text-sm leading-6 text-[#656158]">WaterRadar turns a street observation into a legible travel decision without hiding uncertainty.</p>
        </Reveal>
        <div className="grid md:grid-cols-3">{steps.map(([number, title, text], index) => <Reveal key={number} delay={index * 0.08}><article className="group flex h-full min-h-72 flex-col border-b border-[#171714] p-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 sm:p-8"><div className="flex items-center justify-between"><span className="font-mono text-xs font-bold text-[#8c867b]">{number}</span><Waves className="size-5 text-[#006b65]" /></div><h3 className="mt-auto pt-16 text-3xl font-black uppercase tracking-[-.045em]">{title}</h3><p className="mt-3 text-sm leading-6 text-[#656158]">{text}</p></article></Reveal>)}</div>
      </div>
    </section>

    <section id="live-map" className="bg-[#006b65] text-white">
      <div className="grid w-full border-x border-white/30 lg:grid-cols-[1.18fr_.82fr]">
        <Reveal className="border-b border-white/30 p-4 sm:p-8 lg:border-b-0 lg:border-r" delay={0.06}><div className="border border-white/30 bg-[#171714] p-2"><LandingMapPreview small /></div></Reveal>
        <Reveal className="flex flex-col p-6 sm:p-10" delay={0.12}>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b8eee2]">Road intelligence</p>
          <ScrollFloat containerClassName="!my-5" textClassName="!text-4xl sm:!text-6xl font-black uppercase !leading-[.88] tracking-[-.06em]" scrollStart="top bottom-=5%" scrollEnd="bottom center+=20%" stagger={0.014}>See the street before the turn.</ScrollFloat>
          <ScrollReveal containerClassName="!my-0 max-w-lg" textClassName="!text-sm !font-normal !leading-7 text-white/70" baseOpacity={0.25} blurStrength={2} baseRotation={1}>Fresh reports and local patterns become a fast visual language: red means stop, orange means reassess, and every quiet area still carries uncertainty.</ScrollReveal>
          <div className="mt-8 border-y border-white/30 py-4 text-xs font-bold uppercase tracking-[.08em]"><div className="grid grid-cols-[2rem_1fr] items-center gap-3 py-2"><i className="h-1 bg-[#ff3b20]" />Impassable</div><div className="grid grid-cols-[2rem_1fr] items-center gap-3 py-2"><i className="h-1 bg-[#ff7a45]" />Heavy flooding</div><div className="grid grid-cols-[2rem_1fr] items-center gap-3 py-2"><i className="h-1 bg-[#ffd36a]" />Minor waterlogging</div></div>
          <Magnet padding={38} magnetStrength={6} wrapperClassName="mt-8 w-fit"><Link href="/map" className="inline-flex min-h-12 w-fit items-center gap-2 border border-white bg-white px-5 text-sm font-bold uppercase tracking-[.08em] text-[#006b65] transition hover:bg-[#171714] hover:text-white">Explore the radar <ChevronRight className="size-4" /></Link></Magnet>
        </Reveal>
      </div>
    </section>

    <section id="about" className="w-full border-x border-[#171714]">
      <div className="grid lg:grid-cols-[.5fr_1.5fr]">
        <Reveal className="border-b border-[#171714] bg-[#f05a28] p-6 text-white sm:p-10 lg:border-b-0 lg:border-r">
          <TriangleAlert className="size-7" />
          <p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-white/65">Built for the gap</p>
          <h2 className="mt-4 text-4xl font-black uppercase leading-[.9] tracking-[-.055em]">The map is late.<br />The street is not.</h2>
        </Reveal>
        <div>{capabilities.map(({ icon: Icon, index, title, text }) => <Reveal key={title}><article className="grid gap-4 border-b border-[#171714] p-6 last:border-b-0 sm:grid-cols-[4rem_3rem_1fr_1.25fr] sm:items-center sm:p-8"><span className="font-mono text-xs font-bold text-[#8c867b]">{index}</span><Icon className="size-5 text-[#006b65]" /><h3 className="text-lg font-black uppercase tracking-[-.03em]">{title}</h3><p className="text-sm leading-6 text-[#656158]">{text}</p></article></Reveal>)}</div>
      </div>
    </section>

    <Reveal className="border-y border-[#171714] bg-[#fffdf7]"><section className="grid w-full border-x border-[#171714] p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end xl:p-14">
      <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#006b65]">Before the next turn</p><ScrollFloat containerClassName="!my-4 max-w-4xl" textClassName="!text-4xl sm:!text-7xl font-black uppercase !leading-[.87] tracking-[-.065em]" scrollStart="top bottom-=5%" scrollEnd="bottom center+=25%" stagger={0.012}>Put the street on your radar.</ScrollFloat><ScrollReveal containerClassName="!my-0 max-w-xl" textClassName="!text-sm !font-normal !leading-6 text-[#656158]" baseOpacity={0.25} blurStrength={2} baseRotation={1}>Open WaterRadar, check what is known, and add the evidence only you can see.</ScrollReveal></div>
      <div className="mt-8 flex flex-wrap gap-3 lg:mt-0"><Magnet padding={40} magnetStrength={5}><Link href="/map" className="inline-flex min-h-12 items-center gap-2 border border-[#171714] bg-[#f05a28] px-5 text-sm font-bold uppercase tracking-[.08em] text-white">Open live radar <ArrowRight className="size-4" /></Link></Magnet><Magnet padding={32} magnetStrength={6}><Link href="/dashboard" className="inline-flex min-h-12 items-center border border-[#171714] px-5 text-sm font-bold uppercase tracking-[.08em]">View dashboard</Link></Magnet></div>
    </section></Reveal>

    <footer className="bg-[#171714] px-5 py-8 text-white sm:px-8 xl:px-12"><div className="flex w-full flex-wrap items-center justify-between gap-4"><p className="text-sm font-black uppercase tracking-[-.02em]">WaterRadar</p><p className="text-[10px] font-bold uppercase tracking-[.12em] text-white/45">Community-powered water intelligence · Evidence is unverified when submitted · No data does not mean safe</p></div><h2 className="sr-only">Evidence is unverified when submitted</h2><h2 className="sr-only">No data does not mean safe</h2></footer>
  </main>;
}
