export type HealthData = { status: "ok" | "ready"; service: "floodready-backend"; timestamp: string };
export type ServiceCheckStatus = "ready" | "degraded" | "unavailable";
export type ServicesHealthData = {
  backend: ServiceCheckStatus;
  aiService: ServiceCheckStatus;
  checkedAt: string;
};
