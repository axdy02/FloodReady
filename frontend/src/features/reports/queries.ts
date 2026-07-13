import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/features/reports/api";
import { authStore } from "@/features/auth/auth-store";
import { queryKeys } from "@/lib/query/keys";
export function useReportQuery(id: string) { const token = authStore.getAccessToken(); const state = authStore.getState(); const actor = state.kind === "AUTHENTICATED" ? state.user.id : "anonymous"; return useQuery({ queryKey: queryKeys.actor(actor, `report:${id}`), queryFn: () => reportsApi.detail(id, token ?? ""), enabled: token !== undefined && id.length > 0, retry: false }); }
export function useOwnReportsQuery(status: string, cursor: string | null) { const token = authStore.getAccessToken(); const current = authStore.getState(); const actor = current.kind === "AUTHENTICATED" ? current.user.id : "anonymous"; const query = new URLSearchParams({ limit: "20", sort: "desc" }); if (status) query.set("status", status); if (cursor) query.set("cursor", cursor); return useQuery({ queryKey: queryKeys.actor(actor, `own-reports:${query.toString()}`), queryFn: () => reportsApi.own(query.toString(), token ?? ""), enabled: token !== undefined, retry: false }); }
