"use client";

import Link from "next/link";
import { BookmarkPlus, LocateFixed, MapPinned, Search, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { MapCanvas, type MapLayerState } from "@/features/map/map-canvas";
import { useReportMapQuery } from "@/features/map/queries";
import { parseCoordinate, serializeCoordinate } from "@/features/map/types";
import type { ReportMapDto } from "@/lib/api/contracts";
import { loadClientEnvironment } from "@/lib/env/client";
import { readBrowserJson, writeBrowserJson } from "@/lib/storage/browser-storage";

type SessionSavedArea = { id: string; name: string; latitude: number; longitude: number; radiusMetres: number; createdAt: string };
type PreviewLocation = { latitude: number; longitude: number };
const storageKey = "floodready.saved-areas";
const reportRadiusMetres = 2_000;
const previewLayers: MapLayerState = { roads: false, markers: false, heatmap: false, shelters: false, weather: false, traffic: false };

function distanceMetres(latitude: number, longitude: number, report: ReportMapDto): number {
  const radians = Math.PI / 180;
  const dLat = (report.latitude - latitude) * radians;
  const dLng = (report.longitude - longitude) * radians;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(latitude * radians) * Math.cos(report.latitude * radians) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function reportQuery(latitude: number, longitude: number): string {
  const latitudeDelta = reportRadiusMetres / 111_320;
  const longitudeDelta = reportRadiusMetres / Math.max(1, 111_320 * Math.cos(latitude * Math.PI / 180));
  return `?${new URLSearchParams({ west: serializeCoordinate(Math.max(-180, longitude - longitudeDelta)), south: serializeCoordinate(Math.max(-85.051128, latitude - latitudeDelta)), east: serializeCoordinate(Math.min(180, longitude + longitudeDelta)), north: serializeCoordinate(Math.min(85.051128, latitude + latitudeDelta)), limit: "100", sort: "desc" }).toString()}`;
}

function SavedAreaCard({ area, onRemove }: { area: SessionSavedArea; onRemove: (id: string) => void }) {
  const query = useReportMapQuery(reportQuery(area.latitude, area.longitude));
  const reportsInRadius = useMemo(() => (query.data?.items ?? []).filter((report) => distanceMetres(area.latitude, area.longitude, report) <= reportRadiusMetres).length, [area.latitude, area.longitude, query.data?.items]);
  return <article className="rounded-2xl border border-white/[.08] bg-white/[.025] p-5"><MapPinned className="size-5 text-blue-300" /><h2 className="mt-3 font-semibold">{area.name}</h2><p className="mt-2 font-mono text-xs text-zinc-400">{area.latitude.toFixed(5)}, {area.longitude.toFixed(5)} · {area.radiusMetres} m</p><p className="mt-2 text-xs text-zinc-500">Saved {new Date(area.createdAt).toLocaleString()}</p><div className="mt-4 rounded-xl border border-blue-300/20 bg-blue-500/[.06] px-3 py-3"><p className="text-xs text-zinc-400">Reports within 2 km</p><p className="mt-1 text-xl font-semibold">{query.isLoading ? "..." : query.isError ? "Unavailable" : reportsInRadius}</p><p className="mt-1 text-[11px] text-zinc-500">Authenticated submitted reports around this saved place</p></div><div className="mt-5 flex gap-2"><Link href={`/map?lat=${serializeCoordinate(area.latitude)}&lng=${serializeCoordinate(area.longitude)}`} className="min-h-10 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-950">Open map</Link><button type="button" aria-label={`Remove ${area.name}`} onClick={() => onRemove(area.id)} className="grid size-10 place-items-center rounded-lg border border-white/15"><Trash2 className="size-4" /></button></div></article>;
}

export function SavedAreasPage() {
  const environment = loadClientEnvironment();
  const [areas, setAreas] = useState<SessionSavedArea[]>([]);
  const [name, setName] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo<PreviewLocation | null>(() => {
    const parsedLatitude = parseCoordinate(latitude, -85.051128, 85.051128);
    const parsedLongitude = parseCoordinate(longitude, -180, 180);
    return parsedLatitude === null || parsedLongitude === null ? null : { latitude: parsedLatitude, longitude: parsedLongitude };
  }, [latitude, longitude]);
  useEffect(() => { setAreas(readBrowserJson<SessionSavedArea[]>(storageKey) ?? []); }, []);
  function persist(next: SessionSavedArea[]) { setAreas(next); writeBrowserJson(storageKey, next); }
  function useLocation() {
    if (!navigator.geolocation) { setError("This browser does not provide location access."); return; }
    navigator.geolocation.getCurrentPosition((position) => { setLatitude(serializeCoordinate(position.coords.latitude)); setLongitude(serializeCoordinate(position.coords.longitude)); setError(null); }, () => setError("Location access was not granted. Enter coordinates or search for a place instead."), { maximumAge: 60_000, timeout: 10_000 });
  }
  async function searchPlace() {
    const value = placeQuery.trim();
    if (value.length < 2) { setError("Enter a place, locality, landmark, or postcode to search."); return; }
    setIsSearching(true); setError(null);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`, { headers: { Accept: "application/json" } });
      const body = await response.json() as { name?: string; latitude?: number; longitude?: number; message?: string };
      if (!response.ok || typeof body.latitude !== "number" || typeof body.longitude !== "number") throw new Error(body.message ?? "Place search could not be completed.");
      setLatitude(serializeCoordinate(body.latitude)); setLongitude(serializeCoordinate(body.longitude));
      if (name.trim().length < 2 && typeof body.name === "string") setName(body.name.split(",")[0] ?? body.name);
    } catch (searchError) { setError(searchError instanceof Error ? searchError.message : "Place search could not be completed."); } finally { setIsSearching(false); }
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2 || preview === null) { setError("Enter an area name and valid coordinates, or search for a place first."); return; }
    persist([...areas, { id: crypto.randomUUID(), name: name.trim(), latitude: preview.latitude, longitude: preview.longitude, radiusMetres: 800, createdAt: new Date().toISOString() }]);
    setName(""); setPlaceQuery(""); setLatitude(""); setLongitude(""); setError(null);
  }
  function remove(id: string) { persist(areas.filter((area) => area.id !== id)); }
  return <main className="mx-auto max-w-5xl px-5 py-8"><header><p className="text-xs font-semibold tracking-[.18em] text-blue-300">SAVED WATCH AREAS</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Saved Areas</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Save locations in this browser for quick map access. They persist across navigation and refreshes; account sync and push notifications are not enabled.</p></header><section className="mt-6"><form onSubmit={add} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><BookmarkPlus className="size-4 text-blue-300" />Save a map location</h2><button type="button" onClick={useLocation} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold"><LocateFixed className="size-4" />Use current location</button></div><div className="mt-4 flex gap-2"><label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3"><Search className="size-4 text-zinc-500" /><input aria-label="Search place to save" value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search a place, locality, landmark, or postcode" /></label><button type="button" onClick={() => void searchPlace()} disabled={isSearching} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white disabled:opacity-60"><Search className="size-4" />{isSearching ? "Searching..." : "Find place"}</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm text-zinc-300">Name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/10 px-3" placeholder="Home" /></label><div className="text-sm text-zinc-300">Watch radius<span className="mt-1 flex min-h-11 items-center rounded-xl border border-white/10 bg-black/10 px-3 text-sm text-zinc-500">800 m shortcut · reports counted within 2 km</span></div><label className="text-sm text-zinc-300">Latitude<input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/10 px-3" placeholder="28.374" /></label><label className="text-sm text-zinc-300">Longitude<input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/10 px-3" placeholder="77.045" /></label></div>{error !== null ? <p role="alert" className="mt-3 text-sm text-red-200">{error}</p> : null}{preview !== null ? <section className="mt-5 overflow-hidden rounded-xl border border-white/[.08]"><div className="border-b border-white/[.08] px-4 py-3 text-sm"><p className="font-semibold">Preview before saving</p><p className="mt-1 text-xs text-zinc-400">{preview.latitude.toFixed(5)}, {preview.longitude.toFixed(5)}</p></div><div className="h-56"><MapCanvas viewport={{ latitude: preview.latitude, longitude: preview.longitude, zoom: 14 }} attribution={environment.NEXT_PUBLIC_MAP_ATTRIBUTION} styleUrl={environment.NEXT_PUBLIC_MAP_STYLE_URL} location={preview} layers={previewLayers} /></div></section> : <p className="mt-4 text-sm text-zinc-500">Search for a place, enter coordinates, or use your current location to open a preview.</p>}<button type="submit" disabled={preview === null} className="mt-4 min-h-11 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Save area</button></form></section><section className="mt-6 grid gap-4 sm:grid-cols-2">{areas.map((area) => <SavedAreaCard key={area.id} area={area} onRemove={remove} />)}{areas.length === 0 ? <p className="rounded-2xl border border-white/[.08] p-6 text-sm text-zinc-400">No areas are saved yet. Add one above to create a quick map shortcut.</p> : null}</section></main>;
}
