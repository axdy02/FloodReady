"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { RoadPath } from "@/features/map/demo-preview-incidents";
import type { MapViewport } from "@/features/map/types";
import type { IncidentDto, ReportMapDto } from "@/lib/api/contracts";

export type MapLayerState = {
  roads: boolean;
  markers: boolean;
  heatmap: boolean;
  shelters: boolean;
  weather: boolean;
  traffic: boolean;
};

export type MapViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type MapRecord = IncidentDto | ReportMapDto;
type MapCanvasData = {
  incidents: readonly MapRecord[];
  roadPaths: Readonly<Record<string, RoadPath>>;
  routes: readonly { coordinates: RoadPath; color: string }[];
  location: { latitude: number; longitude: number } | null | undefined;
};

type MapCanvasCallbacks = {
  onIncidentSelect: ((incidentId: string) => void) | undefined;
  onMapLocationSelect: ((location: { latitude: number; longitude: number }) => void) | undefined;
  onViewportChange: ((bounds: MapViewportBounds) => void) | undefined;
};

// Keep omitted props referentially stable. Otherwise each parent render creates
// a new [] / {} value and unnecessarily recreates the MapLibre instance.
const emptyRecords: readonly MapRecord[] = [];
const emptyRoadPaths: Readonly<Record<string, RoadPath>> = {};
const emptyRoutes: readonly { coordinates: RoadPath; color: string }[] = [];
function isReport(item: MapRecord): item is ReportMapDto {
  return "aiAnalysis" in item;
}

function severityFor(item: MapRecord): string {
  return isReport(item) ? item.aiAnalysis?.suggestedSeverity ?? item.finalSeverity : item.severity;
}

function isPendingReport(item: MapRecord): boolean {
  return isReport(item) && (item.aiAnalysis === null || item.aiAnalysis.status === "PROCESSING");
}

function colorForIncident(item: MapRecord): string {
  if (isPendingReport(item)) return "#94a3b8";

  const severity = severityFor(item);
  if (!isReport(item) && (item.status === "STALE" || item.status === "MONITORING" || item.status === "RESOLVED")) return "#f59e0b";
  if (severity === "SEVERE" || severity === "IMPASSABLE") return "#ef4444";
  if (severity === "MODERATE") return "#f59e0b";
  // Minor and inconclusive reports use yellow: flood markers are never green.
  return "#facc15";
}

const escapePopupText = (value: string) => value.replace(/[&<>\"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
})[character] ?? character);

const incidentBands = (incidents: readonly MapRecord[], roadPaths: Readonly<Record<string, RoadPath>>) => ({
  type: "FeatureCollection" as const,
  features: incidents.flatMap((incident) => {
    const roadPath = roadPaths[incident.id];
    return roadPath === undefined ? [] : [{
      type: "Feature" as const,
      properties: { id: incident.id, color: colorForIncident(incident) },
      geometry: { type: "LineString" as const, coordinates: roadPath }
    }];
  })
});

const incidentPoints = (incidents: readonly MapRecord[]) => ({
  type: "FeatureCollection" as const,
  features: incidents.map((incident) => ({
    type: "Feature" as const,
    properties: {
      id: incident.id,
      color: colorForIncident(incident),
      category: incident.category,
      severity: severityFor(incident),
      pending: isPendingReport(incident)
    },
    geometry: { type: "Point" as const, coordinates: [incident.longitude, incident.latitude] }
  }))
});

const shelters = {
  type: "FeatureCollection" as const,
  features: [
    { type: "Feature" as const, properties: { name: "Gurugram Community Hall" }, geometry: { type: "Point" as const, coordinates: [77.051, 28.334] } },
    { type: "Feature" as const, properties: { name: "Sector 22 Relief Centre" }, geometry: { type: "Point" as const, coordinates: [77.067, 28.346] } }
  ]
};

