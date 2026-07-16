import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapCanvas, type MapLayerState } from "@/features/map/map-canvas";
import type { IncidentDto, ReportMapDto } from "@/lib/api/contracts";

type Handler = (event?: { features?: Array<{ properties?: Record<string, unknown> }>; lngLat: { lat: number; lng: number } }) => void;

const mockState = vi.hoisted(() => ({ maps: [] as Array<Record<string, unknown>>, popups: [] as Array<Record<string, unknown>> }));

vi.mock("maplibre-gl", () => {
  class MockPopup {
    setLngLat = vi.fn(() => this);
    setHTML = vi.fn(() => this);
    addTo = vi.fn(() => this);
    constructor() { mockState.popups.push(this as unknown as Record<string, unknown>); }
  }

  class MockMap {
    readonly handlers = new Map<string, Handler>();
    readonly sources = new Map<string, { data: unknown; setData: ReturnType<typeof vi.fn> }>();
    readonly addLayer = vi.fn();
    readonly setLayoutProperty = vi.fn();
    readonly setFilter = vi.fn();
    readonly flyTo = vi.fn();
    readonly jumpTo = vi.fn();
    readonly remove = vi.fn();
    readonly getCanvas = vi.fn(() => ({ style: { cursor: "" } }));
    readonly getBounds = vi.fn(() => ({ getWest: () => 77, getSouth: () => 28, getEast: () => 78, getNorth: () => 29 }));
    readonly getCenter = vi.fn(() => ({ lat: 28.3, lng: 77.1 }));
    readonly getZoom = vi.fn(() => 12);
    readonly isStyleLoaded = vi.fn(() => true);
    readonly addSource = vi.fn((id: string, value: { data: unknown }) => this.sources.set(id, { data: value.data, setData: vi.fn() }));

    constructor(readonly options: Record<string, unknown>) { mockState.maps.push(this as unknown as Record<string, unknown>); }

    on(event: string, layerOrHandler: string | Handler, maybeHandler?: Handler) {
      this.handlers.set(typeof layerOrHandler === "string" ? `${event}:${layerOrHandler}` : event, typeof layerOrHandler === "string" ? maybeHandler! : layerOrHandler);
      return this;
    }

    once(event: string, handler: Handler) {
      this.handlers.set(event, handler);
      if (event === "load") queueMicrotask(() => handler());
      return this;
    }

    getSource(id: string) { return this.sources.get(id); }

    fire(event: string, layer: string | undefined, payload: Parameters<Handler>[0]) {
      this.handlers.get(layer === undefined ? event : `${event}:${layer}`)?.(payload);
    }
  }

  return { Map: MockMap, Popup: MockPopup };
});

const layers: MapLayerState = { roads: true, markers: true, heatmap: false, shelters: false, weather: false, traffic: true };

const incident: IncidentDto = {
  id: "10000000-0000-4000-8000-000000000001", category: "FLOODED_ROAD", severity: "SEVERE", confidenceScore: 0.9, status: "ACTIVE", latitude: 28.31, longitude: 77.11,
  reportCount: 2, firstReportedAt: "2026-07-16T00:00:00.000Z", lastReportedAt: "2026-07-16T00:00:00.000Z", createdAt: "2026-07-16T00:00:00.000Z", updatedAt: "2026-07-16T00:00:00.000Z"
};

const pendingReport: ReportMapDto = {
  id: "10000000-0000-4000-8000-000000000002", category: "ROAD_WATERLOGGING", severityClaim: "MINOR", finalSeverity: "UNKNOWN", aiUsed: true,
  aiAnalysis: { status: "PROCESSING", floodDetected: null, suggestedSeverity: null, confidenceScore: null, validationScore: null, validationOutcome: null, needsHumanReview: null },
  latitude: 28.32, longitude: 77.12, capturedAt: "2026-07-16T00:00:00.000Z", submittedAt: "2026-07-16T00:00:00.000Z", verificationStatus: "PENDING_REVIEW", incidentId: null, updatedAt: "2026-07-16T00:00:00.000Z", canViewDetails: true
};

const props = {
  viewport: { latitude: 28.3, longitude: 77.1, zoom: 12 }, attribution: "Map test attribution", styleUrl: "https://tiles.example.com/style.json", layers,
  incidents: [incident, pendingReport], roadPaths: { [incident.id]: [[77.1, 28.3], [77.11, 28.31]] as [number, number][] },
  routes: [{ coordinates: [[77.1, 28.3], [77.12, 28.32]] as [number, number][], color: "#2563eb" }], location: { latitude: 28.33, longitude: 77.13 },
};

const latestMap = () => mockState.maps.at(-1) as unknown as {
  options: Record<string, unknown>; addLayer: ReturnType<typeof vi.fn>; setLayoutProperty: ReturnType<typeof vi.fn>; setFilter: ReturnType<typeof vi.fn>; flyTo: ReturnType<typeof vi.fn>; jumpTo: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; sources: Map<string, { data: unknown; setData: ReturnType<typeof vi.fn> }>; fire: (event: string, layer: string | undefined, payload: Parameters<Handler>[0]) => void;
};

