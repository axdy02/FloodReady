"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LocateFixed, MapPin, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { authStore } from "@/features/auth/auth-store";
import { type MapLayerState, MapCanvas } from "@/features/map/map-canvas";
import { type LocationValue, validateDevicePosition } from "@/features/map/types";
import { reportsApi } from "@/features/reports/api";
import { reportFormSchema, validateImage } from "@/features/reports/report-form-schema";
import type { ReportDto } from "@/lib/api/contracts";
import { loadClientEnvironment } from "@/lib/env/client";

const layers: MapLayerState = { roads: false, markers: false, heatmap: false, shelters: false, weather: false, traffic: false };
const categoryLabels = {
  ROAD_WATERLOGGING: "Road waterlogging",
  FLOODED_ROAD: "Flooded road",
  CLOGGED_DRAIN: "Clogged drain",
  OVERFLOWING_DRAIN: "Overflowing drain",
  OPEN_MANHOLE: "Open manhole",
  FALLEN_TREE: "Fallen tree",
  STRANDED_VEHICLE: "Stranded vehicle",
  UNDERPASS_FLOODING: "Underpass flooding",
  OTHER: "Other",
} as const satisfies Record<ReportDto["category"], string>;
const severities = [["MINOR", "Low"], ["MODERATE", "Moderate"], ["SEVERE", "High"], ["IMPASSABLE", "Critical"]] as const;
type Category = ReportDto["category"];
type Severity = (typeof severities)[number][0];

export const reportCategoryOptions = Object.entries(categoryLabels) as Array<[Category, string]>;

const rainRelatedCategories = new Set<Category>(["ROAD_WATERLOGGING", "FLOODED_ROAD", "OVERFLOWING_DRAIN", "UNDERPASS_FLOODING"]);

export function usesWeatherContext(category: Category): boolean {
  return rainRelatedCategories.has(category);
}

export function weatherGuidanceForCategory(category: Category): string {
  return usesWeatherContext(category)
    ? "This is a rain-related category. Background AI validation may show weather context if the backend returns it."
    : "Weather context is not required for this incident category.";
}

