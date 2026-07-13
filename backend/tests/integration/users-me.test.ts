import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../src/database/prisma.js";
import { clearDatabase, createTestUser } from "../helpers/database.js";
import { api } from "../helpers/http.js";
import { authData, bearer, expectError, expectUserDto, successData } from "./contracts.js";

const login = async (email: string, password: string) => api()
  .post("/api/v1/auth/login")
  .set("Content-Type", "application/json")
  .send({ email, password });

beforeEach(async () => {
  await clearDatabase();
});

describe("user self-service", () => {
  it("returns the same safe UserDto from both current-user endpoints", async () => {
    const user = await createTestUser();
    const result = authData(await login(user.email, user.password));
    const authMe = await api().get("/api/v1/auth/me").set(bearer(result.accessToken));
    const usersMe = await api().get("/api/v1/users/me").set(bearer(result.accessToken));

    expect(authMe.status).toBe(200);
    expect(usersMe.status).toBe(200);
    const authDto = expectUserDto(successData(authMe));
    const usersDto = expectUserDto(successData(usersMe));
    expect(authDto).toEqual(usersDto);
    expect(authDto["id"]).toBe(user.id);
    expect(JSON.stringify(authDto)).not.toContain("passwordHash");
  });

  it("updates only a normalized name and creates exactly one allowlisted audit record", async () => {
    const user = await createTestUser();
    const result = authData(await login(user.email, user.password));
    const changed = await api()
      .patch("/api/v1/users/me")
      .set(bearer(result.accessToken))
      .set("Content-Type", "application/json")
      .send({ name: "  Updated\t User  " });

    expect(changed.status).toBe(200);
    const dto = expectUserDto(successData(changed));
    expect(dto["name"]).toBe("Updated User");
    const auditsAfterChange = await prisma.auditLog.findMany({ where: { actorId: user.id, action: "USER_PROFILE_UPDATED" } });
    expect(auditsAfterChange).toHaveLength(1);
    expect(auditsAfterChange[0]).toMatchObject({
      entityType: "USER",
      entityId: user.id,
      metadata: { changedFields: ["name"] }
    });

    const noChange = await api()
      .patch("/api/v1/users/me")
      .set(bearer(result.accessToken))
      .set("Content-Type", "application/json")
      .send({ name: "Updated User" });
    expect(noChange.status).toBe(200);
    expect(await prisma.auditLog.count({ where: { actorId: user.id, action: "USER_PROFILE_UPDATED" } })).toBe(1);
  });

  it("rejects unauthenticated, wrong-content-type, and mass-assignment profile requests", async () => {
    const user = await createTestUser();
    const result = authData(await login(user.email, user.password));
    const anonymous = await api().get("/api/v1/users/me");
    const wrongContentType = await api()
      .patch("/api/v1/users/me")
      .set(bearer(result.accessToken))
      .set("Content-Type", "text/plain")
      .send("name=Wrong Type");
    const massAssignment = await api()
      .patch("/api/v1/users/me")
      .set(bearer(result.accessToken))
      .set("Content-Type", "application/json")
      .send({ name: "New User", email: "attacker@example.test", role: "ADMIN", isActive: false });

    expectError(anonymous, 401, "AUTHENTICATION_REQUIRED");
    expectError(wrongContentType, 415, "UNSUPPORTED_MEDIA_TYPE");
    expectError(massAssignment, 400, "VALIDATION_ERROR");
    const persisted = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(persisted.email).toBe(user.email);
    expect(persisted.role).toBe("USER");
    expect(persisted.isActive).toBe(true);
  });
});
