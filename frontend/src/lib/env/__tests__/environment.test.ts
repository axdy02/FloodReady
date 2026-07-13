import { describe, expect, it } from "vitest";
import { parseClientEnvironment } from "@/lib/env/client";
import { parseServerEnvironment } from "@/lib/env/server";

const source = {
  FRONTEND_ENV: "test",
  NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001/api/v1",
  INTERNAL_API_BASE_URL: "http://backend:3000/api/v1",
  NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_MAP_STYLE_URL: "https://map.test.invalid/style.json",
  NEXT_PUBLIC_MAP_ATTRIBUTION: "Test fixture only",
  NEXT_PUBLIC_MAP_CONNECT_ORIGINS: "https://map.test.invalid",
  NEXT_PUBLIC_MAP_IMAGE_ORIGINS: "https://map.test.invalid",
  NEXT_PUBLIC_DEFAULT_MAP_LATITUDE: "0",
  NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE: "0",
  NEXT_PUBLIC_DEFAULT_MAP_ZOOM: "2",
  NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB: "10"
};

describe("environment validation", () => {
  it("accepts test, local, and production contracts", () => {
    expect(parseServerEnvironment(source).FRONTEND_ENV).toBe("test");
    expect(parseClientEnvironment({ ...source, FRONTEND_ENV: "local" }).FRONTEND_ENV).toBe("local");
    expect(parseClientEnvironment({ ...source, FRONTEND_ENV: "production", NEXT_PUBLIC_API_BASE_URL: "https://api.example.invalid/api/v1", NEXT_PUBLIC_APP_ORIGIN: "https://app.example.invalid" }).FRONTEND_ENV).toBe("production");
  });

  it("rejects missing, malformed, and cross-origin values", () => {
    expect(() => parseClientEnvironment({ ...source, NEXT_PUBLIC_API_BASE_URL: undefined })).toThrow();
    expect(() => parseClientEnvironment({ ...source, NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001/other" })).toThrow();
    expect(() => parseClientEnvironment({ ...source, NEXT_PUBLIC_MAP_STYLE_URL: "https://other.test.invalid/style.json" })).toThrow();
    expect(() => parseClientEnvironment({ ...source, FRONTEND_ENV: "production" })).toThrow();
    expect(() => parseClientEnvironment({ ...source, FRONTEND_ENV: "local", NEXT_PUBLIC_APP_ORIGIN: "http://example.invalid" })).toThrow();
  });
});
