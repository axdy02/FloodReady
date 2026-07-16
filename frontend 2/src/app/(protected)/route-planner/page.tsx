"use client";

import { ArrowDownUp, MapPin, Navigation, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { BlurText } from "@/components/motion/blur-text";
import { Reveal } from "@/components/motion/reveal";
import { mapIncidents } from "@/data/demo/incidents";
import { useAppMode } from "@/features/app-mode/app-mode-context";
import { useIncidentsQuery } from "@/features/incidents/queries";
import { type MapLayerState, MapCanvas } from "@/features/map/map-canvas";
import { loadClientEnvironment } from "@/lib/env/client";

const layers: MapLayerState = { roads: true, markers: true, heatmap: false, shelters: false, weather: false, traffic: false };
const demoRoute = [{ color: "#3b82f6", coordinates: [[77.041, 28.4235], [77.047, 28.414], [77.054, 28.399], [77.061, 28.37], [77.0635, 28.249]] as const }, { color: "#64748b", coordinates: [[77.041, 28.4235], [77.052, 28.412], [77.068, 28.38], [77.0635, 28.249]] as const }];

export default function RoutePlannerPage() {
  const env = loadClientEnvironment();
  const { mode } = useAppMode();
  const [origin, setOrigin] = useState("Sector 44, Gurugram");
  const [destination, setDestination] = useState("Cyber City, Gurugram");
  const [priority, setPriority] = useState("Safest");
  const [calculated, setCalculated] = useState(false);
  const liveIncidents = useIncidentsQuery(mode === "live" ? "?limit=100&sort=desc" : "");
  const incidents = mode === "demo" ? mapIncidents : liveIncidents.data?.items ?? [];
  const swap = () => { setOrigin(destination); setDestination(origin); };

  return <main className="mx-auto grid max-w-7xl gap-4 px-5 py-8 xl:grid-cols-[23rem_1fr]"><Reveal><section className="surface-card rounded-2xl p-5"><p className="text-xs font-semibold tracking-[.18em] text-blue-400">ROUTE PLANNER · {mode.toUpperCase()} DATA</p><BlurText as="h1" text="Find a safer way through." delay={140} className="mt-2 text-2xl font-semibold" /><div className="mt-6 space-y-3"><label className="block text-xs text-zinc-500">Origin<input value={origin} onChange={(event) => setOrigin(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-200 outline-none" /></label><div className="flex justify-center"><button aria-label="Swap origin and destination" onClick={swap} className="grid size-8 place-items-center rounded-full border border-white/10 text-zinc-400"><ArrowDownUp className="size-4" /></button></div><label className="block text-xs text-zinc-500">Destination<input value={destination} onChange={(event) => setDestination(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-200 outline-none" /></label></div><div className="mt-5 space-y-2 text-sm text-zinc-400"><label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-blue-500" />Avoid flooded roads</label><label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-blue-500" />Avoid high-risk roads</label><label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-blue-500" />Prefer verified roads</label></div><p className="mt-5 text-xs font-medium text-zinc-500">Route priority</p><div className="mt-2 grid grid-cols-3 gap-2">{["Safest", "Fastest", "Balanced"].map((item) => <button key={item} onClick={() => setPriority(item)} className={`rounded-lg border px-2 py-2 text-xs ${priority === item ? "border-blue-400 bg-blue-500/10 text-blue-200" : "border-white/[.08] text-zinc-500"}`}>{item}</button>)}</div><button onClick={() => setCalculated(true)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white hover:bg-blue-400"><Navigation className="size-4" />Find routes</button>{calculated && mode === "demo" ? <div className="mt-5 space-y-2"><RouteOption title="Recommended" time="42 min" distance="21.4 km" active /><RouteOption title="Fastest" time="38 min" distance="19.7 km" /><RouteOption title="Alternate" time="45 min" distance="22.1 km" /></div> : <div className="mt-5 rounded-xl border border-emerald-400/15 bg-emerald-400/[.06] p-4"><p className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><ShieldCheck className="size-4" />{mode === "demo" ? "AI recommendation" : "Live map context"}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{mode === "demo" ? "Safest route avoids 3 flooded road segments with an estimated 8 minute delay." : liveIncidents.isLoading ? "Loading live incidents before route planning." : "Live incidents are shown on the map. Route estimates are unavailable until a live routing service is connected."}</p></div>}</section></Reveal><Reveal delay={0.08}><section className="relative min-h-[36rem] overflow-hidden rounded-2xl border border-white/[.08]"><MapCanvas viewport={{ latitude: env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE, longitude: env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE, zoom: env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM }} attribution={env.NEXT_PUBLIC_MAP_ATTRIBUTION} styleUrl={env.NEXT_PUBLIC_MAP_STYLE_URL} incidents={incidents} routes={calculated && mode === "demo" ? demoRoute : []} layers={layers} /><div className="absolute left-4 top-4 rounded-xl border border-white/10 bg-[#111113]/90 p-3 text-xs backdrop-blur"><p className="flex items-center gap-2 font-semibold"><MapPin className="size-3 text-blue-300" />{origin}</p><p className="mt-2 flex items-center gap-2 text-zinc-400"><MapPin className="size-3 text-red-400" />{destination}</p></div></section></Reveal></main>;
}

function RouteOption({ title, time, distance, active = false }: { title: string; time: string; distance: string; active?: boolean }) {
  return <button className={`w-full rounded-xl border p-3 text-left text-xs ${active ? "border-blue-400/40 bg-blue-500/[.08]" : "border-white/[.08] bg-black/10"}`}><span className="font-semibold">{title}</span><span className="mt-1 block text-zinc-500">{time} · {distance} · {active ? "low risk" : "moderate risk"}</span></button>;
}
