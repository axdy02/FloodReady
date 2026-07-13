import type { Incident } from "@/features/incidents/types";
export function IncidentDetail({ incident }: { incident: Incident }) { return <main><h1>{incident.category}</h1><p>Severity: {incident.severity}</p><p>Status: {incident.status}</p><p>Linked reports: {incident.reportCount}</p><p>Last reported: {incident.lastReportedAt}</p></main>; }
