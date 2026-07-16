import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { authStore } from "@/features/auth/auth-store";
import { queryKeys } from "@/lib/query/keys";

export function useReportMapQuery(query: string) { const state = authStore.getState(); const token = authStore.getAccessToken(); const actor = state.kind === "AUTHENTICATED" ? state.user.id : "anonymous"; return useQuery({ queryKey: queryKeys.map(actor, { query }), queryFn: () => api.mapReports(query, token ?? ""), enabled: token !== undefined && query.length > 0, retry: false, refetchInterval: 30000 }); }
