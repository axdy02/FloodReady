"use client";

import { useAppMode } from "@/features/app-mode/app-mode-context";
import { demoMapIncidents } from "@/features/app-mode/mode-data";
import { useIncidentsQuery } from "@/features/incidents/queries";
import { demoPreviewRoadPaths } from "@/features/map/demo-preview-incidents";
import { MapCanvas, type MapLayerState } from "@/features/map/map-canvas";
import { loadClientEnvironment } from "@/lib/env/client";

const landingLayers: MapLayerState = { roads: true, markers: true, heatmap: false, shelters: false, weather: false, traffic: false };

export function LandingMapPreview({ small = false, fill = false }: { small?: boolean; fill?: boolean }) {
  const { mode } = useAppMode();
  const liveIncidents = useIncidentsQuery(mode === "live" ? "?limit=100&sort=desc" : "");
  let env: ReturnType<typeof loadClientEnvironment>;
  try {
    env = loadClientEnvironment();
  } catch {
    return <div aria-label="WaterRadar map preview" className={`bg-[#0d1015] ${fill ? "h-full" : small ? "h-[18rem] rounded-2xl" : "h-[28rem] rounded-3xl sm:h-[34rem]"}`} />;
  }
  const incidents = mode === "demo" ? demoMapIncidents : liveIncidents.data?.items ?? [];
  return <div className={`relative overflow-hidden ${fill ? "h-full" : small ? "h-[18rem] rounded-2xl" : "h-[28rem] rounded-3xl sm:h-[34rem]"}`}><MapCanvas viewport={{ latitude: env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE, longitude: env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE, zoom: env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM }} attribution={env.NEXT_PUBLIC_MAP_ATTRIBUTION} styleUrl={env.NEXT_PUBLIC_MAP_STYLE_URL} incidents={incidents} roadPaths={mode === "demo" ? demoPreviewRoadPaths : {}} layers={landingLayers} /></div>;
}
