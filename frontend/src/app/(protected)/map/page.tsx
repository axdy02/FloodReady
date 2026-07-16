"use client";

import Link from "next/link";
import { AlertTriangle, Camera, Layers3, RefreshCw, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { isProtectedState } from "@/features/auth/auth-machine";
import { type MapLayerState, MapCanvas } from "@/features/map/map-canvas";
import { usePublicMapIncidentsQuery, useReportMapQuery } from "@/features/map/queries";
import { parseCoordinate, serializeCoordinate } from "@/features/map/types";
import { useReportQuery } from "@/features/reports/queries";
import type { IncidentDto, ReportMapDto } from "@/lib/api/contracts";
import { loadClientEnvironment } from "@/lib/env/client";

const defaultLayers: MapLayerState = { roads: false, markers: true, heatmap: false, shelters: false, weather: false, traffic: false };
const emptyReports: readonly ReportMapDto[] = [];
const emptyIncidents: readonly IncidentDto[] = [];

function label(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());
}

function isPending(report: ReportMapDto): boolean {
  return report.aiAnalysis === null || report.aiAnalysis.status === "PROCESSING";
}

function aiAssessment(report: ReportMapDto): string {
  if (isPending(report)) return "Validating…";
  const severity = report.aiAnalysis?.suggestedSeverity;
  return severity === null || severity === undefined ? "Manual review required" : label(severity);
}

function MapLegend() {
  const entries = [
    ["#94a3b8", "?", "AI validation in progress"],
    ["#facc15", "", "Minor"],
    ["#f59e0b", "", "Moderate"],
    ["#ef4444", "", "Severe / impassable"]
  ] as const;

  return <aside aria-label="Flood severity legend" className="pointer-events-auto absolute bottom-6 left-4 rounded-2xl border border-white/10 bg-[#111113]/95 p-4 text-xs shadow-2xl backdrop-blur-xl sm:left-6">
    <p className="font-semibold text-zinc-100">Severity</p>
    <ul className="mt-3 space-y-2">
      {entries.map(([color, symbol, text]) => <li key={text} className="flex items-center gap-2.5 text-zinc-300">
        <span aria-hidden="true" style={{ backgroundColor: color }} className="inline-grid size-4 place-items-center rounded-full border border-white/80 text-[10px] font-bold text-slate-950">{symbol}</span>
        {text}
      </li>)}
    </ul>
  </aside>;
}

