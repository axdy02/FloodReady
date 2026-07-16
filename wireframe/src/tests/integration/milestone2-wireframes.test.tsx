import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MapPage from "@/app/(protected)/map/page";
import { authStore } from "@/features/auth/auth-store";
import { ReportForm } from "@/features/reports/report-form";
import { validUser } from "@/tests/fixtures/contracts";

const mocks = vi.hoisted(() => ({ analyze: vi.fn(), submitDraft: vi.fn(), detailQuery: vi.fn(), mapQuery: vi.fn(), refetch: vi.fn() }));

vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/env/client", () => ({ loadClientEnvironment: () => ({ NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001/api/v1", NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000", NEXT_PUBLIC_MAP_STYLE_URL: "https://map.test.invalid/style.json", NEXT_PUBLIC_MAP_ATTRIBUTION: "Test map", NEXT_PUBLIC_MAP_CONNECT_ORIGINS: ["https://map.test.invalid"], NEXT_PUBLIC_MAP_IMAGE_ORIGINS: ["https://map.test.invalid"], NEXT_PUBLIC_DEFAULT_MAP_LATITUDE: 28.33505, NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE: 77.05345, NEXT_PUBLIC_DEFAULT_MAP_ZOOM: 10, NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB: 10 }) }));
vi.mock("@/features/reports/api", () => ({ reportsApi: { analyze: mocks.analyze, submitDraft: mocks.submitDraft } }));
vi.mock("@/features/map/queries", () => ({ useReportMapQuery: () => mocks.mapQuery(), useReportDetailQuery: () => mocks.detailQuery() }));
vi.mock("@/features/map/map-canvas", () => ({ MapCanvas: ({ incidents = [], onIncidentSelect, onMapLocationSelect }: { incidents?: Array<{ id: string }>; onIncidentSelect?: (id: string) => void; onMapLocationSelect?: (location: { latitude: number; longitude: number }) => void }) => <div aria-label="Test map"><button type="button" onClick={() => onMapLocationSelect?.({ latitude: 28.33505, longitude: 77.05345 })}>Choose map point</button>{incidents.map((report) => <button type="button" key={report.id} onClick={() => onIncidentSelect?.(report.id)}>Select report marker</button>)}</div> }));

const createdReport = {
  id: "20000000-0000-4000-8000-000000000001",
  reporterId: validUser.id,
  category: "FLOODED_ROAD" as const,
  description: "Water covers both lanes beside the metro station.",
  severityClaim: "SEVERE" as const,
  finalSeverity: "SEVERE" as const,
  aiUsed: true,
  aiAnalysis: null,
  latitude: 28.33505,
  longitude: 77.05345,
  gpsAccuracy: null,
  locationSource: "MANUAL" as const,
  capturedAt: "2026-07-14T09:00:00.000Z",
  submittedAt: "2026-07-14T09:00:01.000Z",
  uploadSource: "WEB",
  verificationStatus: "SUBMITTED" as const,
  incidentId: null,
  createdAt: "2026-07-14T09:00:01.000Z",
  updatedAt: "2026-07-14T09:00:01.000Z",
};

const mapReport = {
  id: createdReport.id,
  category: createdReport.category,
  severityClaim: createdReport.severityClaim,
  finalSeverity: createdReport.finalSeverity,
  aiUsed: createdReport.aiUsed,
  aiAnalysis: null,
  latitude: createdReport.latitude,
  longitude: createdReport.longitude,
  capturedAt: createdReport.capturedAt,
  submittedAt: createdReport.submittedAt,
  verificationStatus: createdReport.verificationStatus,
  incidentId: null,
  updatedAt: createdReport.updatedAt,
  canViewDetails: true,
};

beforeEach(() => {
  mocks.analyze.mockReset();
  mocks.submitDraft.mockReset();
  mocks.mapQuery.mockReset();
  mocks.detailQuery.mockReset();
  mocks.refetch.mockReset();
  authStore.clearSession();
  authStore.setSession("access-token", validUser, 900);
  mocks.mapQuery.mockReturnValue({ data: { items: [mapReport], pagination: { hasMore: false, limit: 100, nextCursor: null }, totalCount: 1 }, isError: false, isFetching: false, isLoading: false, refetch: mocks.refetch });
  mocks.detailQuery.mockReturnValue({ data: createdReport, isLoading: false });
});

afterEach(() => cleanup());

