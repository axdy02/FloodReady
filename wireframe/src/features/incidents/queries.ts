import { QueryClient, QueryClientContext, useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { incidentsApi } from "@/features/incidents/api";
import { queryKeys } from "@/lib/query/keys";
const previewQueryClient = new QueryClient();
export function useIncidentsQuery(query: string) { const queryClient = useContext(QueryClientContext) ?? previewQueryClient; return useQuery({ queryKey: queryKeys.incidents({ query }), queryFn: () => incidentsApi.list(query), enabled: query.length > 0, retry: false, refetchInterval: 30000 }, queryClient); }
