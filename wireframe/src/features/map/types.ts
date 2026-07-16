export type LocationSource = "DEVICE_GPS" | "MANUAL";
export type LocationValue = { locationSource: LocationSource; latitude: number; longitude: number; gpsAccuracy: number | null };
export type MapViewport = { latitude: number; longitude: number; zoom: number };

export const latitudePattern = /^-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/u;
export const longitudePattern = latitudePattern;

export function parseCoordinate(value: string, minimum: number, maximum: number): number | null {
  const trimmed = value.trim();
  if (!latitudePattern.test(trimmed)) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? Object.is(number, -0) ? 0 : number : null;
}

export function serializeCoordinate(value: number): string {
  const serialized = value.toFixed(6).replace(/0+$/u, "").replace(/\.$/u, "");
  return Object.is(Number(serialized), -0) || serialized === "-0" ? "0" : serialized;
}

export function validateDevicePosition(latitude: number, longitude: number, accuracy: number): LocationValue | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 100000 || latitude < -85.051128 || latitude > 85.051128 || longitude < -180 || longitude > 180) return null;
  return { locationSource: "DEVICE_GPS", latitude, longitude, gpsAccuracy: accuracy };
}
