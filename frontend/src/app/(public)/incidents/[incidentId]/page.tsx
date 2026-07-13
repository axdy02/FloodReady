import { notFound } from "next/navigation";
import { incidentsApi } from "@/features/incidents/api";
import { IncidentDetail } from "@/features/incidents/incident-detail";

export default async function IncidentPage({ params }: { params: Promise<{ incidentId: string }> }) { const { incidentId } = await params; if (!/^[0-9a-f-]{36}$/iu.test(incidentId)) notFound(); try { return <IncidentDetail incident={await incidentsApi.detail(incidentId)} />; } catch (error) { if (error instanceof Error && "status" in error && error.status === 404) notFound(); throw error; } }
