import { describe, expect, it } from "vitest";
import { parseClientEnvironment } from "@/lib/env/client";
import { createContentSecurityPolicy } from "@/lib/security/csp";

const environment = parseClientEnvironment({
  FRONTEND_ENV: "test",
  NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001/api/v1",
  NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_MAP_STYLE_URL: "https://map.test.invalid/style.json",
  NEXT_PUBLIC_MAP_ATTRIBUTION: "Test fixture only",
  NEXT_PUBLIC_MAP_CONNECT_ORIGINS: "https://tiles.test.invalid,https://map.test.invalid",
  NEXT_PUBLIC_MAP_IMAGE_ORIGINS: "https://images.test.invalid,https://map.test.invalid",
  NEXT_PUBLIC_DEFAULT_MAP_LATITUDE: "0",
  NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE: "0",
  NEXT_PUBLIC_DEFAULT_MAP_ZOOM: "2",
  NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB: "10"
});

describe("content security policy", () => {
  it("uses the exact ordered directives and sorted origins", () => {
    const policy = createContentSecurityPolicy(environment, "nonce-value", false);
    expect(policy).toContain("script-src 'self' 'nonce-nonce-value' 'strict-dynamic'");
    expect(policy).not.toContain("script-src 'unsafe-inline'");
    expect(policy.indexOf("https://map.test.invalid")).toBeLessThan(policy.indexOf("https://tiles.test.invalid"));
  });

  it("adds development eval only when asked", () => {
    expect(createContentSecurityPolicy(environment, "first", true)).toContain("'unsafe-eval'");
    expect(createContentSecurityPolicy(environment, "second", false)).not.toContain("'unsafe-eval'");
  });
});
