import { describe, expect, it } from "vitest";
import { IncidentCard } from "@/features/incidents/incident-card";
import { render, screen } from "@testing-library/react";

describe("incident presentation", () => { it("uses linked report count and omits confidence", () => { render(<IncidentCard incident={{ id: "30000000-0000-4000-8000-000000000001", category: "FLOODED_ROAD", severity: "SEVERE", confidenceScore: 99, status: "ACTIVE", latitude: 1, longitude: 1, reportCount: 2, firstReportedAt: "2026-01-01", lastReportedAt: "2026-01-01", createdAt: "2026-01-01", updatedAt: "2026-01-01" }} />); expect(screen.getByText("Linked reports: 2")).toBeInTheDocument(); expect(screen.queryByText("99")).not.toBeInTheDocument(); }); });
