import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/features/reports/api";
import { authStore } from "@/features/auth/auth-store";
import { queryKeys } from "@/lib/query/keys";

function session() {
  const token = authStore.getAccessToken();
  const state = authStore.getState();
  return { actor: state.kind === "AUTHENTICATED" ? state.user.id : "anonymous", token };
}

function accessToken(): string {
  const token = authStore.getAccessToken();
  if (token === undefined) throw new Error("An authenticated session is required.");
  return token;
}

export function useReportQuery(id: string) {
  const current = session();
  return useQuery({ queryKey: queryKeys.actor(current.actor, `report:${id}`), queryFn: () => reportsApi.detail(id, accessToken()), enabled: current.token !== undefined && id.length > 0, retry: false });
}

export function useOwnReportsQuery(status: string, cursor: string | null) {
  const current = session();
  const query = new URLSearchParams({ limit: "20", sort: "desc" });
  if (status) query.set("status", status);
  if (cursor) query.set("cursor", cursor);
  return useQuery({ queryKey: queryKeys.actor(current.actor, `own-reports:${query.toString()}`), queryFn: () => reportsApi.own(query.toString(), accessToken()), enabled: current.token !== undefined, retry: false });
}

export function useOwnReportsInfiniteQuery() {
  const current = session();
  return useInfiniteQuery({
    queryKey: queryKeys.actor(current.actor, "own-reports"),
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams({ limit: "12", sort: "desc" });
      if (pageParam !== null) query.set("cursor", pageParam);
      return reportsApi.own(query.toString(), accessToken());
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.pagination.nextCursor ?? undefined,
    enabled: current.token !== undefined,
    retry: false,
  });
}

export function useReportImageQuery(id: string, enabled: boolean) {
  const current = session();
  return useQuery({
    queryKey: queryKeys.actor(current.actor, `report-image:${id}`),
    queryFn: ({ signal }) => reportsApi.image(id, accessToken(), signal),
    enabled: enabled && current.token !== undefined && id.length > 0,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
}
