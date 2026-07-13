import { randomUUID } from "node:crypto";

import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it } from "vitest";

import { config } from "../../src/config/index.js";
import { prisma } from "../../src/database/prisma.js";
import { createAccessToken, createRefreshToken } from "../../src/shared/security/index.js";
import { clearDatabase, createTestUser } from "../helpers/database.js";
import { api } from "../helpers/http.js";
import { bearer, expectError, successData } from "./contracts.js";

beforeEach(async () => {
  await clearDatabase();
});

describe("HTTP security", () => {
  it("applies hardened headers and exact credentialed CORS preflight", async () => {
    const response = await api()
      .options("/api/v1/auth/login")
      .set("Origin", config.PUBLIC_API_ORIGIN)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type,x-request-id");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(response.headers["access-control-allow-origin"]).toBe(config.PUBLIC_API_ORIGIN);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("rejects hostile origins and content types with canonical errors", async () => {
    const hostileOrigin = await api().get("/api/v1/health").set("Origin", "https://attacker.invalid");
    const wrongContentType = await api()
      .post("/api/v1/auth/login")
      .set("Content-Type", "text/plain")
      .send("email=user@example.test");

    expectError(hostileOrigin, 403, "ORIGIN_NOT_ALLOWED");
    expectError(wrongContentType, 415, "UNSUPPORTED_MEDIA_TYPE");
  });

  it("enforces bearer authentication, rejects malformed tokens, and reloads live user state", async () => {
    const user = await createTestUser();
    const noBearer = await api().get("/api/v1/auth/me");
    const malformed = await api().get("/api/v1/auth/me").set(bearer("not-a-jwt"));
    const refresh = createRefreshToken(user.id, randomUUID(), randomUUID(), new Date(Date.now() + 60_000));
    const interchange = await api().get("/api/v1/auth/me").set(bearer(refresh));

    expectError(noBearer, 401, "AUTHENTICATION_REQUIRED");
    expectError(malformed, 401, "AUTHENTICATION_REQUIRED");
    expectError(interchange, 401, "AUTHENTICATION_REQUIRED");

    const originalToken = createAccessToken(user.id, "USER").token;
    await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    const reloadedRole = await api().get("/api/v1/users").set(bearer(originalToken));
    const collection = successData(reloadedRole);
    expect(Array.isArray(collection["items"])).toBe(true);

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    const inactive = await api().get("/api/v1/auth/me").set(bearer(originalToken));
    expectError(inactive, 401, "AUTHENTICATION_REQUIRED");
  });

  it("rejects a correctly signed token with a disallowed algorithm", async () => {
    const user = await createTestUser();
    const wrongAlgorithm = jwt.sign(
      { tokenType: "access", role: "USER" },
      Buffer.from(config.ACCESS_TOKEN_SECRET, "base64url"),
      {
        algorithm: "HS256",
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
        subject: user.id,
        jwtid: randomUUID(),
        expiresIn: 900
      }
    );

    const response = await api().get("/api/v1/auth/me").set(bearer(wrongAlgorithm));
    expectError(response, 401, "AUTHENTICATION_REQUIRED");
  });

  it("enforces role boundaries and emits standard rate-limit headers", async () => {
    const ordinary = await createTestUser("USER");
    const moderator = await createTestUser("MODERATOR");
    const admin = await createTestUser("ADMIN");
    const denied = await api().get("/api/v1/users").set(bearer(createAccessToken(ordinary.id, ordinary.role).token));
    const moderatorDenied = await api().get("/api/v1/users").set(bearer(createAccessToken(moderator.id, moderator.role).token));
    const allowed = await api().get("/api/v1/users").set(bearer(createAccessToken(admin.id, admin.role).token));

    expectError(denied, 403, "FORBIDDEN");
    expectError(moderatorDenied, 403, "FORBIDDEN");
    expect(allowed.status).toBe(200);
    expect(allowed.headers["ratelimit-limit"]).toBeDefined();
    expect(Array.isArray(successData(allowed)["items"])).toBe(true);
  });
});
