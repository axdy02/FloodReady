import { beforeEach, describe, expect, it } from "vitest";

import { Prisma } from "../../src/generated/prisma/client.js";
import { config } from "../../src/config/index.js";
import { prisma } from "../../src/database/prisma.js";
import { clearDatabase } from "../helpers/database.js";

interface StringRow {
  value: string;
}

beforeEach(async () => {
  await clearDatabase();
});

describe("PostGIS database contract", () => {
  it("runs only against the isolated test database", () => {
    expect(config.NODE_ENV).toBe("test");
    expect(config.TEST_DATABASE_URL).toBeDefined();
    expect(config.DATABASE_URL).toBe(config.TEST_DATABASE_URL);
    expect(new URL(config.TEST_DATABASE_URL ?? "postgresql://localhost/floodready_test").pathname).toMatch(/_test$/u);
  });

  it("enables PostGIS and computes generated geography points", async () => {
    const postgis = await prisma.$queryRaw<StringRow[]>(Prisma.sql`SELECT PostGIS_Version() AS "value"`);
    expect(postgis).toHaveLength(1);
    expect(postgis[0]?.value).toMatch(/^3\.6/u);

    const incident = await prisma.incident.create({
      data: {
        category: "FLOODED_ROAD",
        severity: "SEVERE",
        status: "ACTIVE",
        latitude: new Prisma.Decimal("12.5"),
        longitude: new Prisma.Decimal("77.5"),
        firstReportedAt: new Date("2026-07-11T00:00:00.000Z"),
        lastReportedAt: new Date("2026-07-11T00:05:00.000Z")
      }
    });
    const location = await prisma.$queryRaw<StringRow[]>(Prisma.sql`
      SELECT ST_AsText("location"::geometry) AS "value"
      FROM "incidents"
      WHERE "id" = ${incident.id}::uuid
    `);

    expect(location[0]?.value).toBe("POINT(77.5 12.5)");
  });

  it("enforces database lower-email and coordinate constraints", async () => {
    await expect(prisma.user.create({
      data: {
        name: "Uppercase Email",
        email: "UPPERCASE@example.test",
        passwordHash: "x"
      }
    })).rejects.toBeDefined();

    await expect(prisma.incident.create({
      data: {
        category: "FLOODED_ROAD",
        severity: "UNKNOWN",
        status: "ACTIVE",
        latitude: new Prisma.Decimal("91"),
        longitude: new Prisma.Decimal("77.5"),
        firstReportedAt: new Date("2026-07-11T00:00:00.000Z"),
        lastReportedAt: new Date("2026-07-11T00:05:00.000Z")
      }
    })).rejects.toBeDefined();
  });

  it("creates the keyset and geospatial indexes required by the API", async () => {
    const rows = await prisma.$queryRaw<StringRow[]>(Prisma.sql`
      SELECT indexname AS "value"
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    const indexes = new Set(rows.map((row) => row.value));

    expect([...indexes]).toEqual(expect.arrayContaining([
      "users_created_at_id_idx",
      "refresh_sessions_family_id_revoked_at_idx",
      "flood_reports_reporter_id_submitted_at_id_idx",
      "flood_reports_location_gist_idx",
      "incidents_status_last_reported_at_id_idx",
      "incidents_location_gist_idx"
    ]));
  });
});
