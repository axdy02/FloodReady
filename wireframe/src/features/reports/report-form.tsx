"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { BrainCircuit, CheckCircle2, ImagePlus, LoaderCircle, LocateFixed, MapPin, X } from "lucide-react";
import { useCallback, useRef, useState, type FormEvent, type ReactNode } from "react";
import { authStore } from "@/features/auth/auth-store";
import { type MapLayerState, MapCanvas } from "@/features/map/map-canvas";
import { serializeCoordinate, type LocationValue, validateDevicePosition } from "@/features/map/types";
import { reportsApi } from "@/features/reports/api";
import { ImagePreview } from "@/features/reports/image-preview";
import { reportFormSchema, validateImage } from "@/features/reports/report-form-schema";
import type { DraftAnalysisDto, ReportDto } from "@/lib/api/contracts";
import { ApiError } from "@/lib/api/errors";
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
const severities = [["UNKNOWN", "Unknown"], ["MINOR", "Minor"], ["MODERATE", "Moderate"], ["SEVERE", "Severe"], ["IMPASSABLE", "Impassable"]] as const;

type Category = ReportDto["category"];
type Severity = ReportDto["finalSeverity"];

export const reportCategoryOptions = Object.entries(categoryLabels) as Array<[Category, string]>;

const rainRelatedCategories = new Set<Category>(["ROAD_WATERLOGGING", "FLOODED_ROAD", "OVERFLOWING_DRAIN", "UNDERPASS_FLOODING"]);

export function usesWeatherContext(category: Category): boolean {
  return rainRelatedCategories.has(category);
}

export function weatherGuidanceForCategory(category: Category): string {
  return usesWeatherContext(category)
    ? "This wireframe simulates background weather processing for this rain-related category: recent rainfall and current conditions are combined with the evidence image."
    : "Weather context is not required for this incident category.";
}

export function validationStepsForCategory(category: Category): readonly string[] {
  return usesWeatherContext(category)
    ? ["Checking the submitted photo", "Checking rainfall and current weather", "Combining image and weather evidence", "Validation complete"]
    : ["Checking the submitted photo", "Checking report details", "Combining image and report evidence", "Validation complete"];
}

function analysisDescriptionForCategory(category: Category): string {
  return usesWeatherContext(category)
    ? "Backend 1 sends the report evidence, location, and report fields to Backend 2. For this rain-related category, the AI checks the image and recent weather at the selected location to calculate a community-report likelihood score."
    : "Backend 1 sends the report evidence, location, and report fields to Backend 2. For this category, the AI checks the image and report details; weather context is not required for this incident category.";
}

function validationProgressMessageForCategory(category: Category): string {
  return usesWeatherContext(category)
    ? "Backend 1 is securely coordinating the image and weather checks with Backend 2. Do not close this page."
    : "Backend 1 is securely coordinating the image and report-detail checks with Backend 2. Weather context is not required for this incident category. Do not close this page.";
}

function label(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());
}

export function messageForReportSubmissionError(error: unknown): string {
  if (error instanceof ApiError && (error.status === 404 || error.status === 409)) return "This analyzed draft expired or is no longer available. Run AI analysis again before submitting.";
  if (error instanceof ApiError && error.code === "VALIDATION_ERROR") return "The backend rejected the final severity. Review the AI result and choose a valid final severity.";
  if (error instanceof ApiError && error.code === "NETWORK_ERROR") return "The connection ended before the server response arrived. Submission status is unknown; check the Reports Map before retrying.";
  if (error instanceof ApiError && error.code === "TIMEOUT") return "Submission timed out before a response arrived. Check the Reports Map before retrying because the outcome may be unknown.";
  if (error instanceof ApiError && error.status === 401) return "Your session expired. Sign in again before submitting.";
  if (error instanceof ApiError && error.status !== null && error.status >= 400 && error.status < 500) return `The server returned ${error.code.replaceAll("_", " ").toLowerCase()}. The report was not accepted; review the form before retrying.`;
  if (error instanceof ApiError && error.status !== null) return `The server returned ${error.code.replaceAll("_", " ").toLowerCase()}. No success was confirmed; check the Reports Map before retrying.`;
  return "The report could not be submitted. No successful response was received; check the Reports Map before retrying.";
}

