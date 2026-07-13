import type { ReportDto } from "@/lib/api/contracts";
export function ReportCard({ report }: { report: ReportDto }) { return <article><h2>{report.category}</h2><p>Claimed severity: {report.severityClaim}</p><p>Status: {report.verificationStatus}</p><p>Submitted: {report.submittedAt}</p></article>; }
