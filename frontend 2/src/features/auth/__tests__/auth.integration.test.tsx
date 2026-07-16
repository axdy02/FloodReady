import { beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { authStore } from "@/features/auth/auth-store";
import { sanitizeReturnPath } from "@/lib/security/return-path";
import { authApi } from "@/features/auth/api";
import { AuthProvider, logout, restoreSession } from "@/features/auth/auth-context";
import { validAuth, validUser } from "@/tests/fixtures/contracts";

describe("authentication boundaries", () => {
  beforeAll(() => {
    vi.stubEnv("FRONTEND_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3001/api/v1");
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_MAP_STYLE_URL", "https://map.test.invalid/style.json");
    vi.stubEnv("NEXT_PUBLIC_MAP_ATTRIBUTION", "Test fixture only");
    vi.stubEnv("NEXT_PUBLIC_MAP_CONNECT_ORIGINS", "https://map.test.invalid");
    vi.stubEnv("NEXT_PUBLIC_MAP_IMAGE_ORIGINS", "https://map.test.invalid");
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_MAP_LATITUDE", "0");
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE", "0");
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_MAP_ZOOM", "2");
    vi.stubEnv("NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB", "10");
  });

  it("keeps session data in memory and sanitizes return paths", () => {
    expect(sanitizeReturnPath("//evil.invalid")).toBe("/dashboard");
    expect(sanitizeReturnPath("/reports?status=SUBMITTED#top")).toBe("/reports?status=SUBMITTED#top");
    authStore.clearSession();
    expect(authStore.getAccessToken()).toBeUndefined();
  });

  it("transitions memory state without durable browser storage", () => {
    authStore.setRestoring();
    authStore.setSession(validAuth.accessToken, validUser, validAuth.expiresInSeconds);
    authStore.setRefreshing();
    authStore.updateUser({ ...validUser, name: "Updated User" });
    expect(authStore.getState().kind).toBe("AUTHENTICATED");
    authStore.setUnavailable("Unavailable");
    expect(authStore.getAccessToken()).toBeUndefined();
    authStore.clearSession();
  });

  it("routes registration, login, refresh, and logout through the typed API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = (data: unknown) => new Response(JSON.stringify({ success: true, data, requestId: "10000000-0000-4000-8000-000000000001" }), { status: 200, headers: { "Content-Type": "application/json" } });
    fetchMock.mockResolvedValueOnce(response(validUser)).mockResolvedValueOnce(response(validAuth)).mockResolvedValueOnce(response(validAuth)).mockResolvedValueOnce(response(null));
    await expect(authApi.register(JSON.stringify({ name: "Test User", email: validUser.email, password: "password" }))).resolves.toEqual(validUser);
    await expect(authApi.login(JSON.stringify({ email: validUser.email, password: "password" }))).resolves.toEqual(validAuth);
    await expect(authApi.refresh()).resolves.toEqual(validAuth);
    await expect(authApi.logout()).resolves.toBeNull();
    fetchMock.mockRestore();
  });

  it("restores once through the provider and clears on logout", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true, data: validAuth, requestId: "10000000-0000-4000-8000-000000000001" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<AuthProvider><span>session</span></AuthProvider>);
    await restoreSession();
    await logout();
    fetchMock.mockRestore();
  });
});