export function messageForAnalysisError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return "Your session expired. Sign in again before requesting AI analysis.";
  if (error instanceof ApiError && error.status === 429) return "Too many analysis attempts were made in a short period. Wait a moment, then retry once.";
  if (error instanceof ApiError && error.code === "TIMEOUT") return "The analysis request timed out before a draft was confirmed. Retry the analysis.";
  if (error instanceof ApiError && error.code === "NETWORK_ERROR") return "The analysis request could not reach the Report API. No draft was confirmed, so retry before submitting.";
  if (error instanceof ApiError && error.status === 413) return "The evidence image is too large for analysis. Choose a smaller image.";
  if (error instanceof ApiError && error.status === 415) return "The evidence image could not be analyzed. Choose a valid JPEG, PNG, or WebP image.";
  return "AI analysis could not start and no draft was confirmed. Check both backend services, then retry.";
}

export function ReportForm() {
  const env = loadClientEnvironment();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const analysisPending = useRef(false);
  const submissionPending = useRef(false);
  const [category, setCategory] = useState<Category>("FLOODED_ROAD");
  const [severity, setSeverity] = useState<Severity>("MODERATE");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [evidence, setEvidence] = useState<File | null>(null);
  const [draft, setDraft] = useState<DraftAnalysisDto | null>(null);
  const [finalSeverity, setFinalSeverity] = useState<Severity>("MODERATE");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [validationStep, setValidationStep] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [created, setCreated] = useState<ReportDto | null>(null);

  const invalidateAnalysis = useCallback((nextSeverity?: Severity) => {
    setDraft(null);
    setReviewConfirmed(false);
    setFinalSeverity(nextSeverity ?? severity);
    setAnalysisError(null);
    setError(null);
  }, [severity]);

  const pickMapLocation = useCallback(({ latitude, longitude }: { latitude: number; longitude: number }) => {
    setLocation({ latitude, longitude, locationSource: "MANUAL", gpsAccuracy: null });
    invalidateAnalysis();
  }, [invalidateAnalysis]);

  const chooseEvidence = (file: File | undefined) => {
    invalidateAnalysis();
    if (file === undefined || !validateImage(file, env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB * 1_048_576)) {
      setEvidence(null);
      setError(`Choose one JPEG, PNG, or WebP image up to ${env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB} MB.`);
      return;
    }
    setEvidence(file);
  };

  const useCurrentLocation = () => {
    invalidateAnalysis();
    if (navigator.geolocation === undefined) {
      setError("Device location is unavailable. Click the map to select a location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setLocating(false);
      const validated = validateDevicePosition(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
      if (validated === null) {
        setError("The device returned an invalid location. Click the map instead.");
        return;
      }
      setLocation(validated);
      setError(null);
    }, () => {
      setLocating(false);
      setError("Location permission was denied. Click the map to select a location.");
    }, { enableHighAccuracy: true, timeout: 10_000 });
  };

  const analyze = async () => {
    if (analysisPending.current || submissionPending.current) return;
    const parsed = reportFormSchema.safeParse({ category, severity, description });
    if (!parsed.success) {
      setError("Enter a description between 10 and 1,000 characters and choose a valid severity.");
      return;
    }
    if (location === null) {
      setError("Select the report location on the map.");
      return;
    }
    if (evidence === null) {
      setError("Add one evidence image before requesting AI analysis.");
      return;
    }
    const token = authStore.getAccessToken();
    if (token === undefined) {
      setError("Your session expired. Sign in again before requesting AI analysis.");
      return;
    }

    analysisPending.current = true;
    setAnalyzing(true);
    setValidationStep(0);
    setDraft(null);
    setReviewConfirmed(false);
    setFinalSeverity(parsed.data.severity);
    setError(null);
    setAnalysisError(null);
    const form = new FormData();
    form.append("category", parsed.data.category);
    form.append("severityClaim", parsed.data.severity);
    form.append("description", parsed.data.description);
    form.append("latitude", serializeCoordinate(location.latitude));
    form.append("longitude", serializeCoordinate(location.longitude));
    form.append("locationSource", location.locationSource);
    if (location.gpsAccuracy !== null) form.append("gpsAccuracy", String(Math.round(location.gpsAccuracy * 100) / 100));
    form.append("capturedAt", new Date().toISOString());
    form.append("image", evidence);

    const weatherTimer = window.setTimeout(() => setValidationStep(1), 550);
    const scoringTimer = window.setTimeout(() => setValidationStep(2), 1_150);
    try {
      const analyzedDraft = await reportsApi.analyze(form, token);
      setDraft(analyzedDraft);
      setFinalSeverity(analyzedDraft.severityClaim);
      setValidationStep(3);
      if (analyzedDraft.analysis.status === "PROCESSING") setAnalysisError("The backend returned an unfinished analysis. Retry after checking the AI service.");
    } catch (analysisFailure) {
      setAnalysisError(messageForAnalysisError(analysisFailure));
    } finally {
      window.clearTimeout(weatherTimer);
      window.clearTimeout(scoringTimer);
      analysisPending.current = false;
      setAnalyzing(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionPending.current || analysisPending.current) return;
    if (draft === null) {
      setError("Run AI analysis before submitting. If AI is unavailable, the returned fallback draft will still allow manual submission.");
      return;
    }
    if (draft.analysis.status === "PROCESSING") {
      setError("Wait for a completed analysis attempt before submitting.");
      return;
    }
    if (!reviewConfirmed) {
      setError("Review the AI result and confirm the final severity before submitting.");
      return;
    }
    const token = authStore.getAccessToken();
    if (token === undefined) {
      setError("Your session expired. Sign in again before submitting.");
      return;
    }

    submissionPending.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const report = await reportsApi.submitDraft(draft.draftId, { finalSeverity }, token);
      setCreated(report);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reports", "map"] }),
        queryClient.invalidateQueries({ queryKey: ["actor", report.reporterId] }),
      ]);
    } catch (submissionError) {
      if (submissionError instanceof ApiError && (submissionError.status === 404 || submissionError.status === 409)) {
        setDraft(null);
        setReviewConfirmed(false);
      }
      setError(messageForReportSubmissionError(submissionError));
    } finally {
      submissionPending.current = false;
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCreated(null);
    setCategory("FLOODED_ROAD");
    setSeverity("MODERATE");
    setDescription("");
    setLocation(null);
    setEvidence(null);
    setDraft(null);
    setFinalSeverity("MODERATE");
    setReviewConfirmed(false);
    setError(null);
    setAnalysisError(null);
    setValidationStep(null);
    if (fileInput.current !== null) fileInput.current.value = "";
  };

  if (created !== null) {
    const mapHref = `/map?report=${encodeURIComponent(created.id)}&lat=${serializeCoordinate(created.latitude)}&lng=${serializeCoordinate(created.longitude)}`;
    return <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6"><section className="rounded-lg border border-emerald-300 bg-white p-7 text-center shadow-sm"><CheckCircle2 className="mx-auto size-10 text-emerald-700" /><p className="mt-3 text-xs font-semibold uppercase tracking-[.14em] text-emerald-700">Persisted successfully</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">Flood report created</h1><p className="mt-2 text-sm leading-6 text-slate-600">The final report was saved after your review. It remains unverified citizen evidence.</p><dl className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-3 rounded-md bg-slate-50 p-4 text-left text-sm"><div><dt className="text-xs text-slate-500">Final severity</dt><dd className="font-semibold text-slate-900">{label(created.finalSeverity)}</dd></div><div><dt className="text-xs text-slate-500">AI status</dt><dd className="font-semibold text-slate-900">{created.aiAnalysis === null ? "Not used" : label(created.aiAnalysis.status)}</dd></div><div><dt className="text-xs text-slate-500">Latitude</dt><dd className="font-mono">{created.latitude.toFixed(6)}</dd></div><div><dt className="text-xs text-slate-500">Longitude</dt><dd className="font-mono">{created.longitude.toFixed(6)}</dd></div></dl><div className="mt-6 flex flex-wrap justify-center gap-2"><Link href="/reports" className="inline-flex min-h-11 items-center rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">View submitted reports</Link><Link href={mapHref} className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700">Show persisted marker on map</Link><button type="button" onClick={resetForm} className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700">Submit another</button></div></section></main>;
  }

  const controlsDisabled = analyzing || submitting;
  return <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
    <header className="mb-5"><h1 className="text-2xl font-semibold text-slate-950">Submit Flood Report</h1><p className="mt-1 text-sm text-slate-600">Prepare evidence, request advisory AI triage, review the result, and submit your final severity.</p></header>
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <FormSection number="1" title="Report details">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-800">Category<select disabled={controlsDisabled} value={category} onChange={(event) => { setCategory(event.target.value as Category); invalidateAnalysis(); }} className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60">{reportCategoryOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
          <label className="block text-sm font-medium text-slate-800">Your severity<select disabled={controlsDisabled} value={severity} onChange={(event) => { const next = event.target.value as Severity; setSeverity(next); invalidateAnalysis(next); }} className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60">{severities.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
        </div>
        <p aria-live="polite" className="mt-3 text-xs leading-5 text-slate-600">{weatherGuidanceForCategory(category)}</p>
        <label className="mt-4 block text-sm font-medium text-slate-800">Description<textarea disabled={controlsDisabled} value={description} onChange={(event) => { setDescription(event.target.value.slice(0, 1_000)); invalidateAnalysis(); }} rows={5} placeholder="Example: Water covers both lanes and vehicles cannot pass." className="mt-1 w-full resize-none rounded-md border border-slate-300 p-3 text-sm disabled:opacity-60" /></label>
        <p className="mt-1 text-right text-xs text-slate-500">{Array.from(description).length}/1000 &middot; minimum 10</p>
      </FormSection>

      <FormSection number="2" title="Evidence image">
        {evidence === null ? <button type="button" disabled={controlsDisabled} onClick={() => fileInput.current?.click()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-400 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-700 disabled:opacity-60"><ImagePlus className="size-5" />Choose one image</button> : <div><div className="flex min-h-11 items-center justify-between rounded-md border border-slate-300 bg-slate-50 p-3 text-sm"><span className="max-w-[80%] truncate">{evidence.name}</span><button type="button" disabled={controlsDisabled} aria-label="Remove evidence image" onClick={() => { setEvidence(null); invalidateAnalysis(); }} className="grid size-11 place-items-center rounded text-slate-500 hover:bg-slate-200 disabled:opacity-60"><X className="size-4" /></button></div><ImagePreview file={evidence} /></div>}
        <input ref={fileInput} type="file" className="sr-only" aria-label="Flood evidence image" accept="image/jpeg,image/png,image/webp" disabled={controlsDisabled} onChange={(event) => chooseEvidence(event.target.files?.[0])} />
        <p className="mt-2 text-xs text-slate-500">JPEG, PNG, or WebP &middot; maximum {env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB} MB. Backend 1 validates and privately stores the image before AI analysis.</p>
      </FormSection>

      <FormSection number="3" title="Select location">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Click the map to place the report pin, or use your device location.</p><button type="button" disabled={controlsDisabled || locating} onClick={useCurrentLocation} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"><LocateFixed className="size-4" />{locating ? "Finding location&hellip;" : "Use device location"}</button></div>
        <div className="relative mt-3 h-[28rem] overflow-hidden rounded-md border border-slate-300"><MapCanvas viewport={{ latitude: location?.latitude ?? env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE, longitude: location?.longitude ?? env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE, zoom: location === null ? env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM : 14 }} attribution={env.NEXT_PUBLIC_MAP_ATTRIBUTION} styleUrl={env.NEXT_PUBLIC_MAP_STYLE_URL} layers={layers} location={location} onMapLocationSelect={controlsDisabled ? undefined : pickMapLocation} />{location !== null ? <p aria-live="polite" className="absolute bottom-3 left-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow"><MapPin className="mr-2 inline size-4 text-red-700" /><span className="font-mono text-xs">{serializeCoordinate(location.latitude)}, {serializeCoordinate(location.longitude)}</span><span className="ml-2 text-xs text-slate-500">{location.locationSource === "MANUAL" ? "map selection" : `device GPS · ±${Math.round(location.gpsAccuracy ?? 0)}m`}</span></p> : null}</div>
      </FormSection>

      <FormSection number="4" title="AI validation and human review">
        <p className="text-sm leading-6 text-slate-600">{analysisDescriptionForCategory(category)}</p>
        <button type="button" onClick={() => void analyze()} disabled={controlsDisabled || locating} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{analyzing ? <LoaderCircle className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}{analyzing ? "Analyzing evidence&hellip;" : draft === null ? "Analyze with AI" : "Run AI analysis again"}</button>
        {analyzing ? <div role="status" aria-live="polite" className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"><p className="font-semibold">Validating&hellip;</p><p className="mt-1">{validationProgressMessageForCategory(category)}</p><ol className="mt-3 space-y-2">{validationStepsForCategory(category).map((step, index) => <li key={step} className="flex items-center gap-2"><span className={`grid size-5 place-items-center rounded-full text-xs font-bold ${validationStep !== null && index < validationStep ? "bg-emerald-600 text-white" : index === validationStep ? "bg-sky-700 text-white" : "bg-slate-200 text-slate-600"}`}>{validationStep !== null && index < validationStep ? "✓" : index + 1}</span><span className={index <= (validationStep ?? 0) ? "font-medium" : "text-slate-600"}>{step}{index === validationStep ? "…" : ""}</span></li>)}</ol></div> : null}
        {analysisError !== null ? <div role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900"><p className="font-semibold">AI analysis could not complete</p><p className="mt-1 leading-6">{analysisError}</p></div> : null}
        {draft !== null && !analyzing ? <AnalysisReview draft={draft} finalSeverity={finalSeverity} reviewConfirmed={reviewConfirmed} onConfirm={(value) => { setFinalSeverity(value); setReviewConfirmed(true); setError(null); }} /> : null}
      </FormSection>

      <FormSection number="5" title="Final submission">
        <p className="text-sm leading-6 text-slate-600">{draft === null ? "Complete one AI analysis attempt before submitting." : reviewConfirmed ? `Final severity confirmed as ${label(finalSeverity)}.` : "Choose the AI suggestion, keep your severity, or manually select the final severity."}</p>
        {error !== null ? <p role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2"><button type="submit" disabled={submitting || analyzing || draft === null || draft.analysis.status === "PROCESSING" || !reviewConfirmed} className="min-h-11 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Submitting final report&hellip;" : "Submit final report"}</button><Link href="/map" className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700">Cancel</Link></div>
      </FormSection>
    </form>
  </main>;
}

function AnalysisReview({ draft, finalSeverity, reviewConfirmed, onConfirm }: { draft: DraftAnalysisDto; finalSeverity: Severity; reviewConfirmed: boolean; onConfirm: (severity: Severity) => void }) {
  const analysis = draft.analysis;
  const succeeded = analysis.status === "SUCCEEDED";
  const unavailable = analysis.status === "FAILED" || analysis.status === "TIMED_OUT";
  const confidence = analysis.confidenceScore === null ? "Not available" : `${Math.round(analysis.confidenceScore * 100)}%`;
  const validationScore = analysis.validationScore === null ? "Not available" : `${Math.round(analysis.validationScore * 100)}%`;
  const accepted = analysis.validationOutcome === "ACCEPTED";

  return <section aria-label="AI validation" className={`mt-4 rounded-md border p-4 ${succeeded ? "border-sky-300 bg-sky-50" : unavailable ? "border-amber-300 bg-amber-50" : "border-slate-300 bg-slate-50"}`}>
    {succeeded ? <div className={`mb-4 rounded-md border bg-white p-3 text-sm ${accepted ? "border-emerald-300" : "border-sky-200"}`}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-sky-800">Validation result</p><p className="mt-1 font-semibold text-slate-950">{accepted ? "Validated - accepted for the community map" : analysis.validationOutcome === "REJECTED" ? "Low likelihood - human review recommended" : "Validation complete - review recommended"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${accepted ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>{analysis.validationOutcome === null ? "COMPLETE" : label(analysis.validationOutcome)}</span></div><dl className="mt-3 grid gap-3 sm:grid-cols-2"><Info label="AI validation score" value={validationScore} /><Info label="Image confidence" value={confidence} /></dl>{analysis.weatherSummary !== null ? <div className="mt-3 border-t border-slate-200 pt-3"><p className="text-xs font-medium text-sky-800">Rainfall and temperature check</p><p className="mt-1 leading-6 text-slate-700">{analysis.weatherSummary}</p>{analysis.weatherPrecipitationMm !== null || analysis.weatherTemperatureC !== null ? <p className="mt-1 text-xs text-slate-600">Weather values: {analysis.weatherPrecipitationMm === null ? "rainfall unavailable" : `${analysis.weatherPrecipitationMm.toFixed(1)} mm`} {analysis.weatherTemperatureC === null ? "" : `- ${analysis.weatherTemperatureC.toFixed(1)} C now`}</p> : null}</div> : null}</div> : null}
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-sky-800">AI suggestion</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{succeeded ? analysis.suggestedSeverity === null ? "No severity suggested" : `${label(analysis.suggestedSeverity)} severity` : unavailable ? "AI unavailable — manual reporting remains available" : "Analysis is still processing"}</h3></div><span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{label(analysis.status)}</span></div>
    {succeeded ? <><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><Info label="Flood detected" value={analysis.floodDetected === null ? "Uncertain" : analysis.floodDetected ? "Yes" : "No"} /><Info label="Confidence" value={confidence} /><Info label="Road passability" value={analysis.roadPassability === null ? "Not available" : label(analysis.roadPassability)} /><Info label="Water-level category" value={analysis.waterLevelCategory === null ? "Not available" : label(analysis.waterLevelCategory)} /><Info label="Image quality" value={analysis.imageQuality === null ? "Not available" : label(analysis.imageQuality)} /><Info label="Human review" value={analysis.needsHumanReview === false ? "Still required before submission" : "Required"} /></dl>{analysis.summary !== null ? <div className="mt-4 rounded-md bg-white p-3 text-sm text-slate-800"><p className="text-xs font-medium text-slate-500">AI summary</p><p className="mt-1 leading-6">{analysis.summary}</p></div> : null}{analysis.modelName !== null ? <p className="mt-3 text-xs text-slate-600">Model: {analysis.modelName}{analysis.modelVersion === null ? "" : ` · ${analysis.modelVersion}`}{analysis.processingTimeMs === null ? "" : ` · ${analysis.processingTimeMs} ms`}</p> : null}</> : null}
    {unavailable ? <p className="mt-3 text-sm leading-6 text-amber-950">The AI attempt ended as {label(analysis.status)}. Backend 1 kept the draft valid, so you can continue with your own severity.</p> : null}
    {unavailable ? <p className="mt-2 text-xs leading-5 text-amber-900">For live validation, set a valid <code>AI_PROVIDER_API_KEY</code> in the ignored root <code>.env</code> file and restart the AI service.</p> : null}
    <div className="mt-4 border-t border-slate-300 pt-4"><p className="text-sm font-semibold text-slate-900">Choose the final severity</p><div className="mt-3 flex flex-wrap gap-2">{succeeded && analysis.suggestedSeverity !== null ? <button type="button" onClick={() => onConfirm(analysis.suggestedSeverity ?? draft.severityClaim)} className="min-h-11 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Accept AI suggestion</button> : null}<button type="button" onClick={() => onConfirm(draft.severityClaim)} className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800">{unavailable ? "Continue without AI" : "Keep my severity"}</button><label className="flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800">Manual final severity<select aria-label="Manual final severity" value={finalSeverity} onChange={(event) => onConfirm(event.target.value as Severity)} className="bg-white py-2 text-sm">{severities.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label></div>{reviewConfirmed ? <p role="status" className="mt-3 text-sm font-semibold text-emerald-800">Final severity selected: {label(finalSeverity)}</p> : null}</div>
    <aside className="mt-4 rounded-md border border-amber-300 bg-white p-3 text-xs leading-5 text-amber-950"><strong>Human review required.</strong> AI is advisory. It does not verify this report, issue an official warning, or measure an exact water depth.</aside>
  </section>;
}

function Info({ label: title, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-slate-500">{title}</dt><dd className="mt-1 font-medium text-slate-900">{value}</dd></div>;
}

function FormSection({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <section className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold text-slate-950"><span className="mr-2 text-slate-500">{number}.</span>{title}</h2>{children}</section>;
}
