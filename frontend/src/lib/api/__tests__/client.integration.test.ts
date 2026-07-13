import { beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query/keys";
import { request } from "@/lib/api/request";
import { validUser } from "@/tests/fixtures/contracts";

const report = { id: "20000000-0000-4000-8000-000000000001", reporterId: validUser.id, category: "FLOODED_ROAD", description: null, severityClaim: "MODERATE", latitude: 0, longitude: 0, gpsAccuracy: null, locationSource: "MANUAL", capturedAt: "2026-01-01T00:00:00.000Z", submittedAt: "2026-01-01T00:00:00.000Z", uploadSource: "WEB", verificationStatus: "SUBMITTED", incidentId: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } as const;
const incident = { id: "30000000-0000-4000-8000-000000000001", category: "FLOODED_ROAD", severity: "MODERATE", confidenceScore: null, status: "ACTIVE", latitude: 0, longitude: 0, reportCount: 1, firstReportedAt: "2026-01-01T00:00:00.000Z", lastReportedAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } as const;
const page = { items: [report], pagination: { limit: 20, hasMore: false, nextCursor: null }, totalCount: 1 } as const;
const mapPage = { items: [{ id: report.id, category: report.category, severityClaim: report.severityClaim, latitude: 0, longitude: 0, capturedAt: report.capturedAt, submittedAt: report.submittedAt, verificationStatus: report.verificationStatus, incidentId: null, updatedAt: report.updatedAt, canViewDetails: true }], pagination: { limit: 20, hasMore: false, nextCursor: null }, totalCount: 1 } as const;

describe("typed API boundary", () => {
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

  it("uses strict schemas, stable keys, and credentials", async () => {
    const response = await api.login(JSON.stringify({ email: "test@example.invalid", password: "password" }));
    expect(response.tokenType).toBe("Bearer");
    expect(queryKeys.map("actor", { west: "0", east: "1" })).toEqual(["reports", "map", "actor", [["east", "1"], ["west", "0"]]]);
  });

  it("rejects malformed success responses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true, data: { accessToken: "missing" }, requestId: "10000000-0000-4000-8000-000000000001" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = api.login(JSON.stringify({}));
    await expect(result).rejects.toBeInstanceOf(ApiError);
    fetchMock.mockRestore();
  });

  it("routes every read operation through the shared boundary", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const respond = (data: unknown) => new Response(JSON.stringify({ success: true, data, requestId: "10000000-0000-4000-8000-000000000001" }), { status: 200, headers: { "Content-Type": "application/json" } });
    fetchMock.mockResolvedValueOnce(respond(validUser));
    fetchMock.mockResolvedValueOnce(respond({ items: [validUser], pagination: { limit: 20, hasMore: false, nextCursor: null } }));
    fetchMock.mockResolvedValueOnce(respond(page));
    fetchMock.mockResolvedValueOnce(respond(page));
    fetchMock.mockResolvedValueOnce(respond(mapPage));
    fetchMock.mockResolvedValueOnce(respond(report));
    fetchMock.mockResolvedValueOnce(respond({ items: [incident], pagination: { limit: 20, hasMore: false, nextCursor: null }, totalCount: 1 }));
    await api.me("token");
    await api.listUsers("?limit=20", "token");
    await api.listReports("?limit=20", "token");
    await api.ownReports("?limit=20", "token");
    await api.mapReports("?west=0&south=0&east=1&north=1", "token");
    await api.report(report.id, "token");
    await api.incidents("?limit=20");
    expect(fetchMock).toHaveBeenCalledTimes(7);
    fetchMock.mockRestore();
  });

  it("exposes normalized query scopes", () => {
    expect(queryKeys.users({ role: "USER", active: null })).toEqual(["users", [["active", null], ["role", "USER"]]]);
    expect(queryKeys.reports("own", { status: "SUBMITTED" })).toEqual(["reports", "own", [["status", "SUBMITTED"]]]);
    expect(queryKeys.incidents({ status: "ACTIVE" })).toEqual(["incidents", [["status", "ACTIVE"]]]);
  });

  it("retries eligible server failures and parses typed errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const errorBody = { success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Unavailable", details: [] }, requestId: "10000000-0000-4000-8000-000000000001" };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(errorBody), { status: 503, headers: { "Content-Type": "application/json" } })).mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: validUser, requestId: "10000000-0000-4000-8000-000000000001" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const promise = api.me("token");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await expect(promise).resolves.toEqual(validUser);
    fetchMock.mockRestore();
  });

  it("supports protected image responses without exposing a URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([1, 2]), { status: 200, headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store" } }));
    const result = await request({ method: "GET", path: `/reports/${report.id}/image`, accessToken: "token", responseMode: "protectedReportImage", schema: z.object({ blob: z.instanceof(Blob), mime: z.string() }) });
    expect(result.mime).toBe("image/jpeg");
    expect(result.blob.size).toBe(2);
    fetchMock.mockRestore();
  });
});
