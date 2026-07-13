import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../src/database/prisma.js";
import { clearDatabase, createTestUser } from "../helpers/database.js";
import { api } from "../helpers/http.js";
import { authData, expectError, refreshCookie, setCookieHeaders, successValue } from "./contracts.js";

const login = async (email: string, password: string) => api()
  .post("/api/v1/auth/login")
  .set("Content-Type", "application/json")
  .send({ email, password });

const refresh = async (cookie: string) => api().post("/api/v1/auth/refresh").set("Cookie", cookie);

beforeEach(async () => {
  await clearDatabase();
});

describe("refresh rotation and logout", () => {
  it("rotates a valid refresh cookie without extending its family expiry", async () => {
    const user = await createTestUser();
    const loginResponse = await login(user.email, user.password);
    const originalCookie = refreshCookie(loginResponse);
    const original = await prisma.refreshSession.findFirstOrThrow({ where: { userId: user.id } });
    const response = await refresh(originalCookie);

    expect(response.status).toBe(200);
    authData(response);
    const rotatedCookie = refreshCookie(response);
    expect(rotatedCookie).not.toBe(originalCookie);
    const parent = await prisma.refreshSession.findUnique({ where: { id: original.id } });
    expect(parent?.revokedAt).not.toBeNull();
    expect(parent?.replacedById).not.toBeNull();
    const successor = await prisma.refreshSession.findUnique({ where: { id: parent?.replacedById ?? "00000000-0000-0000-0000-000000000000" } });
    expect(successor).not.toBeNull();
    expect(successor?.familyId).toBe(original.familyId);
    expect(successor?.expiresAt.getTime()).toBe(original.expiresAt.getTime());
    expect(setCookieHeaders(response).join(";")).toContain("SameSite=Strict");
  });

  it("allows exactly one concurrent refresh and treats the other as family reuse", async () => {
    const user = await createTestUser();
    const loginResponse = await login(user.email, user.password);
    const originalCookie = refreshCookie(loginResponse);
    const [first, second] = await Promise.all([refresh(originalCookie), refresh(originalCookie)]);
    const responses = [first, second];
    const successes = responses.filter((response) => response.status === 200);
    const failures = responses.filter((response) => response.status === 401);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expectError(failures[0] ?? first, 401, "INVALID_REFRESH_TOKEN");
    const sessions = await prisma.refreshSession.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(2);
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
    const audit = await prisma.auditLog.findFirst({ where: { action: "REFRESH_TOKEN_REUSE_DETECTED" } });
    expect(audit).not.toBeNull();
    expect(audit?.entityType).toBe("REFRESH_SESSION");
  });

  it("revokes the successor family when a replaced cookie is replayed", async () => {
    const user = await createTestUser();
    const loginResponse = await login(user.email, user.password);
    const originalCookie = refreshCookie(loginResponse);
    const successfulRotation = await refresh(originalCookie);
    expect(successfulRotation.status).toBe(200);

    const replay = await refresh(originalCookie);
    const error = expectError(replay, 401, "INVALID_REFRESH_TOKEN");
    expect(error["details"]).toEqual([]);
    expect(setCookieHeaders(replay).join(";")).toContain("Max-Age=0");
    const active = await prisma.refreshSession.count({ where: { userId: user.id, revokedAt: null } });
    expect(active).toBe(0);
    const audit = await prisma.auditLog.findFirst({ where: { action: "REFRESH_TOKEN_REUSE_DETECTED" } });
    expect(audit?.metadata).toMatchObject({ revokedSessionCount: 1 });
  });

  it("rejects invalid refresh bodies and hostile origins without leaking cookie state", async () => {
    const user = await createTestUser();
    const loginResponse = await login(user.email, user.password);
    const cookie = refreshCookie(loginResponse);
    const body = await api()
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({ unexpected: true });
    const hostileOrigin = await api().post("/api/v1/auth/refresh").set("Cookie", cookie).set("Origin", "https://attacker.invalid");

    expectError(body, 400, "VALIDATION_ERROR");
    expectError(hostileOrigin, 403, "ORIGIN_NOT_ALLOWED");
    expect(await prisma.refreshSession.count({ where: { userId: user.id, revokedAt: null } })).toBe(1);
  });

  it("clears invalid cookies and performs idempotent logout with one audit event", async () => {
    const invalid = await api().post("/api/v1/auth/refresh").set("Cookie", "floodready_refresh=not-a-token");
    expectError(invalid, 401, "INVALID_REFRESH_TOKEN");
    expect(setCookieHeaders(invalid).join(";")).toContain("Max-Age=0");

    const user = await createTestUser();
    const loginResponse = await login(user.email, user.password);
    const cookie = refreshCookie(loginResponse);
    const first = await api().post("/api/v1/auth/logout").set("Cookie", cookie);
    const second = await api().post("/api/v1/auth/logout").set("Cookie", cookie);

    expect(first.status).toBe(200);
    expect(successValue(first)).toBeNull();
    expect(setCookieHeaders(first).join(";")).toContain("Max-Age=0");
    expect(second.status).toBe(200);
    expect(successValue(second)).toBeNull();
    expect(await prisma.refreshSession.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    const audits = await prisma.auditLog.findMany({ where: { action: "AUTH_LOGOUT" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.metadata).toHaveProperty("familyId");
  });
});
