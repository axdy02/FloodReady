import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReportForm } from "@/features/reports/report-form";
import { reportsApi } from "@/features/reports/api";
import { authStore } from "@/features/auth/auth-store";
import type { ReportDto, UserDto } from "@/lib/api/contracts";

vi.mock("@/features/map/map-canvas", () => ({
  MapCanvas: ({ onMapLocationSelect }: { onMapLocationSelect?: (location: { latitude: number; longitude: number }) => void }) => <button type="button" onClick={() => onMapLocationSelect?.({ latitude: 28.31, longitude: 77.11 })}>Choose map point</button>
}));

vi.mock("@/lib/env/client", () => ({
  loadClientEnvironment: () => ({ NEXT_PUBLIC_DEFAULT_MAP_LATITUDE: 28.3, NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE: 77.1, NEXT_PUBLIC_DEFAULT_MAP_ZOOM: 12, NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB: 10, NEXT_PUBLIC_MAP_ATTRIBUTION: "Test attribution", NEXT_PUBLIC_MAP_STYLE_URL: "https://tiles.example.com/style.json" })
}));

const user: UserDto = { id: "10000000-0000-4000-8000-000000000001", name: "Test user", email: "test@example.com", role: "USER", isActive: true, createdAt: "2026-07-16T00:00:00.000Z", updatedAt: "2026-07-16T00:00:00.000Z" };
const createdReport: ReportDto = {
  id: "10000000-0000-4000-8000-000000000002", reporterId: user.id, category: "FLOODED_ROAD", description: "Water covers the road.", severityClaim: "MODERATE", finalSeverity: "UNKNOWN", aiUsed: true, aiAnalysis: null,
  latitude: 28.31, longitude: 77.11, gpsAccuracy: null, locationSource: "MANUAL", capturedAt: "2026-07-16T00:00:00.000Z", submittedAt: "2026-07-16T00:00:00.000Z", uploadSource: "WEB", verificationStatus: "PENDING_REVIEW", incidentId: null, createdAt: "2026-07-16T00:00:00.000Z", updatedAt: "2026-07-16T00:00:00.000Z"
};

const renderForm = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ReportForm /></QueryClientProvider>);

afterEach(() => {
  cleanup();
  authStore.clearSession();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "geolocation");
});

beforeEach(() => {
  authStore.setSession("access-token", user, 3600);
});

describe("ReportForm interactions", () => {
  it("validates missing inputs and explains category-specific weather handling", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add a description, evidence image, and location before submitting.");
    fireEvent.click(screen.getByRole("button", { name: "Clogged drain" }));
    expect(screen.getByText("Weather context is not required for this incident category.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Flooded road" }));
    expect(screen.getByText(/Background AI validation may show weather context/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use current location" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Device location is unavailable");
  });

  it("submits the selected map point and evidence, then links to the persisted report", async () => {
    const create = vi.spyOn(reportsApi, "create").mockResolvedValue(createdReport);
    const { container } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Choose map point" }));
    fireEvent.change(screen.getByPlaceholderText("Describe the flooding, road conditions, and nearby hazards."), { target: { value: createdReport.description } });
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [new File(["image"], "proof.png", { type: "image/png" })] } });
    expect(screen.getByText("proof.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "High" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    const [body, token] = create.mock.calls[0]!;
    expect(token).toBe("access-token");
    expect(body.get("category")).toBe("FLOODED_ROAD");
    expect(body.get("severityClaim")).toBe("SEVERE");
    expect(body.get("latitude")).toBe("28.310000");
    expect(body.get("locationSource")).toBe("MANUAL");
    expect(body.get("image")).toBeInstanceOf(File);
    expect(await screen.findByRole("heading", { name: "Your report is on the map" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View on map" })).toHaveAttribute("href", `/map?report=${createdReport.id}&lat=${createdReport.latitude}&lng=${createdReport.longitude}`);
  });

  it("shows upload validation, supports removing evidence, and preserves a retryable API failure", async () => {
    vi.spyOn(reportsApi, "create").mockRejectedValue(new Error("offline"));
    const { container } = renderForm();
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(["text"], "notes.txt", { type: "text/plain" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose one JPEG, PNG, or WebP image");
    fireEvent.change(input, { target: { files: [new File(["image"], "proof.jpg", { type: "image/jpeg" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Remove evidence image" }));
    expect(screen.queryByText("proof.jpg")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { files: [new File(["image"], "proof.jpg", { type: "image/jpeg" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Choose map point" }));
    fireEvent.change(screen.getByPlaceholderText("Describe the flooding, road conditions, and nearby hazards."), { target: { value: "Flooded lane" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The report could not be submitted. Check your connection and retry once.");
  });

  it("uses valid device coordinates and explains denied or invalid device readings", () => {
    const geolocation = { getCurrentPosition: vi.fn() };
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: geolocation });
    renderForm();
    geolocation.getCurrentPosition.mockImplementationOnce((success: (value: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) => success({ coords: { latitude: 28.34567, longitude: 77.12345, accuracy: 7 } }));
    fireEvent.click(screen.getByRole("button", { name: "Use current location" }));
    expect(screen.getByText("28.34567, 77.12345")).toBeInTheDocument();
    geolocation.getCurrentPosition.mockImplementationOnce((_success: unknown, failure: () => void) => failure());
    fireEvent.click(screen.getByRole("button", { name: "Use current location" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Location permission was denied");
    geolocation.getCurrentPosition.mockImplementationOnce((success: (value: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) => success({ coords: { latitude: 95, longitude: 77, accuracy: 7 } }));
    fireEvent.click(screen.getByRole("button", { name: "Use current location" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The device returned an invalid location");
  });
});
