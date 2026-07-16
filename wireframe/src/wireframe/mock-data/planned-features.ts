// WIREFRAME MOCK DATA — NOT PRODUCTION DATA.
// This file is intentionally isolated from the production frontend and API clients.

export type DemoScenario = "NORMAL" | "HEAVY_RAIN" | "CLUSTER_EXPANDING" | "ROAD_BLOCKED" | "STALE" | "RESOLVED" | "OPEN_MANHOLE" | "AI_UNAVAILABLE" | "WEATHER_UNAVAILABLE" | "NO_REPORTS" | "SEARCH_FAILURE";

export type MockSeverity = "MINOR" | "MODERATE" | "SEVERE" | "IMPASSABLE";

export type MockCluster = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  reportCount: number;
  photoCount: number;
  radiusMetres: number;
  currentSeverity: MockSeverity;
  highestSeverity: MockSeverity;
  dominantCategory: string;
  trend: "STABLE" | "LIKELY_TO_INCREASE" | "HIGH_ESCALATION_RISK" | "LIKELY_TO_DECREASE";
  lifecycle: "ACTIVE" | "MONITORING" | "STALE" | "RESOLVED";
  roadPassability: "PASSABLE" | "CAUTION" | "UNSAFE" | "IMPASSABLE";
  firstReported: string;
  lastUpdated: string;
  weatherRelevance: string;
};

export const wireframeNotice = "This is a wireframe. Reports, alerts, weather, AI summaries and predictions shown here are simulated.";

export const scenarios: ReadonlyArray<{ id: DemoScenario; label: string }> = [
  { id: "NORMAL", label: "Normal" }, { id: "HEAVY_RAIN", label: "Heavy rainfall" },
  { id: "CLUSTER_EXPANDING", label: "Cluster expanding" }, { id: "ROAD_BLOCKED", label: "Road blocked" },
  { id: "STALE", label: "Incident becoming stale" }, { id: "RESOLVED", label: "Incident resolved" },
  { id: "OPEN_MANHOLE", label: "Open manhole" }, { id: "AI_UNAVAILABLE", label: "AI summary unavailable" },
  { id: "WEATHER_UNAVAILABLE", label: "Weather unavailable" }, { id: "NO_REPORTS", label: "No reports" },
  { id: "SEARCH_FAILURE", label: "Search failure" },
];

export const mockClusters: readonly MockCluster[] = [
  { id: "sector-18-underpass", name: "Sector 18 Underpass Incident", latitude: 28.374, longitude: 77.045, reportCount: 18, photoCount: 11, radiusMetres: 420, currentSeverity: "SEVERE", highestSeverity: "IMPASSABLE", dominantCategory: "Underpass flooding", trend: "LIKELY_TO_INCREASE", lifecycle: "ACTIVE", roadPassability: "UNSAFE", firstReported: "7:40 AM", lastUpdated: "4 minutes ago", weatherRelevance: "Heavy rainfall and increasing nearby reports support this simulated risk." },
  { id: "market-drain", name: "Market Road Drain Cluster", latitude: 28.381, longitude: 77.052, reportCount: 8, photoCount: 4, radiusMetres: 260, currentSeverity: "MODERATE", highestSeverity: "MODERATE", dominantCategory: "Road waterlogging", trend: "STABLE", lifecycle: "ACTIVE", roadPassability: "CAUTION", firstReported: "8:05 AM", lastUpdated: "12 minutes ago", weatherRelevance: "Rain-related categories use simulated rainfall context in this wireframe." },
  { id: "sector-47-event", name: "Sector 47 Flood Event", latitude: 28.349, longitude: 77.062, reportCount: 37, photoCount: 22, radiusMetres: 920, currentSeverity: "IMPASSABLE", highestSeverity: "IMPASSABLE", dominantCategory: "Flooded road", trend: "HIGH_ESCALATION_RISK", lifecycle: "ACTIVE", roadPassability: "IMPASSABLE", firstReported: "6:55 AM", lastUpdated: "2 minutes ago", weatherRelevance: "Simulated heavy rain, blocked-road reports, and an expanding affected area increase risk." },
  { id: "open-manhole", name: "Open Manhole - Separate Incident", latitude: 28.378, longitude: 77.058, reportCount: 1, photoCount: 1, radiusMetres: 0, currentSeverity: "SEVERE", highestSeverity: "SEVERE", dominantCategory: "Open manhole", trend: "STABLE", lifecycle: "MONITORING", roadPassability: "UNSAFE", firstReported: "8:22 AM", lastUpdated: "18 minutes ago", weatherRelevance: "Weather context is not required for this infrastructure-related category." },
];

