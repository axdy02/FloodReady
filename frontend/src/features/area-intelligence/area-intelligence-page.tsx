"use client";

import Link from "next/link";
import { LocateFixed, MapPinned, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { MapCanvas, type MapLayerState } from "@/features/map/map-canvas";
import { useReportMapQuery } from "@/features/map/queries";
import { parseCoordinate, serializeCoordinate } from "@/features/map/types";
import type { ReportMapDto } from "@/lib/api/contracts";
import { loadClientEnvironment } from "@/lib/env/client";

const radiusMetres = 2_000;
const previewLayers: MapLayerState = { roads: false, markers: true, heatmap: false, shelters: false, weather: false, traffic: false };
type AreaCenter = { name: string; latitude: number; longitude: number };
type AreaWeather = { location: { latitude: number; longitude: number; timezone: string }; current: { temperatureC: number; precipitationMm: number; weatherCode: number; isRaining: boolean }; recent: { precipitationMm: number; lastRainAt: string | null }; forecast: Array<{ date: string; temperatureMaxC: number | null; temperatureMinC: number | null; precipitationMm: number; precipitationProbability: number; weatherCode: number }> };

const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());
const weatherLabel = (code: number): string => code === 0 ? "Clear" : [1, 2, 3].includes(code) ? "Partly cloudy" : [45, 48].includes(code) ? "Foggy" : [51, 53, 55, 56, 57].includes(code) ? "Drizzle" : [61, 63, 65, 66, 67, 80, 81, 82].includes(code) ? "Rain showers" : [95, 96, 99].includes(code) ? "Thunderstorms" : "Mixed conditions";
const formatDate = (value: string | null): string => value === null ? "No recent rain recorded" : new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function parseCoordinateQuery(value: string): AreaCenter | null {
  const [latitudeText, longitudeText, ...rest] = value.split(/[ ,]+/u).filter(Boolean);
  if (rest.length > 0 || latitudeText === undefined || longitudeText === undefined) return null;
  const latitude = parseCoordinate(latitudeText, -85.051128, 85.051128);
  const longitude = parseCoordinate(longitudeText, -180, 180);
  return latitude === null || longitude === null ? null : { name: "Selected coordinates", latitude, longitude };
}

