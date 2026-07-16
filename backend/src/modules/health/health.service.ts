import { constants } from "node:fs";
import { access, chmod, mkdir } from "node:fs/promises";
import { config } from "../../config/index.js";
import { AppError } from "../../shared/errors/index.js";
import { probeDatabase } from "./health.repository.js";
import type { HealthData, ServiceCheckStatus, ServicesHealthData } from "./health.types.js";

const data = (status: "ok" | "ready"): HealthData => ({ status, service: "floodready-backend", timestamp: new Date().toISOString() });

export const liveness = (): HealthData => data("ok");

export const initializeUploadDirectory = async (): Promise<void> => {
  await mkdir(config.UPLOAD_DIRECTORY, { recursive: true, mode: 0o700 });
  await chmod(config.UPLOAD_DIRECTORY, 0o700);
  await access(config.UPLOAD_DIRECTORY, constants.R_OK | constants.W_OK);
};

export const readiness = async (): Promise<HealthData> => {
  const startedAt = Date.now();
  try {
    await Promise.all([probeDatabase(), access(config.UPLOAD_DIRECTORY, constants.R_OK | constants.W_OK)]);
    if (Date.now() - startedAt > 2_000) {
      throw new Error("Readiness deadline exceeded");
    }
    return data("ready");
  } catch {
    throw new AppError(503, "SERVICE_UNAVAILABLE", "Service unavailable");
  }
};

const checkAiService = async (): Promise<ServiceCheckStatus> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetch(`${config.AI_SERVICE_BASE_URL}/health/ready`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return "unavailable";
    const body = await response.json() as { success?: boolean; data?: { status?: string; provider?: string } };
    if (body.success !== true || body.data?.status !== "ready") return "degraded";
    return body.data.provider === "degraded" ? "degraded" : "ready";
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timer);
  }
};

export const servicesReadiness = async (): Promise<ServicesHealthData> => ({
  backend: "ready",
  aiService: await checkAiService(),
  checkedAt: new Date().toISOString(),
});

export const initializeRuntimeDependencies = async (): Promise<void> => {
  await initializeUploadDirectory();
  await probeDatabase();
};
