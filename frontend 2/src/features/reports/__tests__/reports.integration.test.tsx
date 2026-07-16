import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportCard } from "@/features/reports/report-card";
describe("report history", () => { it("labels submitted evidence and claimed severity", () => { render(<ReportCard report={{ id: "20000000-0000-4000-8000-000000000001", reporterId: "10000000-0000-4000-8000-000000000001", category: "FLOODED_ROAD", description: null, severityClaim: "MODERATE", latitude: 0, longitude: 0, gpsAccuracy: null, locationSource: "MANUAL", capturedAt: "2026-01-01", submittedAt: "2026-01-01", uploadSource: "WEB", verificationStatus: "SUBMITTED", incidentId: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" }} />); expect(screen.getByText("Claimed severity: MODERATE")).toBeInTheDocument(); }); });
