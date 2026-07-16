import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { authStore } from "@/features/auth/auth-store";
import { incidentsApi } from "@/features/incidents/api";
import { queryKeys } from "@/lib/query/keys";

export function useReportMapQuery(query: string) { const state = authStore.getState(); const token = authStore.getAccessToken(); const actor = state.kind === "AUTHENTICATED" ? state.user.id : "anonymous"; return useQuery({ queryKey: queryKeys.map(actor, { query }), queryFn: () => api.mapReports(query, token ?? ""), enabled: token !== undefined && query.length > 0, retry: false, staleTime: Infinity, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false }); }

/**
 * The `/map` route is intentionally public. Anonymous visitors can only see
 * the public Incident API, never the authenticated individual-report feed.
 * Keep this query manual so map movement never creates a surprise refresh.
 */
export function usePublicMapIncidentsQuery(query: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.incidents({ query }), queryFn: () => incidentsApi.list(query), enabled: enabled && query.length > 0, retry: false, staleTime: Infinity, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
}
