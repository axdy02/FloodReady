import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { authStore } from "@/features/auth/auth-store";
import { sanitizeReturnPath } from "@/lib/security/return-path";
import { authApi } from "@/features/auth/api";
import { AuthProvider, logout, restoreSession } from "@/features/auth/auth-context";
import { AuthGate } from "@/features/auth/auth-gate";
import { LoginForm } from "@/features/auth/login-form";
import { RegisterForm } from "@/features/auth/register-form";
import { validAuth, validUser } from "@/tests/fixtures/contracts";

const navigation = vi.hoisted(() => ({ pathname: "/map", replace: vi.fn(), search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

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

  afterEach(() => {
    cleanup();
    authStore.clearSession();
    navigation.pathname = "/map";
    navigation.replace.mockReset();
    navigation.search = "";
    vi.restoreAllMocks();
  });

  it("keeps session data in memory and sanitizes return paths", () => {
    expect(sanitizeReturnPath(null)).toBe("/map");
    expect(sanitizeReturnPath("//evil.invalid")).toBe("/map");
    expect(sanitizeReturnPath("/map?report=20000000-0000-4000-8000-000000000001&lat=28.33505&lng=77.05345")).toBe("/map?report=20000000-0000-4000-8000-000000000001&lat=28.33505&lng=77.05345");
    authStore.clearSession();
    expect(authStore.getAccessToken()).toBeUndefined();
  });

  it("preserves the map query through the protected sign-in and registration links", () => {
    navigation.search = "report=20000000-0000-4000-8000-000000000001&lat=28.33505&lng=77.05345";
    const target = `/map?${navigation.search}`;
    authStore.clearSession();
    render(<AuthProvider><AuthGate><span>Protected content</span></AuthGate></AuthProvider>);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", `/login?returnTo=${encodeURIComponent(target)}`);
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", `/register?returnTo=${encodeURIComponent(target)}`);
  });

  it("preserves returnTo after registration and defaults a direct login to the map", async () => {
    const target = "/map?report=20000000-0000-4000-8000-000000000001&lat=28.33505&lng=77.05345";
    navigation.search = `returnTo=${encodeURIComponent(target)}`;
    vi.spyOn(authApi, "register").mockResolvedValue(validUser);
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Test User" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: validUser.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(`/login?registered=1&returnTo=${encodeURIComponent(target)}`));

    cleanup();
    navigation.replace.mockReset();
    navigation.search = "";
    vi.spyOn(authApi, "login").mockResolvedValue(validAuth);
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: validUser.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/map"));
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

  it("refreshes an authenticated session before its access token expires", async () => {
    vi.useFakeTimers();
    const refresh = vi.spyOn(authApi, "refresh").mockResolvedValue(validAuth);
    authStore.setSession(validAuth.accessToken, validUser, 61);
    render(<AuthProvider><span>session</span></AuthProvider>);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