afterEach(() => {
  cleanup();
  mockState.maps.length = 0;
  mockState.popups.length = 0;
});

describe("MapCanvas", () => {
  it("renders MapLibre sources, layers, viewport data, and callback events without rebuilding on data changes", async () => {
    const onIncidentSelect = vi.fn();
    const onMapLocationSelect = vi.fn();
    const onViewportChange = vi.fn();
    const { rerender } = render(<MapCanvas {...props} onIncidentSelect={onIncidentSelect} onMapLocationSelect={onMapLocationSelect} onViewportChange={onViewportChange} />);

    await waitFor(() => expect(mockState.maps).toHaveLength(1));
    const map = latestMap();
    expect(map.options.center).toEqual([77.1, 28.3]);
    expect(map.addLayer).toHaveBeenCalledTimes(13);
    expect(map.sources.get("incident-points")).toBeDefined();
    expect(map.setLayoutProperty).toHaveBeenCalledWith("traffic", "visibility", "visible");
    expect(onViewportChange).toHaveBeenCalledWith({ west: 77, south: 28, east: 78, north: 29 });

    map.fire("click", "incident-points", { lngLat: { lat: 28.31, lng: 77.11 }, features: [{ properties: { id: incident.id, category: "FLOODED_ROAD", severity: "SEVERE" } }] });
    map.fire("click", undefined, { lngLat: { lat: 28.34, lng: 77.14 } });
    map.fire("moveend", undefined, { lngLat: { lat: 28.3, lng: 77.1 } });
    expect(onIncidentSelect).toHaveBeenCalledWith(incident.id);
    expect(onMapLocationSelect).toHaveBeenCalledWith({ latitude: 28.34, longitude: 77.14 });
    expect(mockState.popups).toHaveLength(1);

    rerender(<MapCanvas {...props} incidents={[pendingReport]} selectedIncidentId={pendingReport.id} layers={{ ...layers, weather: true, traffic: false }} onIncidentSelect={onIncidentSelect} onMapLocationSelect={onMapLocationSelect} onViewportChange={onViewportChange} />);
    await waitFor(() => expect(map.sources.get("incident-points")?.setData).toHaveBeenCalledTimes(1));
    expect(mockState.maps).toHaveLength(1);
    expect(map.flyTo).toHaveBeenCalledWith({ center: [pendingReport.longitude, pendingReport.latitude], zoom: 14, essential: true });
    expect(map.setFilter).toHaveBeenCalledWith("selected-incident", ["==", ["get", "id"], pendingReport.id]);
    expect(map.setLayoutProperty).toHaveBeenCalledWith("weather", "visibility", "visible");
    expect(map.setLayoutProperty).toHaveBeenCalledWith("traffic", "visibility", "none");
  });

  it("uses the safe CARTO style, ignores post-load tile retries, and removes the map on unmount", async () => {
    const view = render(<MapCanvas {...props} styleUrl="https://tiles.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" />);
    await waitFor(() => expect(mockState.maps).toHaveLength(1));
    const map = latestMap();
    expect(map.options.style).toMatchObject({ version: 8 });
    map.fire("error", undefined, { lngLat: { lat: 28.3, lng: 77.1 } });
    expect(screen.queryByText("The basemap could not load. Map overlays are still available.")).not.toBeInTheDocument();
    view.unmount();
    expect(map.remove).toHaveBeenCalledOnce();
  });

  it("covers neutral severities, empty click records, default cluster radius, and deliberate viewport movement", async () => {
    const minor = { ...incident, id: "10000000-0000-4000-8000-000000000003", severity: "MINOR" as const };
    const moderate = { ...incident, id: "10000000-0000-4000-8000-000000000004", severity: "MODERATE" as const };
    const stale = { ...incident, id: "10000000-0000-4000-8000-000000000005", severity: "SEVERE" as const, status: "STALE" as const };
    const { rerender } = render(<MapCanvas {...props} incidents={[minor, moderate, stale]} roadPaths={{}} routes={[]} location={null} selectedIncidentId="missing" layers={{ roads: false, markers: false, heatmap: true, shelters: true, weather: true, traffic: false }} />);
    await waitFor(() => expect(mockState.maps).toHaveLength(1));
    const map = latestMap();
    const pointData = map.sources.get("incident-points")?.data as { features: Array<{ properties: { color: string } }> };
    expect(pointData.features.map((feature) => feature.properties.color)).toEqual(["#facc15", "#f59e0b", "#f59e0b"]);
    map.fire("click", "incident-points", { lngLat: { lat: 28.3, lng: 77.1 }, features: [{ properties: {} }] });
    expect(mockState.popups).toHaveLength(0);
    rerender(<MapCanvas {...props} incidents={[minor, moderate, stale]} viewport={{ latitude: 28.31, longitude: 77.11, zoom: 13 }} />);
    await waitFor(() => expect(map.jumpTo).toHaveBeenCalledWith({ center: [77.11, 28.31], zoom: 13 }));
  });
});
