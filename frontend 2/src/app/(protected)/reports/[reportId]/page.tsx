"use client";
import { useParams } from "next/navigation";
import { useReportQuery } from "@/features/reports/queries";
import { ReportDetail } from "@/features/reports/report-detail";
export default function ReportPage() { const params = useParams<{ reportId: string }>(); const query = useReportQuery(params.reportId); if (query.isLoading) return <main>Loading report</main>; if (query.isError) return <main role="alert">Report unavailable.</main>; return query.data ? <ReportDetail report={query.data} /> : null; }
