import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../src/database/prisma.js";
import { clearDatabase, createTestUser } from "../helpers/database.js";
import { api } from "../helpers/http.js";
import { arrayValue, authData, bearer, expectError, expectUserDto, objectValue, stringValue, successData } from "./contracts.js";

const login = async (email: string, password: string) => api()
  .post("/api/v1/auth/login")
  .set("Content-Type", "application/json")
  .send({ email, password });

beforeEach(async () => {
  await clearDatabase();
});

describe("administrator user management", () => {
  it("enforces admin-only list and detail access with bounded keyset filtering", async () => {
    const admin = await createTestUser("ADMIN");
    const ordinary = await createTestUser("USER");
    const moderator = await createTestUser("MODERATOR");
    await createTestUser("USER");
    await createTestUser("USER");
    const adminAccess = authData(await login(admin.email, admin.password)).accessToken;
    const ordinaryAccess = authData(await login(ordinary.email, ordinary.password)).accessToken;
    const moderatorAccess = authData(await login(moderator.email, moderator.password)).accessToken;

    const anonymous = await api().get("/api/v1/users");
    const ordinaryDenied = await api().get("/api/v1/users").set(bearer(ordinaryAccess));
    const moderatorDenied = await api().get("/api/v1/users").set(bearer(moderatorAccess));
    const listed = await api()
      .get("/api/v1/users")
      .set(bearer(adminAccess))
      .query({ role: "USER", isActive: "true", limit: "1", sort: "asc" });

    expectError(anonymous, 401, "AUTHENTICATION_REQUIRED");
    expectError(ordinaryDenied, 403, "FORBIDDEN");
    expectError(moderatorDenied, 403, "FORBIDDEN");
    expect(listed.status).toBe(200);
    const collection = successData(listed);
    const items = arrayValue(collection["items"]);
    expect(items).toHaveLength(1);
    expectUserDto(items[0]);
    const pagination = objectValue(collection["pagination"]);
    expect(pagination["limit"]).toBe(1);
    expect(pagination["hasMore"]).toBe(true);
    const cursor = stringValue(pagination["nextCursor"]);
    const mismatch = await api()
      .get("/api/v1/users")
      .set(bearer(adminAccess))
      .query({ role: "MODERATOR", isActive: "true", limit: "1", sort: "asc", cursor });

    expectError(mismatch, 400, "VALIDATION_ERROR");
    const detail = await api().get(`/api/v1/users/${ordinary.id}`).set(bearer(adminAccess));
    expect(detail.status).toBe(200);
    expect(expectUserDto(successData(detail))["id"]).toBe(ordinary.id);
    const malformed = await api().get("/api/v1/users/not-a-uuid").set(bearer(adminAccess));
    const missing = await api().get("/api/v1/users/00000000-0000-0000-0000-000000000000").set(bearer(adminAccess));
    expectError(malformed, 400, "VALIDATION_ERROR");
    expectError(missing, 404, "NOT_FOUND");
  });

  it("revokes target sessions and writes an exact audit only for a real administrative change", async () => {
    const admin = await createTestUser("ADMIN");
    const target = await createTestUser("USER");
    const adminAccess = authData(await login(admin.email, admin.password)).accessToken;
    await login(target.email, target.password);
    const noChange = await api()
      .patch(`/api/v1/users/${target.id}`)
      .set(bearer(adminAccess))
      .set("Content-Type", "application/json")
      .send({ role: "USER", isActive: true });

    expect(noChange.status).toBe(200);
    expect(await prisma.refreshSession.count({ where: { userId: target.id, revokedAt: null } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "ADMIN_USER_UPDATED" } })).toBe(0);

    const changed = await api()
      .patch(`/api/v1/users/${target.id}`)
      .set(bearer(adminAccess))
      .set("Content-Type", "application/json")
      .send({ role: "MODERATOR", isActive: true });
    expect(changed.status).toBe(200);
    expect(expectUserDto(successData(changed))["role"]).toBe("MODERATOR");
    expect(await prisma.refreshSession.count({ where: { userId: target.id, revokedAt: null } })).toBe(0);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "ADMIN_USER_UPDATED" } });
    expect(audit).toMatchObject({
      actorId: admin.id,
      entityType: "USER",
      entityId: target.id,
      metadata: { previousRole: "USER", newRole: "MODERATOR", previousIsActive: true, newIsActive: true }
    });
  });

  it("prevents a real self-change while allowing a same-value self request without an audit", async () => {
    const admin = await createTestUser("ADMIN");
    const accessToken = authData(await login(admin.email, admin.password)).accessToken;
    const sameValue = await api()
      .patch(`/api/v1/users/${admin.id}`)
      .set(bearer(accessToken))
      .set("Content-Type", "application/json")
      .send({ role: "ADMIN" });
    const realChange = await api()
      .patch(`/api/v1/users/${admin.id}`)
      .set(bearer(accessToken))
      .set("Content-Type", "application/json")
      .send({ isActive: false });

    expect(sameValue.status).toBe(200);
    expectError(realChange, 409, "ADMIN_SAFEGUARD");
    expect(await prisma.auditLog.count({ where: { action: "ADMIN_USER_UPDATED" } })).toBe(0);
  });

  it("keeps one active administrator when competing deactivations reach either safeguard or revoked-auth outcome", async () => {
    const firstAdmin = await createTestUser("ADMIN");
    const secondAdmin = await createTestUser("ADMIN");
    const firstToken = authData(await login(firstAdmin.email, firstAdmin.password)).accessToken;
    const secondToken = authData(await login(secondAdmin.email, secondAdmin.password)).accessToken;
    const [first, second] = await Promise.all([
      api()
        .patch(`/api/v1/users/${secondAdmin.id}`)
        .set(bearer(firstToken))
        .set("Content-Type", "application/json")
        .send({ isActive: false }),
      api()
        .patch(`/api/v1/users/${firstAdmin.id}`)
        .set(bearer(secondToken))
        .set("Content-Type", "application/json")
        .send({ isActive: false })
    ]);
    const statuses = [first.status, second.status].sort((left, right) => left - right);

    expect([[200, 401], [200, 409]]).toContainEqual(statuses);
    expect(await prisma.user.count({ where: { role: "ADMIN", isActive: true } })).toBe(1);
  });
});
