export type ApiErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL_ERROR" | "SERVICE_UNAVAILABLE" | "NETWORK_ERROR" | "TIMEOUT" | "CANCELLED";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  readonly details: unknown;

  constructor(code: ApiErrorCode, message: string, status: number | null, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class RequestCancelledError extends ApiError {
  constructor() {
    super("CANCELLED", "Request cancelled", null);
    this.name = "RequestCancelledError";
  }
}
