import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authStore } from "@/features/auth/auth-store";
import { useOwnReportsInfiniteQuery, useOwnReportsQuery, useReportImageQuery, useReportQuery } from "@/features/reports/queries";
import type { ReportDto } from "@/lib/api/contracts";
import { validUser } from "@/tests/fixtures/contracts";

const mocks = vi.hoisted(() => ({ detail: vi.fn(), image: vi.fn(), own: vi.fn() }));

vi.mock("@/features/reports/api", () => ({ reportsApi: { detail: mocks.detail, image: mocks.image, own: mocks.own } }));

const report: ReportDto = {
  id: "20000000-0000-4000-8000-000000000001",
  reporterId: validUser.id,
  category: "FLOODED_ROAD",
  description: "Water covers one lane.",
  severityClaim: "MODERATE",
  finalSeverity: "MODERATE",
  aiUsed: false,
  aiAnalysis: null,
  latitude: 28.33505,
  longitude: 77.05345,
  gpsAccuracy: null,
  locationSource: "MANUAL",
  capturedAt: "2026-07-14T09:00:00.000Z",
  submittedAt: "2026-07-14T09:00:01.000Z",
  uploadSource: "WEB",
  verificationStatus: "SUBMITTED",
  incidentId: null,
  createdAt: "2026-07-14T09:00:01.000Z",
  updatedAt: "2026-07-14T09:00:01.000Z",
};

const firstPage = { items: [report], pagination: { hasMore: true, limit: 12, nextCursor: "next-cursor" }, totalCount: 2 };
const lastPage = { items: [{ ...report, id: "20000000-0000-4000-8000-000000000002" }], pagination: { hasMore: false, limit: 12, nextCursor: null }, totalCount: 2 };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  authStore.clearSession();
  authStore.setSession("access-token", validUser, 900);
  mocks.detail.mockReset();
  mocks.image.mockReset();
  mocks.own.mockReset();
});

afterEach(() => {
  cleanup();
  client.clear();
});

describe("report queries", () => {
  it("loads a report detail and keeps an empty id disabled", async () => {
    mocks.detail.mockResolvedValue(report);
    const detail = renderHook(() => useReportQuery(report.id), { wrapper });
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
    expect(mocks.detail).toHaveBeenCalledWith(report.id, "access-token");

    renderHook(() => useReportQuery(""), { wrapper });
    expect(mocks.detail).toHaveBeenCalledTimes(1);
  });

  it("loads a filtered owner page with its cursor", async () => {
    mocks.own.mockResolvedValue(firstPage);
    const own = renderHook(() => useOwnReportsQuery("SUBMITTED", "cursor-value"), { wrapper });
    await waitFor(() => expect(own.result.current.isSuccess).toBe(true));
    expect(mocks.own).toHaveBeenCalledWith("limit=20&sort=desc&status=SUBMITTED&cursor=cursor-value", "access-token");
  });

  it("appends cursor pages for complete report history", async () => {
    mocks.own.mockImplementation((query: string) => Promise.resolve(query.includes("cursor=next-cursor") ? lastPage : firstPage));
    const history = renderHook(() => useOwnReportsInfiniteQuery(), { wrapper });
    await waitFor(() => expect(history.result.current.isSuccess).toBe(true));
    expect(history.result.current.data?.pages).toHaveLength(1);

    await act(async () => { await history.result.current.fetchNextPage(); });
    await waitFor(() => expect(history.result.current.data?.pages).toHaveLength(2));
    expect(mocks.own).toHaveBeenNthCalledWith(1, "limit=12&sort=desc", "access-token");
    expect(mocks.own).toHaveBeenNthCalledWith(2, "limit=12&sort=desc&cursor=next-cursor", "access-token");
  });

  it("loads a private image only when its card is near the viewport", async () => {
    const image = { blob: new Blob(["image"], { type: "image/jpeg" }), mime: "image/jpeg" as const };
    mocks.image.mockResolvedValue(image);
    const disabled = renderHook(() => useReportImageQuery(report.id, false), { wrapper });
    expect(disabled.result.current.fetchStatus).toBe("idle");
    expect(mocks.image).not.toHaveBeenCalled();
    disabled.unmount();

    const enabled = renderHook(() => useReportImageQuery(report.id, true), { wrapper });
    await waitFor(() => expect(enabled.result.current.isSuccess).toBe(true));
    expect(mocks.image.mock.calls[0]?.slice(0, 2)).toEqual([report.id, "access-token"]);
    expect(mocks.image.mock.calls[0]?.[2]).toBeInstanceOf(AbortSignal);
  });

  it("does not query report resources without an authenticated session", () => {
    authStore.clearSession();
    const history = renderHook(() => useOwnReportsInfiniteQuery(), { wrapper });
    const image = renderHook(() => useReportImageQuery(report.id, true), { wrapper });
    expect(history.result.current.fetchStatus).toBe("idle");
    expect(image.result.current.fetchStatus).toBe("idle");
    expect(mocks.own).not.toHaveBeenCalled();
    expect(mocks.image).not.toHaveBeenCalled();
  });
});
