import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlannedFeaturesDemo, resetWireframeSessionState } from "@/features/planned-features/planned-features-demo";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  getSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => navigation.getSearchParams(),
}));

describe("planned features wireframe", () => {
  beforeEach(() => {
    resetWireframeSessionState();
    navigation.push.mockReset();
    navigation.getSearchParams.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    cleanup();
    resetWireframeSessionState();
  });

  it("labels simulated data and changes the map empty state with a demo scenario", () => {
    render(<PlannedFeaturesDemo page="map" />);
    expect(screen.getByText("PLANNED FEATURES WIREFRAME")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "No reports" }));
    expect(screen.getByText("No active reports found in this area")).toBeInTheDocument();
  });

  it("dismisses a simulated nearby alert for the current session", () => {
    const firstVisit = render(<PlannedFeaturesDemo page="map" />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss nearby alert" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    firstVisit.unmount();

    render(<PlannedFeaturesDemo page="map" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a materially different heavy-rainfall scenario and restores local state on reset", () => {
    render(<PlannedFeaturesDemo page="map" />);
    fireEvent.click(screen.getByRole("button", { name: "Heavy rainfall" }));
    expect(screen.getByText(/Heavy rainfall simulation active/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Sector 18 Underpass Incident, 26 reports" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss nearby alert" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(screen.getByRole("button", { name: "Open Sector 18 Underpass Incident, 18 reports" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("keeps supplied area coordinates when opening the full simulated map", () => {
    navigation.getSearchParams.mockReturnValue(new URLSearchParams("area=Sector+18%2C+Gurugram&lat=28.374&lng=77.045&source=watch-area"));
    render(<PlannedFeaturesDemo page="area" />);
    fireEvent.click(screen.getByRole("button", { name: /Open full map/ }));
    expect(navigation.push).toHaveBeenCalledWith("/wireframe/planned-features/map?area=Sector+18%2C+Gurugram&lat=28.374&lng=77.045&source=watch-area&focus=area");
  });

  it("saves an alert area for the local wireframe session", () => {
    const alerts = render(<PlannedFeaturesDemo page="alerts" />);
    const saveButtons = screen.getAllByRole("button", { name: "Save area" });
    expect(saveButtons).toHaveLength(3);
    fireEvent.click(saveButtons[0]!);
    expect(screen.getByText("Sector 18 underpass watch area was added to this wireframe session.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
    alerts.unmount();

    render(<PlannedFeaturesDemo page="saved-areas" />);
    expect(screen.getByRole("heading", { name: "Sector 18 underpass watch area" })).toBeInTheDocument();
  });

  it("uses category-specific lifecycle copy and an honest gallery counter", () => {
    render(<PlannedFeaturesDemo page="map" />);
    expect(screen.getByText("Simulated sample 1 of 3; this cluster represents 11 reported photos.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open manhole" }));
    expect(screen.getByText(/Open-manhole lifecycle/)).toBeInTheDocument();
    expect(screen.getByText(/No simulated gallery samples are included for this cluster/)).toBeInTheDocument();
  });

  it("exercises gallery controls, confirmations, and every map lifecycle scenario", () => {
    render(<PlannedFeaturesDemo page="map" />);
    fireEvent.click(screen.getByRole("button", { name: "Next gallery photo" }));
    expect(screen.getByText("Simulated sample 2 of 3; this cluster represents 11 reported photos.")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("region", { name: "Simulated cluster image gallery" }), { key: "ArrowRight" });
    expect(screen.getByText("Simulated sample 3 of 3; this cluster represents 11 reported photos.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Why this may worsen" }));
    expect(screen.getByText("No live rainfall feed is used in this prototype.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Still flooded" }));
    expect(screen.getByRole("status")).toHaveTextContent("Still flooded confirmation recorded in the wireframe.");
    fireEvent.click(screen.getByRole("button", { name: "Road is clear" }));
    expect(screen.getByRole("status")).toHaveTextContent("Road-clear confirmation recorded in the wireframe.");

    fireEvent.click(screen.getByRole("button", { name: "Cluster expanding" }));
    expect(screen.getByRole("button", { name: "Open Sector 18 Underpass Incident, 21 reports" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Road blocked" }));
    expect(screen.getByText("Road passability").parentElement).toHaveTextContent("Impassable");
    fireEvent.click(screen.getByRole("button", { name: "Incident becoming stale" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Market Road Drain Cluster, 8 reports" }));
    expect(screen.getByText(/Flooding lifecycle: the last supporting report is old/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Incident resolved" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Market Road Drain Cluster, 8 reports" }));
    expect(screen.getByText(/Flooding lifecycle: this simulated event has enough road-clear evidence/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Weather unavailable" }));
    expect(screen.getByText("Weather context is temporarily unavailable. Incident reports remain visible.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Simulated cluster image gallery" })).not.toBeInTheDocument();
  });

  it("models area search failures, AI-unavailable copy, and the empty-area scenario", () => {
    render(<PlannedFeaturesDemo page="area" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search mock area" }), { target: { value: "Unknown locality" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Area could not be found");
    fireEvent.click(screen.getByRole("button", { name: "Use current location" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "AI summary unavailable" }));
    expect(screen.getByText("AI summary temporarily unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "No reports" }));
    expect(screen.getByRole("status")).toHaveTextContent("No active reports found in this area");
    fireEvent.click(screen.getByRole("button", { name: "Search failure" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Area could not be found");
  });

  it("navigates and dismisses simulated alerts, and allows all saved areas to be removed", () => {
    render(<PlannedFeaturesDemo page="alerts" />);
    fireEvent.click(screen.getAllByRole("button", { name: "View on map" })[0]!);
    expect(navigation.push).toHaveBeenCalledWith("/wireframe/planned-features/map?cluster=sector-18-underpass");
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]!);
    expect(screen.queryByText("Road blocked nearby")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "No reports" }));
    expect(screen.getByRole("status")).toHaveTextContent("No alerts in this wireframe scenario.");
    cleanup();
    render(<PlannedFeaturesDemo page="saved-areas" />);
    for (const button of screen.getAllByRole("button", { name: "Remove" })) fireEvent.click(button);
    expect(screen.getByRole("status")).toHaveTextContent("No saved areas remain in this simulation.");
  });
});