export const mockPhotos = [
  { id: "p1", clusterId: "sector-18-underpass", label: "Vehicles stopped before the underpass", timestamp: "8:31 AM", location: "Sector 18 underpass approach", description: "Standing water covers both lanes in this simulated report.", userSeverity: "Severe", aiSuggestion: "Severe", verification: "Provisional", tone: "from-sky-900 via-slate-800 to-cyan-500" },
  { id: "p2", clusterId: "sector-18-underpass", label: "Water level rising near the barrier", timestamp: "8:38 AM", location: "Sector 18 underpass entrance", description: "Simulated evidence shows water approaching the road barrier.", userSeverity: "Impassable", aiSuggestion: "Impassable", verification: "Verified", tone: "from-indigo-950 via-blue-800 to-slate-600" },
  { id: "p3", clusterId: "sector-18-underpass", label: "Pedestrian route blocked", timestamp: "8:44 AM", location: "Sector 18 service lane", description: "Simulated evidence from a pedestrian diversion.", userSeverity: "Moderate", aiSuggestion: "Severe", verification: "Submitted", tone: "from-cyan-900 via-blue-950 to-slate-700" },
  { id: "p4", clusterId: "market-drain", label: "Drain overflow beside market road", timestamp: "8:19 AM", location: "Market Road", description: "Simulated drain overflow and roadside waterlogging.", userSeverity: "Moderate", aiSuggestion: "Moderate", verification: "Provisional", tone: "from-amber-950 via-orange-800 to-slate-700" },
];

export const mockArea = {
  name: "Sector 18, Gurugram", latitude: 28.374, longitude: 77.045,
  statistics: [
    ["Active reports", "63"], ["Active clusters", "3"], ["Photos available", "37"], ["Average observed severity", "Moderate"],
    ["Highest observed severity", "Impassable"], ["Reports in last hour", "21"], ["Roads reported blocked", "2"], ["Dominant category", "Road waterlogging"],
  ],
  timeline: ["7:40 AM - First minor waterlogging report", "8:05 AM - Three reports grouped into one cluster", "8:25 AM - Severity increased to moderate", "8:42 AM - Road reported blocked", "9:10 AM - Escalation warning generated", "11:45 AM - Two road-clear confirmations received"],
};

export const mockAlerts = [
  { id: "nearby-blocked", type: "ACTIVE_NEARBY", title: "Road blocked nearby", detail: "High-severity flooding has been reported approximately 420 metres away.", severity: "Severe", distance: "420 m", area: "Sector 18 underpass", created: "4 minutes ago", status: "Active", clusterId: "sector-18-underpass" },
  { id: "predictive-rain", type: "PREDICTIVE_RISK", title: "Possible flood risk near your saved area", detail: "Heavy rainfall is expected, and this road has flooded during similar simulated conditions.", severity: "Moderate", distance: "1.1 km", area: "College route", created: "20 minutes ago", status: "Advisory", clusterId: "market-drain" },
  { id: "resolved-road", type: "RESOLVED", title: "Road clear confirmations received", detail: "The event is retained in history while conditions are monitored.", severity: "Minor", distance: "2.3 km", area: "Sector 47", created: "1 hour ago", status: "Resolved", clusterId: "sector-47-event" },
];

export const mockSavedAreas = [
  { id: "home", name: "Home", subtitle: "Sector 18, Gurugram", radius: "800 m", alerts: "Rain risk and nearby incident alerts", checked: "4 minutes ago" },
  { id: "college", name: "College", subtitle: "Sohna Road", radius: "1.2 km", alerts: "Road closure and rain-risk alerts", checked: "12 minutes ago" },
  { id: "office", name: "Office", subtitle: "Cyber City", radius: "1 km", alerts: "Nearby incident alerts", checked: "28 minutes ago" },
];
