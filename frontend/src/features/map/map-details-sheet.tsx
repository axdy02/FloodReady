import type { ReportMapDto } from "@/lib/api/contracts";
import { CategoryMarker } from "@/features/map/category-markers";

export function MapDetailsSheet({ report }: { report: ReportMapDto | null }) { if (report === null) return null; return <aside aria-label="Report details"><CategoryMarker report={report} /><p>Claimed severity: {report.severityClaim}</p><p>Captured: {report.capturedAt}</p><p>Submitted: {report.submittedAt}</p>{report.canViewDetails ? <a href={`/reports/${report.id}`}>View details</a> : null}</aside>; }
