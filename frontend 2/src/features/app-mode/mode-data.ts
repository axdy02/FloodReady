import type { IncidentDto, ReportDto } from "@/lib/api/contracts";
import { demoIncidents, mapIncidents, type DemoIncident } from "@/data/demo/incidents";

export type DisplayReport = {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  address: string;
  reporter: string;
  trustScore: number | null;
  createdAt: string;
  description: string;
  latitude: number;
  longitude: number;
  tone: "red" | "orange" | "yellow";
};
export const demoDisplayReports: readonly DisplayReport[] = demoIncidents.map(toDemoDisplayReport);
export function toDemoDisplayReport(incident: DemoIncident): DisplayReport { return { id: incident.id, title: incident.title, category: incident.category, severity: incident.severity, status: incident.status, address: incident.address, reporter: incident.reporter.name, trustScore: incident.reporter.trustScore, createdAt: incident.createdAt, description: incident.description, latitude: incident.latitude, longitude: incident.longitude, tone: incident.imageTone }; }
export function toLiveDisplayReport(report: ReportDto): DisplayReport { return { id: report.id, title: report.category.replaceAll("_", " "), category: report.category, severity: report.severityClaim, status: report.verificationStatus, address: `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`, reporter: "You", trustScore: null, createdAt: report.submittedAt, description: report.description ?? "No description provided.", latitude: report.latitude, longitude: report.longitude, tone: report.severityClaim === "IMPASSABLE" || report.severityClaim === "SEVERE" ? "red" : report.severityClaim === "MODERATE" ? "orange" : "yellow" }; }
export const demoContributors = new Set(demoIncidents.map((incident) => incident.reporter.id)).size;
export const demoAverageConfidence = Math.round(demoIncidents.reduce((sum, incident) => sum + incident.aiConfidence, 0) / demoIncidents.length);
export const demoMapIncidents = mapIncidents;
export type DisplayAlert = {
  id: string;
  incidentId: string;
  title: string;
  detail: string;
  level: "Critical" | "High" | "Resolved";
  createdAt: string;
  address: string;
};

export function incidentToDisplayAlert(incident: IncidentDto): DisplayAlert {
  return {
    id: `alert-${incident.id}`,
    incidentId: incident.id,
    title: incident.category.replaceAll("_", " "),
    detail: `${incident.severity.toLowerCase()} incident reported at the mapped location.`,
    level: incident.severity === "IMPASSABLE" || incident.severity === "SEVERE" ? "Critical" : incident.status === "RESOLVED" ? "Resolved" : "High",
    createdAt: incident.lastReportedAt,
    address: `${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}`,
  };
}
