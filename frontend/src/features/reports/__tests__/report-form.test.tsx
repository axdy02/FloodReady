import { describe, expect, it } from "vitest";
import { reportCategoryOptions, usesWeatherContext, weatherGuidanceForCategory } from "@/features/reports/report-form";
import { reportFormSchema, validateImage } from "@/features/reports/report-form-schema";

const actualCategories = ["ROAD_WATERLOGGING", "FLOODED_ROAD", "CLOGGED_DRAIN", "OVERFLOWING_DRAIN", "OPEN_MANHOLE", "FALLEN_TREE", "STRANDED_VEHICLE", "UNDERPASS_FLOODING", "OTHER"];

describe("report form", () => {
  it("validates exact evidence and description limits", () => {
    expect(validateImage(new File(["x"], "x.jpg", { type: "image/jpeg" }), 10)).toBe(true);
    expect(validateImage(new File(["x"], "x.txt", { type: "text/plain" }), 10)).toBe(false);
    expect(reportFormSchema.parse({ category: "FLOODED_ROAD", description: "  note  " }).description).toBe("note");
    expect(() => reportFormSchema.parse({ category: "FLOODED_ROOD", description: "" })).toThrow();
    expect(() => reportFormSchema.parse({ category: "FLOODED_ROAD", description: "x".repeat(1001) })).toThrow();
  });

  it("lists every API category and shows category-aware weather guidance", () => {
    expect(reportCategoryOptions.map(([category]) => category)).toEqual(actualCategories);
    expect(usesWeatherContext("ROAD_WATERLOGGING")).toBe(true);
    expect(usesWeatherContext("OVERFLOWING_DRAIN")).toBe(true);
    expect(weatherGuidanceForCategory("FLOODED_ROAD")).toContain("Background AI validation");
    expect(usesWeatherContext("CLOGGED_DRAIN")).toBe(false);
    expect(weatherGuidanceForCategory("OPEN_MANHOLE")).toBe("Weather context is not required for this incident category.");
  });
});
