import { ZodError } from "zod";
import { AppError } from "../errors/index.js";

export const validateRequest = <T>(scope: "body" | "params" | "query", operation: () => T): T => {
  try {
    return operation();
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        path: issue.path.length === 0 ? scope : `${scope}.${issue.path.map((part) => String(part)).join(".")}`,
        message: "Invalid value"
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Invalid request", details);
    }
    throw error;
  }
};
