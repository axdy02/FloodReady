import { describe, expect, it } from "vitest";
import { reportFormSchema, validateImage } from "@/features/reports/report-form-schema";
import { messageForAnalysisError, messageForReportSubmissionError, reportCategoryOptions, usesWeatherContext, validationStepsForCategory, weatherGuidanceForCategory } from "@/features/reports/report-form";
import { ApiError } from "@/lib/api/errors";

describe("report form", () => {
  it("validates exact evidence and required report details", () => {
    expect(validateImage(new File(["x"], "x.jpg", { type: "image/jpeg" }), 10)).toBe(true);
    expect(validateImage(new File(["x"], "x.txt", { type: "text/plain" }), 10)).toBe(false);
    expect(reportFormSchema.parse({ category: "FLOODED_ROAD", severity: "MODERATE", description: "  Water covers one lane.  " }).description).toBe("Water covers one lane.");
    expect(() => reportFormSchema.parse({ category: "FLOODED_ROAD", severity: "MODERATE", description: "short" })).toThrow();
    expect(() => reportFormSchema.parse({ category: "FLOODED_ROOD", severity: "MODERATE", description: "Water covers one lane." })).toThrow();
    expect(() => reportFormSchema.parse({ category: "FLOODED_ROAD", severity: "MODERATE", description: "x".repeat(1001) })).toThrow();
  });

  it("distinguishes an unknown network outcome from a confirmed API rejection", () => {
    expect(messageForReportSubmissionError(new ApiError("NETWORK_ERROR", "Network request failed", null))).toBe("The connection ended before the server response arrived. Submission status is unknown; check the Reports Map before retrying.");
    expect(messageForReportSubmissionError(new ApiError("VALIDATION_ERROR", "Invalid request", 400))).toBe("The backend rejected the final severity. Review the AI result and choose a valid final severity.");
    expect(messageForReportSubmissionError(new ApiError("RATE_LIMITED", "Too many requests", 429))).toContain("server returned rate limited");
  });

  it("explains every retryable analysis and final-submission failure class", () => {
    expect(messageForReportSubmissionError(new ApiError("NOT_FOUND", "Missing", 404))).toContain("draft expired");
    expect(messageForReportSubmissionError(new ApiError("TIMEOUT", "Timed out", null))).toContain("Submission timed out");
    expect(messageForReportSubmissionError(new ApiError("UNAUTHORIZED", "Unauthenticated", 401))).toContain("session expired");
    expect(messageForReportSubmissionError(new ApiError("INTERNAL_ERROR", "Server", 500))).toContain("No success was confirmed");
    expect(messageForReportSubmissionError(new Error("unexpected"))).toContain("could not be submitted");
    expect(messageForAnalysisError(new ApiError("UNAUTHORIZED", "Unauthenticated", 401))).toContain("session expired");
    expect(messageForAnalysisError(new ApiError("RATE_LIMITED", "Too many", 429))).toContain("Too many analysis attempts");
    expect(messageForAnalysisError(new ApiError("TIMEOUT", "Timed out", null))).toContain("timed out");
    expect(messageForAnalysisError(new ApiError("NETWORK_ERROR", "Offline", null))).toContain("could not reach");
    expect(messageForAnalysisError(new ApiError("VALIDATION_ERROR", "Large", 413))).toContain("too large");
    expect(messageForAnalysisError(new ApiError("VALIDATION_ERROR", "Invalid", 415))).toContain("valid JPEG");
    expect(messageForAnalysisError(new Error("unexpected"))).toContain("could not start");
  });

  it("lists every API category and only schedules weather steps for rain-related reports", () => {
    expect(reportCategoryOptions.map(([category]) => category)).toEqual(["ROAD_WATERLOGGING", "FLOODED_ROAD", "CLOGGED_DRAIN", "OVERFLOWING_DRAIN", "OPEN_MANHOLE", "FALLEN_TREE", "STRANDED_VEHICLE", "UNDERPASS_FLOODING", "OTHER"]);
    expect(usesWeatherContext("UNDERPASS_FLOODING")).toBe(true);
    expect(weatherGuidanceForCategory("ROAD_WATERLOGGING")).toContain("simulates background weather processing");
    expect(validationStepsForCategory("CLOGGED_DRAIN")).toEqual(["Checking the submitted photo", "Checking report details", "Combining image and report evidence", "Validation complete"]);
    expect(weatherGuidanceForCategory("STRANDED_VEHICLE")).toBe("Weather context is not required for this incident category.");
  });
});
