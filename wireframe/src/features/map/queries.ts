import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { authStore } from "@/features/auth/auth-store";
import { queryKeys } from "@/lib/query/keys";

const currentAccessToken = (): string => {
  const token = authStore.getAccessToken();
  if (token === undefined) throw new Error("An authenticated session is required.");
  return token;
};

export function useReportMapQuery(query: string) { const state = authStore.getState(); const token = authStore.getAccessToken(); const actor = state.kind === "AUTHENTICATED" ? state.user.id : "anonymous"; return useQuery({ queryKey: queryKeys.map(actor, { query }), queryFn: () => api.mapReports(query, currentAccessToken()), enabled: token !== undefined && query.length > 0, retry: false, staleTime: Infinity, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false }); }

export function useReportDetailQuery(reportId: string | null, enabled: boolean) { const state = authStore.getState(); const token = authStore.getAccessToken(); const actor = state.kind === "AUTHENTICATED" ? state.user.id : "anonymous"; return useQuery({ queryKey: queryKeys.actor(actor, `report:${reportId ?? "none"}`), queryFn: () => api.report(reportId ?? "", currentAccessToken()), enabled: token !== undefined && reportId !== null && enabled, retry: false }); }
