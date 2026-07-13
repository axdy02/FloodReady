import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "../../src/database/prisma.js"
import { clearDatabase } from "../helpers/database.js"
import { api } from "../helpers/http.js"

interface IncidentSeed {
  category?: "FLOODED_ROAD" | "OPEN_MANHOLE"
  latitude?: number
  longitude?: number
  severity?: "MINOR" | "SEVERE"
  status?: "ACTIVE" | "RESOLVED"
  timestamp?: Date
}

const seedIncident = async (overrides: IncidentSeed = {}) => {
  const timestamp = overrides.timestamp ?? new Date("2025-04-10T10:00:00.000Z")
  return prisma.incident.create({
    data: {
      category: overrides.category ?? "FLOODED_ROAD",
      confidenceScore: 0.75,
      firstReportedAt: new Date(timestamp.getTime() - 60_000),
      lastReportedAt: timestamp,
      latitude: overrides.latitude ?? 12.9716,
      longitude: overrides.longitude ?? 77.5946,
      severity: overrides.severity ?? "SEVERE",
      status: overrides.status ?? "ACTIVE",
    },
  })
}

beforeEach(async () => {
  await clearDatabase()
})

describe("public incident reads", () => {
  it("returns safe incident DTOs and applies every supported public filter including inclusive bbox edges", async () => {
    const target = await seedIncident()
    await seedIncident({
      category: "OPEN_MANHOLE",
      latitude: 13.5,
      longitude: 78.5,
      severity: "MINOR",
      status: "RESOLVED",
      timestamp: new Date("2025-04-12T10:00:00.000Z"),
    })

    const response = await api().get("/api/v1/incidents").query({
      category: "FLOODED_ROAD",
      east: "77.594600",
      from: "2025-04-10T10:00:00.000Z",
      north: "12.971600",
      severity: "SEVERE",
      south: "12.900000",
      status: "ACTIVE",
      to: "2025-04-10T10:00:00.000Z",
      west: "77.500000",
    })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      success: true,
      data: {
        items: [{
          id: target.id,
          latitude: 12.9716,
          longitude: 77.5946,
          severity: "SEVERE",
          status: "ACTIVE",
        }],
      },
    })
    expect(response.body.data.items[0]).not.toHaveProperty("location")
    expect(response.body.data.items[0]).not.toHaveProperty("reports")

    const detail = await api().get(`/api/v1/incidents/${target.id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.id).toBe(target.id)

    const missing = await api().get("/api/v1/incidents/00000000-0000-4000-8000-000000000000")
    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe("NOT_FOUND")
  })

  it("uses stable keyset pages and rejects malformed, filter-mismatched, and invalid geospatial input", async () => {
    const first = await seedIncident({ timestamp: new Date("2025-05-01T00:00:00.000Z") })
    const second = await seedIncident({ timestamp: new Date("2025-05-02T00:00:00.000Z") })
    await seedIncident({ timestamp: new Date("2025-05-03T00:00:00.000Z") })

    const pageOne = await api().get("/api/v1/incidents").query({ limit: "1", sort: "asc" })
    expect(pageOne.status).toBe(200)
    expect(pageOne.body.data.items).toHaveLength(1)
    expect(pageOne.body.data.items[0].id).toBe(first.id)
    const cursor: unknown = pageOne.body.data.pagination.nextCursor
    if (typeof cursor !== "string") {
      throw new Error("Expected incident cursor")
    }

    const pageTwo = await api().get("/api/v1/incidents").query({ cursor, limit: "1", sort: "asc" })
    expect(pageTwo.status).toBe(200)
    expect(pageTwo.body.data.items).toHaveLength(1)
    expect(pageTwo.body.data.items[0].id).toBe(second.id)

    const filterMismatch = await api().get("/api/v1/incidents").query({
      category: "FLOODED_ROAD",
      cursor,
      limit: "1",
      sort: "asc",
    })
    expect(filterMismatch.status).toBe(400)
    expect(filterMismatch.body.error.code).toBe("VALIDATION_ERROR")

    const malformedCursor = await api().get("/api/v1/incidents").query({ cursor: "not_a_cursor" })
    expect(malformedCursor.status).toBe(400)
    expect(malformedCursor.body.error.code).toBe("VALIDATION_ERROR")

    const partialBbox = await api().get("/api/v1/incidents").query({ west: "77.5" })
    expect(partialBbox.status).toBe(400)
    expect(partialBbox.body.error.code).toBe("VALIDATION_ERROR")

    const reversedBbox = await api().get("/api/v1/incidents").query({
      east: "77.5",
      north: "13.0",
      south: "12.0",
      west: "78.0",
    })
    expect(reversedBbox.status).toBe(400)
    expect(reversedBbox.body.error.code).toBe("VALIDATION_ERROR")
  })
})