function SubmittedReportDetails({ report, onClose }: { report: ReportMapDto; onClose: () => void }) {
  const detail = useReportQuery(report.canViewDetails ? report.id : "");

  return <aside aria-label="Report details" className="pointer-events-auto absolute bottom-6 right-4 w-[min(25rem,calc(100%-2rem))] rounded-2xl border border-white/10 bg-[#111113]/95 p-5 shadow-2xl backdrop-blur-xl">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold tracking-[.16em] text-blue-300">SUBMITTED REPORT</p>
        <h2 className="mt-1 font-semibold">{label(report.category)}</h2>
      </div>
      <button type="button" aria-label="Close report details" onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-white/[.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"><X className="size-4" /></button>
    </div>
    <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
      <div><dt className="text-zinc-500">Your severity</dt><dd className="mt-1 font-semibold">{label(report.severityClaim)}</dd></div>
      <div><dt className="text-zinc-500">AI assessment</dt><dd className="mt-1 font-semibold">{aiAssessment(report)}</dd></div>
      <div><dt className="text-zinc-500">Validation</dt><dd className="mt-1 font-semibold">{isPending(report) ? "AI validation in progress" : report.aiAnalysis?.status === "SUCCEEDED" ? "Completed" : "Could not complete"}</dd></div>
      <div><dt className="text-zinc-500">Submitted</dt><dd className="mt-1">{new Date(report.submittedAt).toLocaleString()}</dd></div>
    </dl>
    {detail.data ? <p className="mt-4 border-t border-white/10 pt-3 text-sm leading-6 text-zinc-300">{detail.data.description}</p> : detail.isLoading ? <p className="mt-4 text-xs text-zinc-500">Loading report details…</p> : null}
    <Link href="/reports" className="mt-4 inline-flex text-xs font-semibold text-blue-300 underline underline-offset-4">View in My Reports</Link>
  </aside>;
}

function PublicIncidentDetails({ incident, onClose }: { incident: IncidentDto; onClose: () => void }) {
  return <aside aria-label="Public incident details" className="pointer-events-auto absolute bottom-6 right-4 w-[min(25rem,calc(100%-2rem))] rounded-2xl border border-white/10 bg-[#111113]/95 p-5 shadow-2xl backdrop-blur-xl">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold tracking-[.16em] text-blue-300">PUBLIC INCIDENT</p>
        <h2 className="mt-1 font-semibold">{label(incident.category)}</h2>
      </div>
      <button type="button" aria-label="Close public incident details" onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-white/[.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"><X className="size-4" /></button>
    </div>
    <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
      <div><dt className="text-zinc-500">Severity</dt><dd className="mt-1 font-semibold">{label(incident.severity)}</dd></div>
      <div><dt className="text-zinc-500">Status</dt><dd className="mt-1 font-semibold">{label(incident.status)}</dd></div>
      <div><dt className="text-zinc-500">Linked reports</dt><dd className="mt-1 font-semibold">{incident.reportCount}</dd></div>
      <div><dt className="text-zinc-500">Last reported</dt><dd className="mt-1">{new Date(incident.lastReportedAt).toLocaleString()}</dd></div>
    </dl>
    <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-zinc-400">Public map markers are backend incidents. Sign in to browse individual submitted reports and their AI validation details.</p>
    <Link href="/login?returnTo=%2Fmap" className="mt-4 inline-flex text-xs font-semibold text-blue-300 underline underline-offset-4">Sign in for report details</Link>
  </aside>;
}

export default function MapPage() {
  const env = loadClientEnvironment();
  const params = useSearchParams();
  const auth = useAuth();
  const isSignedIn = isProtectedState(auth);
  const latitude = parseCoordinate(params.get("lat") ?? "", -85.051128, 85.051128) ?? env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE;
  const longitude = parseCoordinate(params.get("lng") ?? "", -180, 180) ?? env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE;
  const query = useMemo(() => {
    const west = Math.max(-180, longitude - 0.45);
    const east = Math.min(180, longitude + 0.45);
    const south = Math.max(-90, latitude - 0.45);
    const north = Math.min(90, latitude + 0.45);
    return `?west=${serializeCoordinate(west)}&south=${serializeCoordinate(south)}&east=${serializeCoordinate(east)}&north=${serializeCoordinate(north)}&limit=100&sort=desc`;
  }, [latitude, longitude]);
  const reportsQuery = useReportMapQuery(query);
  const publicIncidentsQuery = usePublicMapIncidentsQuery(query, !isSignedIn && auth.kind !== "RESTORING");
  const [layers, setLayers] = useState<MapLayerState>(defaultLayers);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("report"));
  const reports = reportsQuery.data?.items ?? emptyReports;
  const publicIncidents = publicIncidentsQuery.data?.items ?? emptyIncidents;
  const mapItems: readonly (ReportMapDto | IncidentDto)[] = isSignedIn ? reports : publicIncidents;
  const activeQuery = isSignedIn ? reportsQuery : publicIncidentsQuery;
  const selectedReport = isSignedIn ? reports.find((report) => report.id === selectedId) ?? null : null;
  const selectedPublicIncident = !isSignedIn ? publicIncidents.find((incident) => incident.id === selectedId) ?? null : null;
  const mapTitle = isSignedIn ? "Flood reports map" : "Public incident map";

  return <main className="relative h-[calc(100vh-4rem)] min-h-[42rem] overflow-hidden">
    <MapCanvas
      viewport={{ latitude, longitude, zoom: params.get("lat") === null ? env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM : 14 }}
      attribution={env.NEXT_PUBLIC_MAP_ATTRIBUTION}
      styleUrl={env.NEXT_PUBLIC_MAP_STYLE_URL}
      incidents={mapItems}
      layers={layers}
      selectedIncidentId={selectedId}
      onIncidentSelect={setSelectedId}
    />
    <div className="pointer-events-none absolute inset-0 p-4 sm:p-6">
      <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111113]/95 p-4 shadow-2xl backdrop-blur-xl">
        <div>
          <h1 className="text-lg font-semibold">{mapTitle}</h1>
          {isSignedIn ? <p className="mt-1 text-xs text-zinc-400">Authenticated report markers are shown immediately; grey <span aria-label="AI validation in progress" className="inline-grid size-4 place-items-center rounded-full bg-slate-400 font-bold text-slate-950">?</span> markers are still being validated. Blue numbered rings are frontend-only visual groups, not backend incidents.</p> : <p className="mt-1 text-xs text-zinc-400">This public map uses the backend Incident API. Sign in to browse individual report markers and AI validation details.</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" aria-pressed={layers.heatmap} onClick={() => setLayers((current) => ({ ...current, heatmap: !current.heatmap }))} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${layers.heatmap ? "border-blue-300/40 bg-blue-500/20 text-blue-100" : "border-white/10 text-zinc-100 hover:bg-white/[.05]"}`}><Layers3 className="size-4" />Density</button>
          <button type="button" onClick={() => void activeQuery.refetch()} disabled={activeQuery.isFetching || auth.kind === "RESTORING"} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-white/[.05] disabled:opacity-60"><RefreshCw className={`size-4 ${activeQuery.isFetching ? "animate-spin" : ""}`} />Refresh</button>
          <Link href="/reports/new" className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-400"><Camera className="size-4" />Submit report</Link>
        </div>
      </header>

      <div className="pointer-events-none mt-3 max-w-sm">
        {auth.kind === "RESTORING" ? <p role="status" className="rounded-xl border border-white/10 bg-[#111113]/95 px-3 py-2 text-sm text-zinc-300">Checking your session before loading map data…</p> : null}
        {auth.kind !== "RESTORING" && activeQuery.isLoading ? <p role="status" className="rounded-xl border border-white/10 bg-[#111113]/95 px-3 py-2 text-sm text-zinc-300">Loading {isSignedIn ? "reports" : "public incidents"}…</p> : null}
        {auth.kind !== "RESTORING" && activeQuery.isError ? <div role="alert" className="pointer-events-auto rounded-xl border border-red-400/30 bg-[#1a1012]/95 p-3 text-sm text-red-100"><p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" />Could not load {isSignedIn ? "reports" : "public incidents"}</p><button type="button" onClick={() => void activeQuery.refetch()} className="mt-2 rounded-lg border border-red-300/30 px-2 py-1 text-xs text-red-100 hover:bg-red-400/10">Retry</button></div> : null}
        {auth.kind !== "RESTORING" && !activeQuery.isLoading && !activeQuery.isError ? <p className="inline-block rounded-xl border border-white/10 bg-[#111113]/95 px-3 py-2 text-xs text-zinc-300">{mapItems.length === 0 ? isSignedIn ? "No submitted reports were returned for this loaded search area." : "No public incidents were returned for this loaded search area." : `${mapItems.length} ${isSignedIn ? `persisted report${mapItems.length === 1 ? "" : "s"}` : `public incident${mapItems.length === 1 ? "" : "s"}`} in this area`}</p> : null}
      </div>

      <MapLegend />
      {selectedReport !== null ? <SubmittedReportDetails report={selectedReport} onClose={() => setSelectedId(null)} /> : null}
      {selectedPublicIncident !== null ? <PublicIncidentDetails incident={selectedPublicIncident} onClose={() => setSelectedId(null)} /> : null}
    </div>
  </main>;
}
