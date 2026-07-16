"use client";

import { ImageOff, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReportImageQuery } from "@/features/reports/queries";
import type { ReportDto } from "@/lib/api/contracts";

function label(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());
}

export function ReportEvidenceImage({ report }: { report: ReportDto }) {
  const container = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const imageQuery = useReportImageQuery(report.id, nearViewport);

  useEffect(() => {
    const element = container.current;
    if (element === null) return;
    if (typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting === true) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (imageQuery.data === undefined) {
      setSource(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageQuery.data.blob);
    setSource(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageQuery.data]);

  const alt = `Evidence for ${label(report.category)} report submitted ${new Date(report.submittedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`;

  return <div ref={container} className="relative aspect-[4/3] overflow-hidden border-b border-slate-200 bg-slate-100">
    {source !== null ? <img src={source} alt={alt} loading="lazy" className="size-full object-contain" /> : null}
    {source === null && (!nearViewport || imageQuery.isLoading) ? <div role="status" className="grid size-full place-items-center text-sm text-slate-500"><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />Loading evidence image&hellip;</span></div> : null}
    {source === null && nearViewport && imageQuery.isError ? <div role="alert" className="grid size-full place-items-center p-5 text-center text-sm text-slate-600"><div><ImageOff className="mx-auto size-6 text-slate-400" /><p className="mt-2 font-medium text-slate-800">Evidence image unavailable</p><button type="button" onClick={() => void imageQuery.refetch()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"><RefreshCw className="size-4" />Retry image</button></div></div> : null}
  </div>;
}
