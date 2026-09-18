import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it } from "vitest";

import { config } from "../../src/config/index.js";
import { prisma } from "../../src/database/prisma.js";
import { hashRefreshToken, verifyAccessToken } from "../../src/shared/security/index.js";
import { clearDatabase, createTestUser } from "../helpers/database.js";
import { api } from "../helpers/http.js";
import { authData, bearer, expectError, expectUserDto, objectValue, refreshCookie, setCookieHeaders, successData } from "./contracts.js";

const login = async (email: string, password: string) => api()
  .post("/api/v1/auth/login")
  .set("Content-Type", "application/json")
  .send({ email, password });

beforeEach(async () => {
  await clearDatabase();
});

describe("registration and login", () => {
  it("registers normalized users with Argon2id and an atomic audit record", async () => {
    const response = await api()
      .post("/api/v1/auth/register")
      .set("Content-Type", "application/json")
      .send({ name: "  Jane\t Doe  ", email: "JANE@EXAMPLE.TEST ", password: "CorrectHorseBatteryStaple" });

    expect(response.status).toBe(201);
    const user = expectUserDto(successData(response));
    expect(user["name"]).toBe("Jane Doe");
    expect(user["email"]).toBe("jane@example.test");
    expect(user["role"]).toBe("USER");
    expect(user["isActive"]).toBe(true);
    expect(response.headers["set-cookie"]).toBeUndefined();

    const created = await prisma.user.findUnique({ where: { email: "jane@example.test" } });
    expect(created).not.toBeNull();
    if (created === null) {
      throw new Error("Expected registered user");
    }
    expect(created.passwordHash).toContain("argon2id");
    await expect(argon2.verify(created.passwordHash, "CorrectHorseBatteryStaple")).resolves.toBe(true);

    const audits = await prisma.auditLog.findMany({ where: { actorId: created.id } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "USER_REGISTERED",
      entityType: "USER",
      entityId: created.id,
      metadata: { role: "USER" }
    });
  });

  it("rejects strict unknown and mass-assignment fields without creating an account", async () => {
    const response = await api()
      .post("/api/v1/auth/register")
      .set("Content-Type", "application/json")
      .send({
        name: "Unsafe User",
        email: "unsafe@example.test",
        password: "CorrectHorseBatteryStaple",
        role: "ADMIN",
        isActive: false
    });

    const error = expectError(response, 400, "VALIDATION_ERROR");
    expect(error["details"]).toEqual(expect.arrayContaining([expect.objectContaining({ message: "Invalid value" })]));
    expect(JSON.stringify(error)).not.toContain("ADMIN");
    await expect(prisma.user.count({ where: { email: "unsafe@example.test" } })).resolves.toBe(0);
  });

  it("maps normalized duplicate email races to the public conflict response", async () => {
    const input = { name: "Duplicate User", email: "duplicate@example.test", password: "CorrectHorseBatteryStaple" };
    const first = await api().post("/api/v1/auth/register").set("Content-Type", "application/json").send(input);
    const duplicate = await api()
      .post("/api/v1/auth/register")
      .set("Content-Type", "application/json")
      .send({ ...input, email: " DUPLICATE@EXAMPLE.TEST " });

    expect(first.status).toBe(201);
    expectError(duplicate, 409, "EMAIL_ALREADY_EXISTS");
  });

  it("issues a verified access token and opaque rotating-cookie session on successful login", async () => {
    const user = await createTestUser();
    const response = await login(user.email, user.password);

    expect(response.status).toBe(200);
    const result = authData(response);
    expect(result.user["id"]).toBe(user.id);
    expect(verifyAccessToken(result.accessToken)).toMatchObject({ userId: user.id, role: "USER" });
    const cookie = refreshCookie(response);
    const rawToken = cookie.slice("floodready_refresh=".length);
    const headers = setCookieHeaders(response).join(";");
    expect(headers).toContain("HttpOnly");
    expect(headers).toContain("SameSite=Strict");
    expect(headers).toContain("Path=/api/v1/auth");
    expect(headers).not.toContain("Secure");
    expect(JSON.stringify(response.body)).not.toContain(rawToken);

    const session = await prisma.refreshSession.findFirst({ where: { userId: user.id } });
    expect(session).not.toBeNull();
    if (session === null) {
      throw new Error("Expected refresh session");
    }
    expect(session.tokenHash).toBe(hashRefreshToken(rawToken));
    expect(session.tokenHash).not.toContain(rawToken);
    expect(session.familyId).toMatch(/^[0-9a-f-]{36}$/iu);
  });

  it("returns an indistinguishable credential error for nonexistent, wrong, inactive, and locked accounts", async () => {
    const wrongPassword = await createTestUser();
    const inactive = await createTestUser();
    const locked = await createTestUser();
    await prisma.user.update({ where: { id: inactive.id }, data: { isActive: false } });
    await prisma.user.update({ where: { id: locked.id }, data: { lockedUntil: new Date(Date.now() + 60_000) } });

    const responses = await Promise.all([
      login("missing@example.test", "CorrectHorseBatteryStaple"),
      login(wrongPassword.email, "NotTheCorrectPassword"),
      login(inactive.email, inactive.password),
      login(locked.email, locked.password)
    ]);
    const errors = responses.map((response) => expectError(response, 401, "INVALID_CREDENTIALS"));

    for (const error of errors) {
      expect(error["message"]).toBe("Invalid email or password");
      expect(error["details"]).toEqual([]);
    }
  });

  it("persists failure-window locking and resets counters only after a successful login", async () => {
    const user = await createTestUser();

    for (let count = 0; count < config.LOGIN_FAILURE_MAX; count += 1) {
      const failed = await login(user.email, "NotTheCorrectPassword");
      expectError(failed, 401, "INVALID_CREDENTIALS");
    }

    const locked = await prisma.user.findUnique({ where: { id: user.id } });
    expect(locked?.failedLoginAttempts).toBe(config.LOGIN_FAILURE_MAX);
    expect(locked?.lockedUntil).not.toBeNull();
    const rejectedCorrectPassword = await login(user.email, user.password);
    expectError(rejectedCorrectPassword, 401, "INVALID_CREDENTIALS");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 2,
        failedLoginWindowStartedAt: new Date(),
        lockedUntil: null
      }
    });
    const successful = await login(user.email, user.password);
    expect(successful.status).toBe(200);
    const reset = await prisma.user.findUnique({ where: { id: user.id } });
    expect(reset).toMatchObject({ failedLoginAttempts: 0, failedLoginWindowStartedAt: null, lockedUntil: null });
  });

  it("rejects issuer, audience, type, and expiry token defects before protected routes", async () => {
    const user = await createTestUser();
    const secret = Buffer.from(config.ACCESS_TOKEN_SECRET, "base64url");
    const createToken = (payload: Record<string, unknown>, issuer: string, audience: string, expiresIn: number): string => jwt.sign(payload, secret, {
      algorithm: "HS512",
      issuer,
      audience,
      subject: user.id,
      jwtid: crypto.randomUUID(),
      expiresIn
    });
    const tokens = [
      createToken({ tokenType: "access", role: "USER" }, "wrong-issuer", config.JWT_AUDIENCE, 900),
      createToken({ tokenType: "access", role: "USER" }, config.JWT_ISSUER, "wrong-audience", 900),
      createToken({ tokenType: "refresh", role: "USER" }, config.JWT_ISSUER, config.JWT_AUDIENCE, 900),
      createToken({ tokenType: "access", role: "USER" }, config.JWT_ISSUER, config.JWT_AUDIENCE, -31)
    ];

    for (const token of tokens) {
      const response = await api().get("/api/v1/auth/me").set(bearer(token));
      expectError(response, 401, "AUTHENTICATION_REQUIRED");
    }
  });

  it("returns the safe current-user DTO from an accepted access token", async () => {
    const user = await createTestUser();
    const loginResponse = await login(user.email, user.password);
    const result = authData(loginResponse);
    const response = await api().get("/api/v1/auth/me").set(bearer(result.accessToken));

    expect(response.status).toBe(200);
    const dto = expectUserDto(successData(response));
    expect(dto["id"]).toBe(user.id);
    expect(objectValue(dto)).not.toHaveProperty("passwordHash");
  });
});