function distanceMetres(from: AreaCenter, latitude: number, longitude: number): number {
  const radians = Math.PI / 180;
  const latitudeDifference = (latitude - from.latitude) * radians;
  const longitudeDifference = (longitude - from.longitude) * radians;
  const a = Math.sin(latitudeDifference / 2) ** 2 + Math.cos(from.latitude * radians) * Math.cos(latitude * radians) * Math.sin(longitudeDifference / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function reportQuery(center: AreaCenter | null): string {
  if (center === null) return "";
  const latitudeDelta = radiusMetres / 111_320;
  const longitudeDelta = radiusMetres / Math.max(1, 111_320 * Math.cos(center.latitude * Math.PI / 180));
  return `?${new URLSearchParams({ west: serializeCoordinate(Math.max(-180, center.longitude - longitudeDelta)), south: serializeCoordinate(Math.max(-85.051128, center.latitude - latitudeDelta)), east: serializeCoordinate(Math.min(180, center.longitude + longitudeDelta)), north: serializeCoordinate(Math.min(85.051128, center.latitude + latitudeDelta)), limit: "100", sort: "desc" }).toString()}`;
}

function effectiveSeverity(report: ReportMapDto): string { return report.aiAnalysis?.suggestedSeverity ?? report.finalSeverity; }
function passability(reports: number, severe: number, raining: boolean, forecastRain: number): string { return severe >= 2 || (severe > 0 && raining) ? "Difficult" : severe > 0 || reports >= 5 || forecastRain >= 5 ? "Use caution" : "Generally passable"; }

function Stat({ label: title, value }: { label: string; value: string | number }) {
  return <article className="rounded-xl border border-white/[.08] bg-white/[.025] p-4"><p className="text-xs text-zinc-500">{title}</p><p className="mt-2 text-xl font-semibold">{value}</p></article>;
}

function AreaSummary({ center, reports, severeCount, weather, loading, error }: { center: AreaCenter; reports: ReportMapDto[]; severeCount: number; weather: AreaWeather | null; loading: boolean; error: string | null }) {
  const forecast = weather?.forecast[1] ?? weather?.forecast[0];
  const status = weather === null ? "Waiting for weather" : passability(reports.length, severeCount, weather.current.isRaining, forecast?.precipitationMm ?? 0);
  return <section className="mt-5 rounded-2xl border border-blue-300/20 bg-blue-500/[.06] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[.14em] text-blue-200">AI AREA SUMMARY</p><h2 className="mt-2 text-lg font-semibold">{center.name}</h2><p className="mt-1 text-xs text-zinc-400">Weather forecast + nearby reports · advisory only</p></div><span className="rounded-full border border-blue-300/25 px-3 py-1 text-xs font-semibold text-blue-100">2 km context</span></div>{loading ? <p role="status" className="mt-4 text-sm text-zinc-300">Checking current conditions and the next 7 days...</p> : error !== null ? <p role="alert" className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-sm text-amber-100">{error} Nearby report results are still available.</p> : weather === null ? null : <><p className="mt-4 text-sm leading-6 text-zinc-200">{weather.current.isRaining ? "Rain is currently falling" : weather.recent.precipitationMm > 0.1 ? "Recent rain was detected" : "No meaningful rain was recorded in the last two days"} around {center.name}. There are {reports.length} submitted reports within 2 km, so road conditions are <span className="font-semibold">{status.toLowerCase()}</span>. {forecast !== undefined && forecast.precipitationProbability >= 50 ? "Rain remains possible in the near-term forecast." : "The near-term forecast is relatively dry."}</p><div className="mt-4 grid gap-3 sm:grid-cols-4"><Stat label="Temperature now" value={`${weather.current.temperatureC.toFixed(1)} °C`} /><Stat label="Current weather" value={weatherLabel(weather.current.weatherCode)} /><Stat label="Rain last 48 h" value={`${weather.recent.precipitationMm.toFixed(1)} mm`} /><Stat label="Road passability" value={status} /></div><div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"><div className="rounded-xl border border-white/[.08] p-4"><p className="text-xs text-zinc-500">Last rain recorded</p><p className="mt-2 text-sm font-semibold">{formatDate(weather.recent.lastRainAt)}</p><p className="mt-3 text-xs leading-5 text-zinc-500">Weather provider timezone: {weather.location.timezone}</p></div><div className="rounded-xl border border-white/[.08] p-4"><p className="text-xs font-semibold text-zinc-300">7-day weather outlook</p><div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">{weather.forecast.slice(0, 7).map((day) => <div key={day.date} className="rounded-lg bg-black/20 p-2 text-xs"><p className="font-semibold">{new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</p><p className="mt-1 text-zinc-300">{weatherLabel(day.weatherCode)}</p><p className="mt-1 text-zinc-500">{day.temperatureMinC?.toFixed(0)}–{day.temperatureMaxC?.toFixed(0)} °C</p><p className="mt-1 text-blue-200">{day.precipitationProbability}% rain · {day.precipitationMm.toFixed(1)} mm</p></div>)}</div></div></div></> }</section>;
}

export function AreaIntelligencePage() {
  const environment = loadClientEnvironment();
  const [query, setQuery] = useState("");
  const [center, setCenter] = useState<AreaCenter | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [weather, setWeather] = useState<AreaWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const reportsQuery = useReportMapQuery(reportQuery(center));
  const reports = useMemo(() => center === null ? [] : (reportsQuery.data?.items ?? []).filter((report) => distanceMetres(center, report.latitude, report.longitude) <= radiusMetres), [center, reportsQuery.data?.items]);
  const severeCount = useMemo(() => reports.filter((report) => ["SEVERE", "IMPASSABLE"].includes(effectiveSeverity(report))).length, [reports]);
  const validatingCount = useMemo(() => reports.filter((report) => report.aiAnalysis === null || report.aiAnalysis.status === "PROCESSING").length, [reports]);
  const mapHref = center === null ? "/map" : `/map?lat=${serializeCoordinate(center.latitude)}&lng=${serializeCoordinate(center.longitude)}`;

  useEffect(() => {
    if (center === null) { setWeather(null); setWeatherError(null); setWeatherLoading(false); return; }
    const controller = new AbortController();
    setWeather(null); setWeatherError(null); setWeatherLoading(true);
    fetch(`/api/weather?lat=${serializeCoordinate(center.latitude)}&lng=${serializeCoordinate(center.longitude)}`, { headers: { Accept: "application/json" }, signal: controller.signal }).then(async (response) => {
      const body = await response.json() as AreaWeather & { message?: string };
      if (!response.ok) throw new Error(body.message ?? "Weather data could not be loaded.");
      setWeather(body);
    }).catch((error: unknown) => { if (!controller.signal.aborted) setWeatherError(error instanceof Error ? error.message : "Weather data could not be loaded."); }).finally(() => { if (!controller.signal.aborted) setWeatherLoading(false); });
    return () => controller.abort();
  }, [center]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (value.length === 0) { setSearchError("Enter an area name or latitude, longitude."); return; }
    const coordinates = parseCoordinateQuery(value);
    if (coordinates !== null) { setCenter(coordinates); setSearchError(null); return; }
    setIsSearching(true); setSearchError(null);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`, { headers: { Accept: "application/json" } });
      const body = await response.json() as { name?: string; latitude?: number; longitude?: number; message?: string };
      if (!response.ok || typeof body.name !== "string" || typeof body.latitude !== "number" || typeof body.longitude !== "number") throw new Error(body.message ?? "Area search could not be completed.");
      setCenter({ name: body.name, latitude: body.latitude, longitude: body.longitude });
    } catch (error) { setSearchError(error instanceof Error ? error.message : "Area search could not be completed."); } finally { setIsSearching(false); }
  }

  function useLocation() {
    if (!navigator.geolocation) { setSearchError("This browser does not provide location access."); return; }
    navigator.geolocation.getCurrentPosition((position) => { setCenter({ name: "Current location", latitude: position.coords.latitude, longitude: position.coords.longitude }); setQuery("Current location"); setSearchError(null); }, () => setSearchError("Location access was not granted. You can still search for an area."), { maximumAge: 60_000, timeout: 10_000 });
  }

  return <main className="mx-auto max-w-6xl px-5 py-8"><header><p className="text-xs font-semibold tracking-[.18em] text-blue-300">AREA INTELLIGENCE</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Area Intelligence</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Search for a place, then review submitted reports and a weather-aware area summary within a 2 km radius.</p></header><form onSubmit={submit} className="mt-6 flex flex-wrap gap-2"><label className="flex min-h-11 min-w-[16rem] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3"><Search className="size-4 text-zinc-500" /><input aria-label="Search area" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Area, landmark, or latitude, longitude" className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600" /></label><button type="submit" disabled={isSearching} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white disabled:opacity-60"><Search className={`size-4 ${isSearching ? "animate-pulse" : ""}`} />{isSearching ? "Searching..." : "Search"}</button><button type="button" onClick={useLocation} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold"><LocateFixed className="size-4" />Use current location</button>{center !== null ? <button type="button" onClick={() => void reportsQuery.refetch()} disabled={reportsQuery.isFetching} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold disabled:opacity-60"><RefreshCw className={`size-4 ${reportsQuery.isFetching ? "animate-spin" : ""}`} />Refresh</button> : null}</form>{searchError !== null ? <p role="alert" className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{searchError}</p> : null}{center !== null ? <><section className="mt-6 overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.025]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] px-5 py-4"><div><h2 className="font-semibold">{center.name}</h2><p className="mt-1 text-xs text-zinc-400">Live report preview · 2 km radius · {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}</p></div><Link href={mapHref} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold"><MapPinned className="size-4" />Open full map</Link></div><div className="h-72"><MapCanvas viewport={{ latitude: center.latitude, longitude: center.longitude, zoom: 14 }} attribution={environment.NEXT_PUBLIC_MAP_ATTRIBUTION} styleUrl={environment.NEXT_PUBLIC_MAP_STYLE_URL} incidents={reports} location={{ latitude: center.latitude, longitude: center.longitude }} layers={previewLayers} /></div></section><section className="mt-5 grid gap-3 sm:grid-cols-3"><Stat label="Reports within 2 km" value={reports.length} /><Stat label="Severe / impassable" value={severeCount} /><Stat label="Still validating" value={validatingCount} /></section><AreaSummary center={center} reports={reports} severeCount={severeCount} weather={weather} loading={weatherLoading} error={weatherError} />{reportsQuery.isLoading ? <p role="status" className="mt-5 text-sm text-zinc-400">Loading nearby reports...</p> : null}{reportsQuery.isError ? <p role="alert" className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">Nearby reports could not be loaded. Retry when Backend 1 is ready.</p> : null}<section className="mt-5 rounded-2xl border border-white/[.08] bg-white/[.025] p-5"><h2 className="font-semibold">Reports in this area</h2>{!reportsQuery.isLoading && !reportsQuery.isError && reports.length === 0 ? <p className="mt-4 rounded-xl border border-white/[.08] p-4 text-sm text-zinc-400">No submitted reports were found within 2 km of this area.</p> : <ul className="mt-4 space-y-3">{reports.map((report) => <li key={report.id} className="rounded-xl border border-white/[.08] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><span className="font-semibold">{label(report.category)}</span><span className="rounded-full border border-white/10 px-2 py-1 text-xs font-semibold">{label(effectiveSeverity(report))}</span></div><p className="mt-2 text-xs text-zinc-400">{Math.round(distanceMetres(center, report.latitude, report.longitude))} m away · submitted {new Date(report.submittedAt).toLocaleString()}</p><Link href={`/map?lat=${serializeCoordinate(report.latitude)}&lng=${serializeCoordinate(report.longitude)}&report=${report.id}`} className="mt-3 inline-flex text-xs font-semibold text-blue-300 underline underline-offset-4">View report on map</Link></li>)}</ul>}</section></> : <section className="mt-6 rounded-xl border border-white/[.08] bg-white/[.025] p-6 text-sm text-zinc-400"><TriangleAlert className="mb-3 size-5 text-amber-300" />Search for an area or use your location to open a 2 km report preview.</section>}</main>;
}