const weather = {
  type: "FeatureCollection" as const,
  features: [{
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [[[77.01, 28.29], [77.11, 28.29], [77.11, 28.38], [77.01, 28.38], [77.01, 28.29]]] }
  }]
};

const cartoDarkMatterStyle: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO"
    }
  },
  layers: [{ id: "carto-dark", type: "raster", source: "carto", minzoom: 0, maxzoom: 20 }]
};

function selectedLocationData(location: MapCanvasData["location"]) {
  return {
    type: "FeatureCollection" as const,
    features: location === null || location === undefined ? [] : [{
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Point" as const, coordinates: [location.longitude, location.latitude] as [number, number] }
    }]
  };
}

function routeFeatures(routes: MapCanvasData["routes"]) {
  return {
    type: "FeatureCollection" as const,
    features: routes.map((route) => ({
      type: "Feature" as const,
      properties: { color: route.color },
      geometry: { type: "LineString" as const, coordinates: route.coordinates }
    }))
  };
}

function setGeoJsonData(map: MapLibreMap, sourceId: string, data: unknown) {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  source?.setData(data as Parameters<GeoJSONSource["setData"]>[0]);
}

function updateMapData(map: MapLibreMap, data: MapCanvasData) {
  setGeoJsonData(map, "incident-bands", incidentBands(data.incidents, data.roadPaths));
  setGeoJsonData(map, "incident-points", incidentPoints(data.incidents));
  setGeoJsonData(map, "selected-location", selectedLocationData(data.location));
  setGeoJsonData(map, "routes", routeFeatures(data.routes));
}

function setLayerVisibility(map: MapLibreMap, layers: MapLayerState) {
  const visibility = (id: string, enabled: boolean) => map.setLayoutProperty(id, "visibility", enabled ? "visible" : "none");
  visibility("incident-band-shadow", layers.roads);
  visibility("incident-bands", layers.roads);
  visibility("traffic", layers.roads && layers.traffic);
  visibility("incident-points", layers.markers);
  visibility("pending-report-label", layers.markers);
  visibility("selected-incident", layers.markers);
  visibility("heatmap", layers.heatmap);
  visibility("shelters", layers.shelters);
  visibility("weather", layers.weather);
}

function emitViewport(map: MapLibreMap, callback: MapCanvasCallbacks["onViewportChange"]) {
  if (callback === undefined) return;
  const bounds = map.getBounds();
  callback({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() });
}

