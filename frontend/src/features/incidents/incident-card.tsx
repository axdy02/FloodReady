import type { Incident } from "@/features/incidents/types";
export function IncidentCard({ incident }: { incident: Incident }) { return <article><h2>{incident.category}</h2><p>Severity: {incident.severity}</p><p>Status: {incident.status}</p><p>Linked reports: {incident.reportCount}</p><p>{incident.lastReportedAt}</p></article>; }
