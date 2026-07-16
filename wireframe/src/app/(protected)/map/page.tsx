"use client";

import Link from "next/link";
import { AlertTriangle, Camera, MapPin, RefreshCw, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { type MapLayerState, MapCanvas } from "@/features/map/map-canvas";
import { useReportDetailQuery, useReportMapQuery } from "@/features/map/queries";
import { SafetyNotice } from "@/features/map/safety-notice";
import { parseCoordinate, serializeCoordinate } from "@/features/map/types";
import type { ReportMapDto } from "@/lib/api/contracts";
import { loadClientEnvironment } from "@/lib/env/client";

const layers: MapLayerState = { roads: false, markers: true, heatmap: false, shelters: false, weather: false, traffic: false };
const emptyReports: readonly ReportMapDto[] = [];

function label(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());
}

export default function MapPage() {
  const env = loadClientEnvironment();
  const params = useSearchParams();
  const requestedLatitude = parseCoordinate(params.get("lat") ?? "", -85.051128, 85.051128);
  const requestedLongitude = parseCoordinate(params.get("lng") ?? "", -180, 180);
  const center = {
    latitude: requestedLatitude ?? env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE,
    longitude: requestedLongitude ?? env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE,
  };
  const query = useMemo(() => {
    const west = Math.max(-180, center.longitude - 0.45);
    const east = Math.min(180, center.longitude + 0.45);
    const south = Math.max(-90, center.latitude - 0.45);
    const north = Math.min(90, center.latitude + 0.45);
    return `?west=${serializeCoordinate(west)}&south=${serializeCoordinate(south)}&east=${serializeCoordinate(east)}&north=${serializeCoordinate(north)}&limit=100&sort=desc`;
  }, [center.latitude, center.longitude]);
  const reportsQuery = useReportMapQuery(query);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("report"));
  const reports = reportsQuery.data?.items ?? emptyReports;
  const selectedReport = reports.find((report) => report.id === selectedId) ?? null;
  const detailQuery = useReportDetailQuery(selectedId, selectedReport?.canViewDetails === true);

  return <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-semibold text-slate-950">Reports Map</h1><p className="mt-1 text-sm text-slate-600">Persisted flood reports returned by the Report API.</p><div className="mt-3 max-w-xl"><SafetyNotice /></div></div>
      <div className="flex gap-2"><button type="button" onClick={() => void reportsQuery.refetch()} disabled={reportsQuery.isFetching} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-60"><RefreshCw className={`size-4 ${reportsQuery.isFetching ? "animate-spin" : ""}`} />Refresh</button><Link href="/reports/new" className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"><Camera className="size-4" />Submit Flood Report</Link></div>
    </header>

    <section className="relative h-[calc(100vh-12rem)] min-h-[32rem] overflow-hidden rounded-lg border border-slate-300 bg-slate-100">
      <MapCanvas viewport={{ ...center, zoom: requestedLatitude === null ? env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM : 14 }} attribution={env.NEXT_PUBLIC_MAP_ATTRIBUTION} styleUrl={env.NEXT_PUBLIC_MAP_STYLE_URL} incidents={reports} layers={layers} selectedIncidentId={selectedId} onIncidentSelect={setSelectedId} />

      <div className="pointer-events-none absolute left-3 top-3 max-w-sm">
        {reportsQuery.isLoading ? <p role="status" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow">Loading persisted reports…</p> : null}
        {reportsQuery.isError ? <div role="alert" className="pointer-events-auto rounded-md border border-red-300 bg-white p-3 text-sm text-red-800 shadow"><p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" />Could not load reports</p><p className="mt-1">Check the backend connection, then retry.</p><button type="button" onClick={() => void reportsQuery.refetch()} className="mt-2 rounded border border-red-300 px-2 py-1 font-medium">Retry</button></div> : null}
        {!reportsQuery.isLoading && !reportsQuery.isError && reports.length === 0 ? <p role="status" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow">No reports exist in this map area yet. Submit the first report.</p> : null}
        {!reportsQuery.isLoading && !reportsQuery.isError && reports.length > 0 ? <p className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow"><strong>{reports.length}</strong> persisted {reports.length === 1 ? "report" : "reports"} in this area</p> : null}
      </div>

      {selectedReport !== null ? <aside aria-label="Report marker details" className="absolute bottom-3 right-3 w-[min(24rem,calc(100%-1.5rem))] rounded-lg border border-slate-300 bg-white p-4 text-slate-900 shadow-xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-sky-700">Stored report</p><h2 className="mt-1 font-semibold">{label(selectedReport.category)}</h2></div><button type="button" aria-label="Close report details" onClick={() => setSelectedId(null)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button></div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Reported severity</dt><dd className="font-semibold">{label(selectedReport.severityClaim)}</dd></div><div><dt className="text-xs text-slate-500">Status</dt><dd className="font-semibold">{label(selectedReport.verificationStatus)}</dd></div>{selectedReport.aiAnalysis?.validationScore !== null && selectedReport.aiAnalysis?.validationScore !== undefined ? <><div><dt className="text-xs text-slate-500">AI validation score</dt><dd className="font-semibold text-sky-800">{Math.round(selectedReport.aiAnalysis.validationScore * 100)}%</dd></div><div><dt className="text-xs text-slate-500">AI outcome</dt><dd className="font-semibold">{selectedReport.aiAnalysis.validationOutcome === null ? "Not available" : label(selectedReport.aiAnalysis.validationOutcome)}</dd></div></> : null}<div className="col-span-2"><dt className="text-xs text-slate-500">Coordinates</dt><dd className="font-mono text-xs">{selectedReport.latitude.toFixed(6)}, {selectedReport.longitude.toFixed(6)}</dd></div><div className="col-span-2"><dt className="text-xs text-slate-500">Reported</dt><dd>{new Date(selectedReport.submittedAt).toLocaleString()}</dd></div></dl>
        {selectedReport.canViewDetails ? detailQuery.isLoading ? <p className="mt-3 text-sm text-slate-500">Loading stored description…</p> : detailQuery.data ? <div className="mt-3 border-t border-slate-200 pt-3"><p className="text-xs text-slate-500">Description</p><p className="mt-1 text-sm leading-6">{detailQuery.data.description}</p></div> : <p className="mt-3 text-sm text-red-700">The stored description could not be loaded.</p> : <p className="mt-3 text-xs text-slate-500">Full description is visible only to the reporter or a moderator.</p>}
      </aside> : null}

      {selectedId !== null && !reportsQuery.isLoading && selectedReport === null ? <p role="alert" className="absolute bottom-3 right-3 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-amber-900 shadow"><MapPin className="mr-2 inline size-4" />The selected report is outside this map area or is no longer visible.</p> : null}
    </section>
  </main>;
}