export function ReportForm() {
  const env = loadClientEnvironment();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<Category>("FLOODED_ROAD");
  const [severity, setSeverity] = useState<Severity>("MODERATE");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [evidence, setEvidence] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<ReportDto | null>(null);

  const pickMapLocation = useCallback(({ latitude, longitude }: { latitude: number; longitude: number }) => setLocation({ latitude, longitude, locationSource: "MANUAL", gpsAccuracy: null }), []);
  const useCurrentLocation = () => {
    if (navigator.geolocation === undefined) { setError("Device location is unavailable. Click the map to select a point."); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      const next = validateDevicePosition(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
      if (next === null) { setError("The device returned an invalid location. Click the map to select a point."); return; }
      setLocation(next); setError(null);
    }, () => setError("Location permission was denied. Click the map to select a point."), { enableHighAccuracy: true, timeout: 10_000 });
  };
  const chooseEvidence = (file: File | undefined) => {
    if (file === undefined || !validateImage(file, env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB * 1_048_576)) { setEvidence(null); setError(`Choose one JPEG, PNG, or WebP image up to ${env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB} MB.`); return; }
    setEvidence(file); setError(null);
  };
  const submit = async () => {
    if (submitting) return;
    const parsed = reportFormSchema.safeParse({ category, severity, description });
    const token = authStore.getAccessToken();
    if (!parsed.success || location === null || evidence === null) { setError("Add a description, evidence image, and location before submitting."); return; }
    if (token === undefined) { setError("Your session expired. Sign in again before submitting."); return; }
    setSubmitting(true); setError(null);
    const form = new FormData();
    form.append("category", parsed.data.category); form.append("severityClaim", parsed.data.severity ?? severity);
    form.append("description", parsed.data.description); form.append("latitude", location.latitude.toFixed(6)); form.append("longitude", location.longitude.toFixed(6));
    form.append("locationSource", location.locationSource);
    if (location.gpsAccuracy !== null) form.append("gpsAccuracy", String(Math.round(location.gpsAccuracy * 100) / 100));
    form.append("capturedAt", new Date().toISOString()); form.append("image", evidence);
    try {
      const report = await reportsApi.create(form, token);
      setCreated(report);
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch {
      setError("The report could not be submitted. Check your connection and retry once.");
    } finally { setSubmitting(false); }
  };

  if (created !== null) return <main className="mx-auto max-w-xl px-5 py-10"><section className="surface-card rounded-2xl p-8 text-center"><CheckCircle2 className="mx-auto size-12 text-emerald-400" /><p className="mt-5 text-xs font-semibold tracking-[.18em] text-emerald-300">REPORT SAVED</p><h1 className="mt-2 text-2xl font-semibold">Your report is on the map</h1><p className="mt-3 text-sm leading-6 text-zinc-400">AI validation has started in the background. The report is visible now as a grey <span aria-label="AI validation in progress" className="inline-grid size-4 place-items-center rounded-full bg-slate-400 font-bold text-slate-950">?</span> marker and will update when validation completes.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href={`/map?report=${created.id}&lat=${created.latitude}&lng=${created.longitude}`} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950">View on map</Link><Link href="/reports" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold">My reports</Link></div></section></main>;

  return <main className="mx-auto grid max-w-7xl gap-4 px-5 py-8 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,.9fr)]"><section className="surface-card rounded-2xl p-5 sm:p-6"><p className="text-xs font-semibold tracking-[.18em] text-blue-400">LIVE REPORT</p><h1 className="mt-2 text-2xl font-semibold tracking-[-.03em]">Submit a flood report</h1><p className="mt-2 text-sm text-zinc-400">Reports are saved immediately and validated by AI in the background.</p><FormSection number="1" title="Incident details"><div className="grid gap-3 sm:grid-cols-2">{reportCategoryOptions.map(([value, text]) => <button type="button" key={value} onClick={() => setCategory(value)} className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${category === value ? "border-blue-400/60 bg-blue-500/10 text-blue-100" : "border-white/[.08] bg-black/10 text-zinc-400 hover:bg-white/[.04]"}`}>{text}</button>)}</div><p aria-live="polite" className="mt-4 text-xs leading-5 text-zinc-400">{weatherGuidanceForCategory(category)}</p><p className="mt-5 text-xs font-medium text-zinc-400">Your severity</p><div className="mt-2 flex flex-wrap gap-2">{severities.map(([value, text]) => <button type="button" key={value} onClick={() => setSeverity(value)} className={`rounded-full border px-3 py-1.5 text-xs ${severity === value ? "border-blue-400 bg-blue-500 text-white" : "border-white/[.08] text-zinc-400"}`}>{text}</button>)}</div></FormSection><FormSection number="2" title="Location"><button type="button" onClick={useCurrentLocation} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold"><LocateFixed className="size-4" />Use current location</button><p className="mt-3 flex items-center gap-2 text-xs text-zinc-400"><MapPin className="size-3 text-blue-400" />{location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : "Click the map to select the report location"}</p></FormSection><FormSection number="3" title="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 1000))} rows={4} placeholder="Describe the flooding, road conditions, and nearby hazards." className="w-full resize-none rounded-xl border border-white/[.08] bg-black/20 p-3 text-sm outline-none placeholder:text-zinc-600" /><p className="mt-1 text-right text-[10px] text-zinc-600">{description.length}/1000</p></FormSection><FormSection number="4" title="Evidence image"><button type="button" onClick={() => fileInput.current?.click()} className="flex w-full flex-col items-center rounded-xl border border-dashed border-white/[.14] bg-black/10 px-4 py-6 text-center hover:border-blue-400/50"><Upload className="size-5 text-blue-400" /><span className="mt-2 text-sm font-medium">Choose an evidence image</span><span className="mt-1 text-xs text-zinc-500">JPEG, PNG, or WebP · maximum {env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB} MB</span></button><input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseEvidence(event.target.files?.[0])} />{evidence !== null ? <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[.08] bg-white/[.03] px-3 py-2 text-xs"><span className="truncate">{evidence.name}</span><button type="button" aria-label="Remove evidence image" onClick={() => setEvidence(null)}><X className="size-4 text-zinc-400" /></button></div> : null}</FormSection>{error ? <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-100">{error}</p> : null}<div className="mt-5 flex gap-3"><button type="button" onClick={() => void submit()} disabled={submitting} className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-60">{submitting ? "Submitting…" : "Submit report"}</button><Link href="/map" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium">Cancel</Link></div></section><section className="relative min-h-[36rem] overflow-hidden rounded-2xl border border-white/[.08]"><div className="absolute left-4 top-4 z-10 rounded-xl border border-white/10 bg-[#111113]/90 px-3 py-2 text-xs backdrop-blur"><span className="font-semibold">Select a location</span><p className="mt-1 text-zinc-500">Click the map to place your report marker.</p></div><MapCanvas viewport={{ latitude: env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE, longitude: env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE, zoom: env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM }} attribution={env.NEXT_PUBLIC_MAP_ATTRIBUTION} styleUrl={env.NEXT_PUBLIC_MAP_STYLE_URL} layers={layers} location={location} onMapLocationSelect={pickMapLocation} /></section></main>;
}

function FormSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) { return <section className="mt-6 border-t border-white/[.06] pt-5"><h2 className="text-sm font-semibold"><span className="mr-2 text-zinc-500">{number}.</span>{title}</h2><div className="mt-3">{children}</div></section>; }
