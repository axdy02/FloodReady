import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authStore } from "@/features/auth/auth-store";
import { useReportMapQuery } from "@/features/map/queries";
import { validUser } from "@/tests/fixtures/contracts";

const mocks = vi.hoisted(() => ({ mapReports: vi.fn(), report: vi.fn() }));

vi.mock("@/lib/api/client", () => ({ api: { mapReports: mocks.mapReports, report: mocks.report } }));

describe("report map queries", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    authStore.clearSession();
    mocks.mapReports.mockReset();
    mocks.mapReports.mockResolvedValue({ items: [], pagination: { hasMore: false, limit: 100, nextCursor: null }, totalCount: 0 });
  });

  afterEach(() => {
    queryClient.clear();
    authStore.clearSession();
  });

  it("uses the latest access token when an existing query refetches", async () => {
    authStore.setSession("initial-token", validUser, 900);
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useReportMapQuery("?west=77&south=28&east=78&north=29"), { wrapper });

    await waitFor(() => expect(mocks.mapReports).toHaveBeenCalled());
    expect(mocks.mapReports.mock.calls[0]?.[1]).toBe("initial-token");
    authStore.setSession("refreshed-token", validUser, 900);
    await result.current.refetch();

    expect(mocks.mapReports.mock.calls.at(-1)?.[1]).toBe("refreshed-token");
  });
});
