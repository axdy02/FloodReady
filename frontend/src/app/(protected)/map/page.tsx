"use client";

import Link from "next/link";
import { Camera, Filter, Layers3, LocateFixed, Navigation, Search, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { demoIncidents, mapIncidents } from "@/data/demo/incidents";
import { useAppMode } from "@/features/app-mode/app-mode-context";
import { useIncidentsQuery } from "@/features/incidents/queries";
import { demoPreviewRoadPaths } from "@/features/map/demo-preview-incidents";
import { type MapLayerState, MapCanvas } from "@/features/map/map-canvas";
import { loadClientEnvironment } from "@/lib/env/client";

const chips = ["All", "Flooded roads", "Waterlogging", "Blocked drains", "Open manholes", "Shelters"];
const layersInfo: { key: keyof MapLayerState; title: string; detail: string }[] = [{ key: "roads", title: "Road coloring", detail: "Traffic-style severity" }, { key: "markers", title: "Incident markers", detail: "Reports and hazards" }, { key: "heatmap", title: "Heatmap", detail: "Density overlay" }, { key: "shelters", title: "Shelters", detail: "Safe places nearby" }, { key: "weather", title: "Weather overlay", detail: "Rainfall intensity" }, { key: "traffic", title: "Traffic", detail: "Live traffic conditions" }];

export default function MapPage() {
  const env = loadClientEnvironment();
  const { mode } = useAppMode();
  const params = useSearchParams();
  const [activeChip, setActiveChip] = useState("All");
  const [selected, setSelected] = useState<string | null>(params.get("incident"));
  const [layersOpen, setLayersOpen] = useState(true);
  const [layers, setLayers] = useState<MapLayerState>({ roads: true, markers: true, heatmap: false, shelters: false, weather: false, traffic: false });
  const liveIncidents = useIncidentsQuery(mode === "live" ? "?limit=100&sort=desc" : "");
  const incidents = mode === "demo" ? mapIncidents : liveIncidents.data?.items ?? [];
  const toggle = useCallback((key: keyof MapLayerState) => setLayers((current) => ({ ...current, [key]: !current[key] })), []);
  const modeLabel = mode === "demo" ? `Demo · ${demoIncidents.length} active` : liveIncidents.isLoading ? "Live · loading" : `Live · ${incidents.length} active`;

  return <main className="relative h-[calc(100vh-4rem)] min-h-[42rem] overflow-hidden">
    <MapCanvas viewport={{ latitude: env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE, longitude: env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE, zoom: env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM }} attribution={env.NEXT_PUBLIC_MAP_ATTRIBUTION} styleUrl={env.NEXT_PUBLIC_MAP_STYLE_URL} incidents={incidents} roadPaths={mode === "demo" ? demoPreviewRoadPaths : {}} layers={layers} selectedIncidentId={selected} onIncidentSelect={setSelected} />
    <div className="pointer-events-none absolute inset-0 p-4 sm:p-6">
      <div className="pointer-events-auto flex max-w-xl items-center gap-2 rounded-2xl border border-white/10 bg-[#111113]/90 p-2 shadow-2xl backdrop-blur-xl"><Search className="ml-2 size-5 text-zinc-500" /><input aria-label="Search roads, areas, landmarks" placeholder="Search roads, areas, landmarks..." className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-zinc-500" /><button aria-label="Map filters" className="grid size-9 place-items-center rounded-xl bg-white/[.06]"><Filter className="size-4" /></button></div>
      <div className="pointer-events-auto mt-3 flex gap-2 overflow-x-auto pb-1">{chips.map((chip) => <button key={chip} onClick={() => setActiveChip(chip)} className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs ${activeChip === chip ? "border-white bg-white text-zinc-950" : "border-white/10 bg-[#111113]/90 text-zinc-300"}`}>{chip}</button>)}</div>
      <section className="pointer-events-auto absolute bottom-6 left-4 hidden rounded-2xl border border-white/10 bg-[#111113]/90 p-5 shadow-xl backdrop-blur-xl sm:block"><p className="text-[10px] font-semibold tracking-[.16em] text-zinc-500">ROAD STATUS</p><div className="mt-4 space-y-2.5 text-xs text-zinc-300">{[["bg-red-700", "Impassable"], ["bg-red-400", "Heavy flooding"], ["bg-amber-400", "Minor flooding"]].map(([color, label]) => <p key={label} className="flex items-center gap-2.5"><i className={`h-1.5 w-7 rounded-full ${color}`} />{label}</p>)}</div></section>
      <div className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2 rounded-2xl border border-white/10 bg-[#111113]/90 p-2 shadow-xl"><Link href="/reports/new" className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white"><Camera className="size-4" />Report</Link><Link href="/route-planner" className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"><Navigation className="size-4" />Route</Link></div>
      <button aria-label="Locate me" className="pointer-events-auto absolute bottom-6 right-4 grid size-10 place-items-center rounded-xl border border-white/10 bg-[#111113]/90"><LocateFixed className="size-4" /></button>
      <div className="pointer-events-auto absolute right-4 top-5"><button onClick={() => setLayersOpen((open) => !open)} aria-label="Toggle layers" className="ml-auto grid size-10 place-items-center rounded-xl border border-white/10 bg-[#111113]/90"><Layers3 className="size-5" /></button>{layersOpen ? <aside className="mt-2 w-72 rounded-2xl border border-white/10 bg-[#111113]/95 p-5 shadow-2xl backdrop-blur-xl"><div className="flex items-center justify-between"><p className="flex items-center gap-2 font-semibold"><Layers3 className="size-5 text-blue-400" />Layers</p><button onClick={() => setLayersOpen(false)} aria-label="Close layers"><X className="size-4 text-zinc-500" /></button></div><div className="mt-5 space-y-4">{layersInfo.map((item) => <button type="button" key={item.key} aria-pressed={layers[item.key]} onClick={() => toggle(item.key)} className="flex w-full items-center justify-between text-left"><span><span className="block text-sm font-medium">{item.title}</span><span className="mt-0.5 block text-xs text-zinc-500">{item.detail}</span></span><span className={`relative h-5 w-9 rounded-full ${layers[item.key] ? "bg-blue-500" : "bg-zinc-800"}`}><i className={`absolute top-0.5 size-4 rounded-full bg-white transition ${layers[item.key] ? "left-4" : "left-0.5"}`} /></span></button>)}</div></aside> : null}</div>
      <span className="pointer-events-auto absolute left-1/2 top-5 hidden -translate-x-1/2 rounded-full border border-white/10 bg-[#111113]/90 px-3 py-2 text-xs md:block"><i className="mr-2 inline-block size-2 rounded-full bg-emerald-400" />{modeLabel}</span>
      {selected ? <button onClick={() => setSelected(null)} className="pointer-events-auto absolute bottom-24 right-4 rounded-xl border border-white/10 bg-[#111113]/90 px-3 py-2 text-xs">Selected incident · dismiss</button> : null}
    </div>
  </main>;
}
