"use client";

import Link from "next/link";
import { Camera, ClipboardList, MapPinned, RefreshCw } from "lucide-react";
import { ReportEvidenceImage } from "@/features/reports/report-evidence-image";
import { useOwnReportsInfiniteQuery } from "@/features/reports/queries";
import { SafetyNotice } from "@/features/map/safety-notice";
import { serializeCoordinate } from "@/features/map/types";
import type { ReportDto } from "@/lib/api/contracts";

const submittedDate = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function label(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());
}

function statusLabel(value: ReportDto["verificationStatus"]): string {
  return value === "SUBMITTED" ? "Submitted / unverified" : label(value);
}

function statusClass(value: ReportDto["verificationStatus"]): string {
  if (value === "VERIFIED" || value === "RESOLVED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "REJECTED" || value === "DISPUTED") return "border-red-200 bg-red-50 text-red-800";
  if (value === "SUBMITTED" || value === "PENDING_REVIEW" || value === "PROVISIONAL") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

export function SubmittedReports() {
  const reportsQuery = useOwnReportsInfiniteQuery();
  const pages = reportsQuery.data?.pages;
  const reports = pages?.flatMap((page) => page.items) ?? [];
  const totalCount = pages?.[0]?.totalCount ?? 0;

  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-sky-700">Reporting workflow</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Submitted Reports</h1>
        <p className="mt-1 text-sm text-slate-600">Review your persisted reports and the evidence photo submitted with each one.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void reportsQuery.refetch()} disabled={reportsQuery.isFetching} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"><RefreshCw className={`size-4 ${reportsQuery.isFetching ? "animate-spin" : ""}`} />Refresh</button>
        <Link href="/reports/new" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"><Camera className="size-4" />Submit Flood Report</Link>
      </div>
    </header>

    <div className="mt-4 max-w-2xl"><SafetyNotice /></div>

    {reportsQuery.isLoading ? <ReportListLoading /> : null}

    {reportsQuery.isError && reportsQuery.data === undefined ? <section role="alert" className="mt-6 rounded-lg border border-red-300 bg-white p-6 text-red-900 shadow-sm"><h2 className="font-semibold">Could not load submitted reports</h2><p className="mt-1 text-sm">Check the backend connection, then try again.</p><button type="button" onClick={() => void reportsQuery.refetch()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium hover:bg-red-50"><RefreshCw className="size-4" />Retry</button></section> : null}

    {!reportsQuery.isLoading && !reportsQuery.isError && reports.length === 0 ? <EmptyReports /> : null}

    {reports.length > 0 ? <section className="mt-6" aria-labelledby="report-count">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="report-count" className="font-semibold text-slate-950">Your evidence history</h2><p className="text-sm text-slate-500">Showing {reports.length} of {totalCount}</p></div>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{reports.map((report) => <li key={report.id}><SubmittedReportCard report={report} /></li>)}</ul>

      {reportsQuery.isError && reportsQuery.data !== undefined ? <div role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"><p>Older reports could not be loaded. Your current results are still shown.</p><button type="button" onClick={() => void reportsQuery.fetchNextPage()} className="mt-2 min-h-11 rounded-md border border-red-300 bg-white px-3 py-2 font-medium">Retry loading older reports</button></div> : null}

      {reportsQuery.hasNextPage && !reportsQuery.isError ? <div className="mt-6 text-center"><button type="button" onClick={() => void reportsQuery.fetchNextPage()} disabled={reportsQuery.isFetchingNextPage} className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60">{reportsQuery.isFetchingNextPage ? "Loading older reports…" : "Load older reports"}</button></div> : null}
    </section> : null}
  </main>;
}

function SubmittedReportCard({ report }: { report: ReportDto }) {
  const mapHref = `/map?report=${encodeURIComponent(report.id)}&lat=${serializeCoordinate(report.latitude)}&lng=${serializeCoordinate(report.longitude)}`;
  return <article className="h-full overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
    <ReportEvidenceImage report={report} />
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-[.12em] text-sky-700">{label(report.category)}</p><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(report.verificationStatus)}`}>{statusLabel(report.verificationStatus)}</span></div>
      <h2 className="mt-3 text-lg font-semibold text-slate-950">{label(report.severityClaim)} severity</h2>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">{report.description}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 text-sm"><div><dt className="text-xs text-slate-500">Submitted</dt><dd className="mt-1 text-slate-800"><time dateTime={report.submittedAt}>{submittedDate.format(new Date(report.submittedAt))}</time></dd></div><div><dt className="text-xs text-slate-500">Location source</dt><dd className="mt-1 text-slate-800">{report.locationSource === "DEVICE_GPS" ? "Device GPS" : "Map selection"}</dd></div><div className="col-span-2"><dt className="text-xs text-slate-500">Coordinates</dt><dd className="mt-1 font-mono text-xs text-slate-800">{report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}</dd></div></dl>
      <Link href={mapHref} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"><MapPinned className="size-4" />Show on map</Link>
    </div>
  </article>;
}

function ReportListLoading() {
  return <section aria-busy="true" aria-label="Submitted reports" className="mt-6"><p role="status" className="text-sm text-slate-600">Loading submitted reports&hellip;</p><div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} aria-hidden="true" className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="aspect-[4/3] animate-pulse bg-slate-200" /><div className="space-y-3 p-5"><div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" /><div className="h-3 w-full animate-pulse rounded bg-slate-100" /><div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" /></div></div>)}</div></section>;
}

function EmptyReports() {
  return <section className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center"><ClipboardList className="mx-auto size-8 text-slate-400" /><h2 className="mt-3 text-lg font-semibold text-slate-950">No submitted reports yet</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Submit a flood observation with one evidence photo. It will appear here after the backend saves it.</p><Link href="/reports/new" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"><Camera className="size-4" />Submit Flood Report</Link></section>;
}
