import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReportEvidenceImage } from "@/features/reports/report-evidence-image";
import type { ReportDto } from "@/lib/api/contracts";
import { validUser } from "@/tests/fixtures/contracts";

const mocks = vi.hoisted(() => ({ imageQuery: vi.fn(), refetch: vi.fn() }));

vi.mock("@/features/reports/queries", () => ({ useReportImageQuery: (id: string, enabled: boolean) => mocks.imageQuery(id, enabled) }));

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

beforeEach(() => {
  mocks.imageQuery.mockReset();
  mocks.refetch.mockReset();
  vi.stubGlobal("IntersectionObserver", undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("private report evidence", () => {
  it("creates and revokes a temporary object URL", async () => {
    const createObjectURL = vi.fn(() => "blob:private-evidence");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    mocks.imageQuery.mockReturnValue({ data: { blob: new Blob(["image"], { type: "image/jpeg" }), mime: "image/jpeg" }, isError: false, isLoading: false, refetch: mocks.refetch });

    const view = render(<ReportEvidenceImage report={report} />);
    const image = await screen.findByRole("img", { name: /Evidence for Flooded road report/u });
    expect(image).toHaveAttribute("src", "blob:private-evidence");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(mocks.imageQuery).toHaveBeenLastCalledWith(report.id, true);

    view.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:private-evidence");
  });

  it("keeps an unavailable image retryable", async () => {
    const user = userEvent.setup();
    mocks.imageQuery.mockReturnValue({ data: undefined, isError: true, isLoading: false, refetch: mocks.refetch });
    render(<ReportEvidenceImage report={report} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Evidence image unavailable");
    await user.click(screen.getByRole("button", { name: "Retry image" }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.imageQuery).toHaveBeenLastCalledWith(report.id, true));
  });

  it("defers the private request until the image approaches the viewport", async () => {
    let observerCallback: IntersectionObserverCallback | null = null;
    const disconnect = vi.fn();
    const observe = vi.fn();
    class IntersectionObserverMock {
      readonly root = null;
      readonly rootMargin = "240px";
      readonly thresholds: number[] = [];
      readonly disconnect = disconnect;
      readonly observe = observe;
      readonly takeRecords = () => [];
      readonly unobserve = vi.fn();
      constructor(callback: IntersectionObserverCallback) { observerCallback = callback; }
    }
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    mocks.imageQuery.mockReturnValue({ data: undefined, isError: false, isLoading: true, refetch: mocks.refetch });

    render(<ReportEvidenceImage report={report} />);
    expect(mocks.imageQuery).toHaveBeenLastCalledWith(report.id, false);
    expect(observe).toHaveBeenCalledTimes(1);
    if (observerCallback === null) throw new Error("Expected an intersection observer callback");
    act(() => observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));

    await waitFor(() => expect(mocks.imageQuery).toHaveBeenLastCalledWith(report.id, true));
    expect(disconnect).toHaveBeenCalled();
  });
});
