import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppModeProvider, useAppMode } from "@/features/app-mode/app-mode-context";
import { incidentToDisplayAlert, toLiveDisplayReport } from "@/features/app-mode/mode-data";
import type { IncidentDto, ReportDto } from "@/lib/api/contracts";

function ModeProbe() {
  const { mode, setMode } = useAppMode();
  return <><output>{mode}</output><button type="button" onClick={() => setMode(mode === "demo" ? "live" : "demo")}>Toggle mode</button></>;
}

const report: ReportDto = {
  id: "10000000-0000-4000-8000-000000000001", reporterId: "10000000-0000-4000-8000-000000000002", category: "FLOODED_ROAD", description: "Water on the road", severityClaim: "MINOR", finalSeverity: "UNKNOWN", aiUsed: false, aiAnalysis: null,
  latitude: 28.31, longitude: 77.11, gpsAccuracy: null, locationSource: "MANUAL", capturedAt: "2026-07-16T00:00:00.000Z", submittedAt: "2026-07-16T00:00:00.000Z", uploadSource: "WEB", verificationStatus: "PENDING_REVIEW", incidentId: null, createdAt: "2026-07-16T00:00:00.000Z", updatedAt: "2026-07-16T00:00:00.000Z"
};

const incident: IncidentDto = {
  id: "10000000-0000-4000-8000-000000000003", category: "FLOODED_ROAD", severity: "MINOR", confidenceScore: null, status: "ACTIVE", latitude: 28.31, longitude: 77.11,
  reportCount: 2, firstReportedAt: "2026-07-16T00:00:00.000Z", lastReportedAt: "2026-07-16T00:00:00.000Z", createdAt: "2026-07-16T00:00:00.000Z", updatedAt: "2026-07-16T00:00:00.000Z"
};

afterEach(() => {
  cleanup();
  document.cookie = "floodready-app-mode=; Path=/; Max-Age=0";
});

describe("application mode and display adapters", () => {
  it("uses the safe demo fallback outside a provider and persists a selected mode", async () => {
    render(<ModeProbe />);
    expect(screen.getByText("demo")).toBeInTheDocument();
    cleanup();
    render(<AppModeProvider><ModeProbe /></AppModeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Toggle mode" }));
    expect(screen.getByText("live")).toBeInTheDocument();
    expect(document.cookie).toContain("floodready-app-mode=live");
    cleanup();
    render(<AppModeProvider><ModeProbe /></AppModeProvider>);
    await waitFor(() => expect(screen.getByText("live")).toBeInTheDocument());
  });

  it("accepts only the supported stored modes", async () => {
    document.cookie = "floodready-app-mode=demo; Path=/";
    const demo = render(<AppModeProvider><ModeProbe /></AppModeProvider>);
    await waitFor(() => expect(screen.getByText("demo")).toBeInTheDocument());
    demo.unmount();
    document.cookie = "floodready-app-mode=unknown; Path=/";
    render(<AppModeProvider><ModeProbe /></AppModeProvider>);
    expect(screen.getByText("demo")).toBeInTheDocument();
  });

  it("maps every live severity and alert state into clear display metadata", () => {
    expect(toLiveDisplayReport({ ...report, severityClaim: "IMPASSABLE", description: null } as unknown as ReportDto).tone).toBe("red");
    expect(toLiveDisplayReport({ ...report, severityClaim: "SEVERE" }).tone).toBe("red");
    expect(toLiveDisplayReport({ ...report, severityClaim: "MODERATE" }).tone).toBe("orange");
    expect(toLiveDisplayReport(report)).toMatchObject({ tone: "yellow", reporter: "You" });
    expect(incidentToDisplayAlert({ ...incident, severity: "IMPASSABLE" }).level).toBe("Critical");
    expect(incidentToDisplayAlert({ ...incident, severity: "SEVERE" }).level).toBe("Critical");
    expect(incidentToDisplayAlert({ ...incident, status: "RESOLVED" }).level).toBe("Resolved");
    expect(incidentToDisplayAlert(incident)).toMatchObject({ level: "High", address: "28.3100, 77.1100" });
  });
});
