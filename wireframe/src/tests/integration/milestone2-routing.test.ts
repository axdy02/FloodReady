import { beforeEach, describe, expect, it, vi } from "vitest";
import AlertsPage from "@/app/(protected)/alerts/page";
import CommunityPage from "@/app/(protected)/community/page";
import DashboardPage from "@/app/(protected)/dashboard/page";
import ProfilePage from "@/app/(protected)/profile/page";
import ReportPage from "@/app/(protected)/reports/[reportId]/page";
import ReportsPage from "@/app/(protected)/reports/page";
import RoutePlannerPage from "@/app/(protected)/route-planner/page";
import IncidentPage from "@/app/(public)/incidents/[incidentId]/page";
import { SubmittedReports } from "@/features/reports/submitted-reports";

const redirectMock = vi.hoisted(() => vi.fn((path: string): never => `redirect:${path}` as never));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const legacyPages = [
  { name: "alerts", Page: AlertsPage },
  { name: "community", Page: CommunityPage },
  { name: "dashboard", Page: DashboardPage },
  { name: "incident detail", Page: IncidentPage },
  { name: "profile", Page: ProfilePage },
  { name: "report detail", Page: ReportPage },
  { name: "route planner", Page: RoutePlannerPage },
] as const;

describe("Milestone 2 protected routes", () => {
  beforeEach(() => redirectMock.mockClear());

  it.each(legacyPages)("redirects the legacy $name page to the reports map", ({ Page }) => {
    expect(Page()).toBe("redirect:/map");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/map");
  });

  it("renders submitted report history without redirecting", () => {
    expect(ReportsPage().type).toBe(SubmittedReports);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
