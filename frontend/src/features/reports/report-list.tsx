"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Camera, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { authStore } from "@/features/auth/auth-store";
import { reportsApi } from "@/features/reports/api";
import { useOwnReportsQuery, useReportImageQuery } from "@/features/reports/queries";
import type { ReportDto } from "@/lib/api/contracts";

function label(value: string): string { return value.toLowerCase().replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase()); }
function aiText(report: ReportDto): string { if (report.aiAnalysis === null || report.aiAnalysis.status === "PROCESSING") return "Validating…"; if (report.aiAnalysis.status !== "SUCCEEDED" || report.aiAnalysis.suggestedSeverity === null) return "Manual review required"; return label(report.aiAnalysis.suggestedSeverity); }
function validationText(report: ReportDto): string { if (report.aiAnalysis === null || report.aiAnalysis.status === "PROCESSING") return "AI validation in progress"; return report.aiAnalysis.status === "SUCCEEDED" ? "Validation complete" : "Validation could not complete"; }

export function ReportList() {
  const reports = useOwnReportsQuery("", null); const items = reports.data?.items ?? [];
  return <main className="mx-auto max-w-5xl px-5 py-8"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold tracking-[.18em] text-blue-400">YOUR SUBMISSIONS</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Reports</h1><p className="mt-2 text-sm text-zinc-400">Every submitted report remains visible while AI validation runs.</p></div><div className="flex gap-2"><button type="button" onClick={() => void reports.refetch()} disabled={reports.isFetching} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold disabled:opacity-60"><RefreshCw className={`size-4 ${reports.isFetching ? "animate-spin" : ""}`} />Refresh</button><Link href="/reports/new" className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white"><Camera className="size-4" />Submit a report</Link></div></header>{reports.isLoading ? <p role="status" className="mt-6 rounded-2xl border border-white/[.08] bg-white/[.02] p-5 text-sm text-zinc-400">Loading your reports…</p> : null}{reports.isError ? <div role="alert" className="mt-6 rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-100"><p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" />Could not load your reports</p><button type="button" onClick={() => void reports.refetch()} className="mt-3 rounded-xl border border-red-300/30 px-3 py-2 text-xs font-semibold">Retry</button></div> : null}{!reports.isLoading && !reports.isError && items.length === 0 ? <section className="mt-6 rounded-2xl border border-white/[.08] bg-white/[.02] p-8 text-center"><h2 className="font-semibold">No reports yet</h2><p className="mt-2 text-sm text-zinc-400">Your flood reports will appear here as soon as you submit them.</p><Link href="/reports/new" className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950">Submit your first report</Link></section> : null}<section className="mt-6 grid gap-3">{items.map((report) => <ReportCard key={report.id} report={report} />)}</section></main>;
}

function ReportCard({ report }: { report: ReportDto }) {
  const validating = report.aiAnalysis === null || report.aiAnalysis.status === "PROCESSING";
  return <article className="surface-card rounded-2xl p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><ReportThumbnail reportId={report.id} /><div><p className="text-xs font-semibold tracking-[.14em] text-blue-300">{label(report.category)}</p><p className="mt-2 max-w-xl text-sm leading-6 text-zinc-300">{report.description}</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${validating ? "bg-slate-400/15 text-slate-200" : report.aiAnalysis?.status === "SUCCEEDED" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}>{validating ? "? Validating" : validationText(report)}</span></div><dl className="mt-5 grid gap-3 text-xs sm:grid-cols-4"><div><dt className="text-zinc-500">Your severity</dt><dd className="mt-1 font-semibold text-zinc-100">{label(report.severityClaim)}</dd></div><div><dt className="text-zinc-500">AI assessment</dt><dd className="mt-1 font-semibold text-zinc-100">{aiText(report)}</dd></div><div><dt className="text-zinc-500">Submitted</dt><dd className="mt-1 text-zinc-300">{new Date(report.submittedAt).toLocaleString()}</dd></div><div><dt className="text-zinc-500">Location</dt><dd className="mt-1 font-mono text-zinc-300">{report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}</dd></div></dl>{report.aiAnalysis?.status === "SUCCEEDED" && report.aiAnalysis.confidenceScore !== null ? <p className="mt-4 text-xs text-zinc-400">AI confidence: {Math.round(report.aiAnalysis.confidenceScore * 100)}%</p> : null}{!validating && report.aiAnalysis?.status !== "SUCCEEDED" ? <RetryAnalysisButton reportId={report.id} /> : null}<Link href={`/map?report=${report.id}&lat=${report.latitude}&lng=${report.longitude}`} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-300">View on map <ArrowUpRight className="size-3" /></Link></article>;
}

function RetryAnalysisButton({ reportId }: { reportId: string }) {
  const queryClient = useQueryClient(); const [retrying, setRetrying] = useState(false); const [error, setError] = useState<string | null>(null);
  const retry = async () => { const token = authStore.getAccessToken(); if (token === undefined) { setError("Sign in again before retrying AI validation."); return; } setRetrying(true); setError(null); try { await reportsApi.retryAnalysis(reportId, token); await queryClient.invalidateQueries({ queryKey: ["reports"] }); } catch { setError("AI validation could not be restarted. Try again later."); } finally { setRetrying(false); } };
  return <div className="mt-4"><button type="button" onClick={() => void retry()} disabled={retrying} className="rounded-xl border border-amber-300/30 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-60">{retrying ? "Restarting AI validation…" : "Retry AI validation"}</button>{error !== null ? <p role="alert" className="mt-2 text-xs text-red-200">{error}</p> : null}</div>;
}

function ReportThumbnail({ reportId }: { reportId: string }) {
  const image = useReportImageQuery(reportId, true); const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (image.data === undefined) return; const next = URL.createObjectURL(image.data.blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [image.data]);
  if (url === null) return <div aria-label={image.isError ? "Report image unavailable" : "Loading report image"} className="grid size-16 shrink-0 place-items-center rounded-lg border border-white/[.08] bg-white/[.04] text-[10px] text-zinc-500">{image.isError ? "No image" : "Photo"}</div>;
  return <img src={url} alt="Submitted flood-report evidence" className="size-16 shrink-0 rounded-lg border border-white/[.08] object-cover" />;
}
