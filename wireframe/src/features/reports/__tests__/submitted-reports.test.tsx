import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubmittedReports } from "@/features/reports/submitted-reports";
import type { ReportDto } from "@/lib/api/contracts";
import { validUser } from "@/tests/fixtures/contracts";

const mocks = vi.hoisted(() => ({ fetchNextPage: vi.fn(), query: vi.fn(), refetch: vi.fn() }));

vi.mock("@/features/reports/queries", () => ({ useOwnReportsInfiniteQuery: () => mocks.query() }));
vi.mock("@/features/reports/report-evidence-image", () => ({ ReportEvidenceImage: ({ report }: { report: ReportDto }) => <img src="blob:test-evidence" alt={`Evidence for ${report.category}`} /> }));

const report: ReportDto = {
  id: "20000000-0000-4000-8000-000000000001",
  reporterId: validUser.id,
  category: "FLOODED_ROAD",
  description: "Water covers both lanes beside the metro station.",
  severityClaim: "SEVERE",
  finalSeverity: "SEVERE",
  aiUsed: true,
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

function queryState(overrides: Record<string, unknown> = {}) {
  return {
    data: { pages: [{ items: [report], pagination: { hasMore: false, limit: 12, nextCursor: null }, totalCount: 1 }], pageParams: [null] },
    fetchNextPage: mocks.fetchNextPage,
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: mocks.refetch,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.fetchNextPage.mockReset();
  mocks.refetch.mockReset();
  mocks.query.mockReset();
  mocks.query.mockReturnValue(queryState());
});

afterEach(() => cleanup());

describe("submitted report gallery", () => {
  it("shows owned report evidence, status, details, count, and map link", async () => {
    const user = userEvent.setup();
    render(<SubmittedReports />);

    expect(screen.getByRole("heading", { name: "Submitted Reports" })).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveTextContent(report.description);
    expect(screen.getByRole("img", { name: `Evidence for ${report.category}` })).toHaveAttribute("src", "blob:test-evidence");
    expect(screen.getByText("Submitted / unverified")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Severe severity" })).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show on map" })).toHaveAttribute("href", `/map?report=${report.id}&lat=28.33505&lng=77.05345`);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps loading, empty, and error states distinct", async () => {
    const user = userEvent.setup();
    mocks.query.mockReturnValue(queryState({ data: undefined, isLoading: true }));
    const view = render(<SubmittedReports />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading submitted reports");
    expect(screen.queryByText("No submitted reports yet")).not.toBeInTheDocument();

    mocks.query.mockReturnValue(queryState({ data: { pages: [{ items: [], pagination: { hasMore: false, limit: 12, nextCursor: null }, totalCount: 0 }], pageParams: [null] } }));
    view.rerender(<SubmittedReports />);
    expect(screen.getByRole("heading", { name: "No submitted reports yet" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Submit Flood Report" }).every((link) => link.getAttribute("href") === "/reports/new")).toBe(true);

    mocks.query.mockReturnValue(queryState({ data: undefined, isError: true }));
    view.rerender(<SubmittedReports />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load submitted reports");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("loads older cursor pages without hiding current reports", async () => {
    const user = userEvent.setup();
    mocks.query.mockReturnValue(queryState({ hasNextPage: true }));
    render(<SubmittedReports />);
    await user.click(screen.getByRole("button", { name: "Load older reports" }));
    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("article")).toHaveTextContent(report.description);
  });

  it("keeps pagination failures retryable and renders every status tone", async () => {
    const user = userEvent.setup();
    const records = [
      { ...report, id: "20000000-0000-4000-8000-000000000002", verificationStatus: "VERIFIED" as const, locationSource: "DEVICE_GPS" as const },
      { ...report, id: "20000000-0000-4000-8000-000000000003", verificationStatus: "REJECTED" as const },
      { ...report, id: "20000000-0000-4000-8000-000000000004", verificationStatus: "STALE" as const },
    ];
    mocks.query.mockReturnValue(queryState({ data: { pages: [{ items: records, pagination: { hasMore: true, limit: 12, nextCursor: "next" }, totalCount: 3 }], pageParams: [null] }, isError: true }));
    render(<SubmittedReports />);

    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
    expect(screen.getByText("Device GPS")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Older reports could not be loaded");
    await user.click(screen.getByRole("button", { name: "Retry loading older reports" }));
    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