describe("Milestone 2 functional wireframes", () => {
  it("captures a map location, prevents duplicate submission, and uses the created backend report", async () => {
    const user = userEvent.setup();
    const draft = { draftId: createdReport.id, expiresAt: "2026-07-14T09:30:00.000Z", category: createdReport.category, description: createdReport.description, severityClaim: createdReport.severityClaim, latitude: createdReport.latitude, longitude: createdReport.longitude, gpsAccuracy: null, locationSource: "MANUAL" as const, capturedAt: createdReport.capturedAt, analysis: { id: "20000000-0000-4000-8000-000000000002", status: "FAILED" as const, floodDetected: null, suggestedSeverity: null, confidenceScore: null, validationScore: null, validationOutcome: null, weatherSummary: null, weatherPrecipitationMm: null, weatherTemperatureC: null, waterLevelCategory: null, roadPassability: null, imageQuality: null, summary: null, evidenceFlags: [], needsHumanReview: null, modelName: null, modelVersion: null, processingTimeMs: null } };
    mocks.analyze.mockResolvedValue(draft);
    mocks.submitDraft.mockResolvedValue(createdReport);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { container } = render(<QueryClientProvider client={queryClient}><ReportForm /></QueryClientProvider>);

    await user.type(screen.getByLabelText("Description"), createdReport.description);
    await user.click(screen.getByRole("button", { name: "Choose map point" }));
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (fileInput === null) throw new Error("Expected evidence input");
    await user.upload(fileInput, new File(["image"], "flood.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Analyze with AI" }));
    await user.click(screen.getByRole("button", { name: "Continue without AI" }));
    const submit = screen.getByRole("button", { name: "Submit final report" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(await screen.findByRole("heading", { name: "Flood report created" })).toBeInTheDocument();
    expect(mocks.analyze).toHaveBeenCalledTimes(1);
    const form = mocks.analyze.mock.calls[0]?.[0] as FormData;
    expect(form.get("latitude")).toBe("28.33505");
    expect(form.get("longitude")).toBe("77.05345");
    expect(form.get("locationSource")).toBe("MANUAL");
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reports", "map"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["actor", validUser.id] });
    expect(screen.getByRole("link", { name: "View submitted reports" })).toHaveAttribute("href", "/reports");
    expect(screen.getByRole("link", { name: "Show persisted marker on map" })).toHaveAttribute("href", expect.stringContaining(createdReport.id));
    await user.click(screen.getByRole("button", { name: "Submit another" }));
    expect(screen.getByRole("heading", { name: "Submit Flood Report" })).toBeInTheDocument();
  });

  it("keeps local validation, device location, evidence controls, and uncertain network errors explicit", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const position: GeolocationPosition = { coords: { accuracy: 8, altitude: null, altitudeAccuracy: null, heading: null, latitude: 28.34, longitude: 77.06, speed: null, toJSON: () => ({}) }, timestamp: Date.now(), toJSON: () => ({}) };
    const getCurrentPosition = vi.fn((success: PositionCallback) => success(position));
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    mocks.analyze.mockRejectedValue(new Error("connection ended"));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(<QueryClientProvider client={queryClient}><ReportForm /></QueryClientProvider>);

    await user.click(screen.getByRole("button", { name: "Analyze with AI" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a description");
    await user.type(screen.getByLabelText("Description"), createdReport.description);
    await user.click(screen.getByRole("button", { name: "Analyze with AI" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Select the report location");
    await user.click(screen.getByRole("button", { name: "Use device location" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/device GPS/u)).toBeInTheDocument();

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (fileInput === null) throw new Error("Expected evidence input");
    await user.upload(fileInput, new File(["bad"], "notes.txt", { type: "text/plain" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose one JPEG");
    await user.upload(fileInput, new File(["image"], "flood.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Remove evidence image" }));
    expect(screen.getByRole("button", { name: "Choose one image" })).toBeInTheDocument();
    await user.upload(fileInput, new File(["image"], "flood.png", { type: "image/png" }));
    await user.selectOptions(screen.getByLabelText("Category"), "UNDERPASS_FLOODING");
    await user.selectOptions(screen.getByLabelText("Your severity"), "IMPASSABLE");
    await user.click(screen.getByRole("button", { name: "Analyze with AI" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("AI analysis could not start");
  });

  it("renders persisted map results and opens the matching stored report details", async () => {
    const user = userEvent.setup();
    render(<MapPage />);
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent?.includes("1 persisted report in this area") === true)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Select report marker" }));
    expect(screen.getByRole("heading", { name: "Flooded road" })).toBeInTheDocument();
    expect(screen.getByText(createdReport.description)).toBeInTheDocument();
    expect(screen.getByText("Severe")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close report details" }));
    expect(screen.queryByLabelText("Report marker details")).not.toBeInTheDocument();
  });

  it("shows a clear empty map state without inventing reports", () => {
    mocks.mapQuery.mockReturnValue({ data: { items: [], pagination: { hasMore: false, limit: 100, nextCursor: null }, totalCount: 0 }, isError: false, isFetching: false, isLoading: false, refetch: vi.fn() });
    render(<MapPage />);
    expect(screen.getByText(/No reports exist in this map area yet/i)).toBeInTheDocument();
  });

  it("renders a retryable reports API error", async () => {
    const user = userEvent.setup();
    mocks.mapQuery.mockReturnValue({ data: undefined, isError: true, isFetching: false, isLoading: false, refetch: mocks.refetch });
    render(<MapPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load reports");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});
