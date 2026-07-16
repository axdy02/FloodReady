import { useIncidentsQuery } from "@/features/incidents/queries";
import { useOwnReportsQuery } from "@/features/reports/queries";
export function useDashboardQueries() { const reports = useOwnReportsQuery("", null); const incidents = useIncidentsQuery("?status=ACTIVE&limit=5&sort=desc"); return { reports, incidents }; }
