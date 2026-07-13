import { constants } from "node:fs";
import { access, chmod, mkdir } from "node:fs/promises";
import { config } from "../../config/index.js";
import { AppError } from "../../shared/errors/index.js";
import { probeDatabase } from "./health.repository.js";
import type { HealthData } from "./health.types.js";

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

export const initializeRuntimeDependencies = async (): Promise<void> => {
  await initializeUploadDirectory();
  await probeDatabase();
};
