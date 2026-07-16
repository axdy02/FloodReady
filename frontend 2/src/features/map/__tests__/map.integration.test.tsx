import { describe, expect, it } from "vitest";
import { parseCoordinate, serializeCoordinate, validateDevicePosition } from "@/features/map/types";

describe("map foundation", () => {
  it("validates and serializes keyboard coordinates", () => {
    expect(parseCoordinate(" 28.247800 ", -85.051128, 85.051128)).toBe(28.2478);
    expect(parseCoordinate("1e2", -90, 90)).toBeNull();
    expect(serializeCoordinate(-0)).toBe("0");
    expect(serializeCoordinate(28.2478)).toBe("28.2478");
  });

  it("accepts valid device readings and rejects unsafe readings", () => {
    expect(validateDevicePosition(28.2478, 77.0647, 5)?.locationSource).toBe("DEVICE_GPS");
    expect(validateDevicePosition(90, 77, 5)).toBeNull();
    expect(validateDevicePosition(28, 77, 0)).toBeNull();
    expect(validateDevicePosition(Number.NaN, 77, 5)).toBeNull();
  });
});