export function MapCanvas({
  viewport,
  attribution,
  styleUrl,
  incidents = emptyRecords,
  roadPaths = emptyRoadPaths,
  routes = emptyRoutes,
  layers,
  selectedIncidentId,
  onIncidentSelect,
  location,
  onMapLocationSelect,
  onViewportChange
}: {
  viewport: MapViewport;
  attribution: string;
  styleUrl: string;
  incidents?: readonly MapRecord[];
  roadPaths?: Readonly<Record<string, RoadPath>>;
  routes?: readonly { coordinates: RoadPath; color: string }[];
  layers: MapLayerState;
  selectedIncidentId?: string | null | undefined;
  onIncidentSelect?: (incidentId: string) => void;
  location?: { latitude: number; longitude: number } | null;
  onMapLocationSelect?: (location: { latitude: number; longitude: number }) => void;
  onViewportChange?: (bounds: MapViewportBounds) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [loadError, setLoadError] = useState(false);
  const initialViewportRef = useRef(viewport);
  const dataRef = useRef<MapCanvasData>({ incidents, roadPaths, routes, location });
  const layersRef = useRef(layers);
  const callbacksRef = useRef<MapCanvasCallbacks>({ onIncidentSelect, onMapLocationSelect, onViewportChange });

  useEffect(() => {
    dataRef.current = { incidents, roadPaths, routes, location };
  }, [incidents, location, roadPaths, routes]);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    callbacksRef.current = { onIncidentSelect, onMapLocationSelect, onViewportChange };
  }, [onIncidentSelect, onMapLocationSelect, onViewportChange]);

  useEffect(() => {
    let active = true;
    setLoadError(false);

    void import("maplibre-gl").then(({ Map, Popup }) => {
      if (!active || container.current === null) return;

      // OpenFreeMap's hosted style occasionally returns a partial/error response
      // in local Docker/browser sessions. Use the self-contained CARTO raster
      // style for that provider so the map still renders its basemap reliably.
      const mapStyle = styleUrl.includes("openfreemap.org") || styleUrl.includes("cartocdn.com") ? cartoDarkMatterStyle : styleUrl;
      const initialViewport = initialViewportRef.current;
      const map = new Map({
        container: container.current,
        style: mapStyle,
        center: [initialViewport.longitude, initialViewport.latitude],
        zoom: initialViewport.zoom,
        minZoom: 1,
        maxZoom: 18,
        attributionControl: false
      });
      mapRef.current = map;

      let styleLoaded = false;
      map.on("error", () => {
        // Tile retries are expected on a live map. Only surface a warning when
        // the style itself failed before MapLibre emitted its load event.
        if (active && !styleLoaded) setLoadError(true);
      });
      map.once("load", () => {
        if (!active) return;
        styleLoaded = true;

        const data = dataRef.current;
        map.addSource("incident-bands", { type: "geojson", data: incidentBands(data.incidents, data.roadPaths) });
        map.addSource("incident-points", { type: "geojson", data: incidentPoints(data.incidents) });
        map.addSource("shelters", { type: "geojson", data: shelters });
        map.addSource("weather", { type: "geojson", data: weather });
        map.addSource("selected-location", { type: "geojson", data: selectedLocationData(data.location) });
        map.addSource("routes", { type: "geojson", data: routeFeatures(data.routes) });

        map.addLayer({ id: "weather", type: "fill", source: "weather", paint: { "fill-color": "#2563eb", "fill-opacity": 0.12 } });
        map.addLayer({ id: "route-shadow", type: "line", source: "routes", paint: { "line-color": "#020617", "line-width": 10, "line-opacity": 0.55 } });
        map.addLayer({ id: "routes", type: "line", source: "routes", paint: { "line-color": ["get", "color"], "line-width": 5, "line-opacity": 0.95 } });
        map.addLayer({ id: "incident-band-shadow", type: "line", source: "incident-bands", paint: { "line-color": "#020617", "line-opacity": 0.45, "line-width": 13, "line-blur": 2 } });
        map.addLayer({ id: "incident-bands", type: "line", source: "incident-bands", paint: { "line-color": ["get", "color"], "line-width": 6, "line-opacity": 0.94 } });
        map.addLayer({ id: "traffic", type: "line", source: "incident-bands", paint: { "line-color": "#ffffff", "line-opacity": 0.75, "line-width": 1.5, "line-dasharray": [1, 2] } });
        map.addLayer({ id: "heatmap", type: "heatmap", source: "incident-points", paint: { "heatmap-weight": 1, "heatmap-intensity": 1.2, "heatmap-radius": 38, "heatmap-opacity": 0.7, "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(59,130,246,0)", 0.35, "#2563eb", 0.7, "#facc15", 1, "#ef4444"] } });
        map.addLayer({ id: "incident-points", type: "circle", source: "incident-points", paint: { "circle-color": ["get", "color"], "circle-radius": 9, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.2 } });
        map.addLayer({ id: "pending-report-label", type: "symbol", source: "incident-points", filter: ["==", ["get", "pending"], true], layout: { "text-field": "?", "text-size": 12, "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"] }, paint: { "text-color": "#0f172a" } });
        map.addLayer({ id: "selected-incident", type: "circle", source: "incident-points", filter: ["==", ["get", "id"], ""], paint: { "circle-color": "transparent", "circle-radius": 13, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 } });
        map.addLayer({ id: "shelters", type: "circle", source: "shelters", paint: { "circle-color": "#38bdf8", "circle-radius": 7, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
        map.addLayer({ id: "selected-location-radius", type: "circle", source: "selected-location", paint: { "circle-color": "#ffffff", "circle-opacity": 0.10, "circle-radius": 42, "circle-stroke-color": "#ffffff", "circle-stroke-opacity": 0.55, "circle-stroke-width": 1 } });
        map.addLayer({ id: "selected-location", type: "circle", source: "selected-location", paint: { "circle-color": "#ffffff", "circle-radius": 8, "circle-stroke-color": "#111113", "circle-stroke-width": 2 } });

        setLayerVisibility(map, layersRef.current);
        map.setFilter("selected-incident", ["==", ["get", "id"], selectedIncidentId ?? ""]);
        emitViewport(map, callbacksRef.current.onViewportChange);

        const pointerOn = () => { map.getCanvas().style.cursor = "pointer"; };
        const pointerOff = () => { map.getCanvas().style.cursor = ""; };
        map.on("mouseenter", "incident-points", pointerOn);
        map.on("mouseleave", "incident-points", pointerOff);

        map.on("click", "incident-points", (event) => {
          const feature = event.features?.[0];
          const id = String(feature?.properties?.id ?? "");
          if (id === "") return;

          callbacksRef.current.onIncidentSelect?.(id);
          const category = String(feature?.properties?.category ?? "Incident").replaceAll("_", " ");
          const severity = String(feature?.properties?.severity ?? "");
          new Popup({ closeButton: false, offset: 12 })
            .setLngLat(event.lngLat)
            .setHTML(`<div style="min-width:150px;color:#182238 !important"><strong style="display:block;color:#182238 !important;text-transform:uppercase;letter-spacing:.04em">${escapePopupText(category)}</strong><span style="display:block;margin-top:4px;color:#182238 !important">${escapePopupText(severity)}</span></div>`)
            .addTo(map);
        });

        map.on("click", (event) => callbacksRef.current.onMapLocationSelect?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }));

        map.on("moveend", () => emitViewport(map, callbacksRef.current.onViewportChange));
      });
    }).catch(() => {
      if (active) setLoadError(true);
    });

    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !map.isStyleLoaded()) return;
    updateMapData(map, { incidents, roadPaths, routes, location });
  }, [incidents, location, roadPaths, routes]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !map.isStyleLoaded()) return;
    setLayerVisibility(map, layers);
  }, [layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !map.isStyleLoaded()) return;
    map.setFilter("selected-incident", ["==", ["get", "id"], selectedIncidentId ?? ""]);
  }, [selectedIncidentId]);

  useEffect(() => {
    const map = mapRef.current;
    const incident = incidents.find((item) => item.id === selectedIncidentId);
    if (map === null || incident === undefined || !map.isStyleLoaded()) return;
    map.flyTo({ center: [incident.longitude, incident.latitude], zoom: Math.max(map.getZoom(), 14), essential: true });
  }, [incidents, selectedIncidentId]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !map.isStyleLoaded()) return;
    const currentCenter = map.getCenter();
    if (Math.abs(currentCenter.lat - viewport.latitude) < 0.000001 && Math.abs(currentCenter.lng - viewport.longitude) < 0.000001 && Math.abs(map.getZoom() - viewport.zoom) < 0.001) return;
    map.jumpTo({ center: [viewport.longitude, viewport.latitude], zoom: viewport.zoom });
  }, [viewport.latitude, viewport.longitude, viewport.zoom]);

  return <section aria-label="FloodReady map" className="relative h-full overflow-hidden bg-[#0d1015]">
    <div ref={container} className="h-full w-full bg-[#0d1015]" />
    {loadError ? <p role="status" className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-xl border border-amber-400/25 bg-[#17171a] px-4 py-3 text-sm text-amber-200 shadow-xl">The basemap could not load. Map overlays are still available.</p> : null}
    <span className="absolute bottom-2 right-3 text-[10px] text-zinc-600">{attribution}</span>
  </section>;
}
