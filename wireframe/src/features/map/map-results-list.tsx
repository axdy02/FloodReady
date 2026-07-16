import type { ReportMapDto } from "@/lib/api/contracts";
import { CategoryMarker } from "@/features/map/category-markers";

export function MapResultsList({ reports }: { reports: ReportMapDto[] }) { return <section aria-label="Visible report results"><h2>Visible reports</h2>{reports.length === 0 ? <p>No matching markers in this view.</p> : <ul>{reports.map((report) => <li key={report.id}><CategoryMarker report={report} /><p>Claimed severity: {report.severityClaim}</p></li>)}</ul>}{reports.length >= 100 ? <p>100+ results; zoom in or filter.</p> : null}</section>; }
