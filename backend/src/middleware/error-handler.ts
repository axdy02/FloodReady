import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../shared/errors/index.js";
import { logger } from "../shared/logging/index.js";

const hasStatus = (error: unknown, status: number): boolean =>
  typeof error === "object" && error !== null && "status" in error && error.status === status;

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, next) => {
  void next;
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({ path: issue.path.join("."), message: "Invalid value" }));
    response.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request", details }, requestId: request.requestId });
    return;
  }
  if (error instanceof AppError) {
    response.status(error.status).json({ success: false, error: { code: error.code, message: error.message, details: error.details }, requestId: request.requestId });
    return;
  }
  if (hasStatus(error, 400)) {
    response.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request", details: [] }, requestId: request.requestId });
    return;
  }
  logger.error({ requestId: request.requestId, errorType: error instanceof Error ? error.name : "UnknownError" }, "request failed");
  response.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error", details: [] }, requestId: request.requestId });
};
