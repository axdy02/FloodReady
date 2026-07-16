import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { config } from "../../src/config/index.js"
import { prisma } from "../../src/database/prisma.js"
import { jpegImage } from "../fixtures/images.js"
import { clearDatabase } from "../helpers/database.js"
import { api } from "../helpers/http.js"
import { bearer, responseId, signInTestUser, submitReport } from "./report-test-support.js"

const bbox = { east: "78.000000", north: "13.000000", south: "12.000000", west: "77.000000" }

const map = (token: string, query: Record<string, string> = bbox) => api()
  .get("/api/v1/reports/map")
  .set("Authorization", bearer(token))
  .query(query)

const uploadPath = (key: string): string => resolve(config.UPLOAD_DIRECTORY, ...key.split("/"))

const submitManual = async (token: string, accuracy?: string) => {
  const request = api()
    .post("/api/v1/reports")
    .set("Authorization", bearer(token))
    .field("category", "FLOODED_ROAD")
    .field("latitude", "12.971600")
    .field("longitude", "77.594600")
    .field("locationSource", "MANUAL")
    .field("capturedAt", new Date(Date.now() - 60_000).toISOString())
    .field("description", "Water covers both lanes near the selected point.")
    .attach("image", await jpegImage(), { contentType: "image/jpeg", filename: "manual.jpg" })
  if (accuracy !== undefined) request.field("gpsAccuracy", accuracy)
  return request
}

beforeEach(async () => {
  await clearDatabase()
  await rm(config.UPLOAD_DIRECTORY, { force: true, recursive: true })
})

describe("frontend compatibility", () => {
  it("enforces map bounds, privacy, cursor binding, rejected exclusion, totals, and rate limits", async () => {
    const owner = await signInTestUser()
    const other = await signInTestUser()
    const moderator = await signInTestUser("MODERATOR")
    const first = await submitReport(owner.accessToken)
    const second = await submitReport(owner.accessToken)
    const rejected = await submitReport(owner.accessToken)
    await prisma.floodReport.update({ data: { verificationStatus: "REJECTED" }, where: { id: responseId(rejected) } })

    expect((await api().get("/api/v1/reports/map").query(bbox)).status).toBe(401)
    expect((await map(owner.accessToken, {})).status).toBe(400)
    expect((await map(owner.accessToken, { ...bbox, west: "77.0000001" })).status).toBe(400)
    expect((await map(owner.accessToken, { ...bbox, east: "79.000001", north: "12.100000" })).status).toBe(400)
    expect((await map(owner.accessToken, { ...bbox, east: "77.100000", north: "14.000001" })).status).toBe(400)
    expect((await map(owner.accessToken, { ...bbox, east: "78.100000" })).status).toBe(400)

    const page = await map(owner.accessToken, { ...bbox, limit: "1", sort: "asc" })
    expect(page.status).toBe(200)
    expect(page.body.data.totalCount).toBe(2)
    expect(page.body.data.items).toHaveLength(1)
    expect(Object.keys(page.body.data.items[0]).sort()).toEqual(["aiAnalysis", "aiUsed", "canViewDetails", "capturedAt", "category", "finalSeverity", "id", "incidentId", "latitude", "longitude", "severityClaim", "submittedAt", "updatedAt", "verificationStatus"])
    expect(page.body.data.items[0].aiUsed).toBe(false)
    expect(page.body.data.items[0].aiAnalysis).toMatchObject({ status: "PROCESSING" })
    expect(page.body.data.items[0].canViewDetails).toBe(true)
    const cursor: unknown = page.body.data.pagination.nextCursor
    if (typeof cursor !== "string") throw new Error("Expected report-map cursor")
    expect((await map(owner.accessToken, { ...bbox, cursor, limit: "1", sort: "asc" })).body.data.totalCount).toBe(2)
    expect((await map(other.accessToken, { ...bbox, cursor, limit: "1", sort: "asc" })).status).toBe(400)
    expect((await map(owner.accessToken, { ...bbox, cursor, east: "77.900000", limit: "1", sort: "asc" })).status).toBe(400)
    expect((await api().get("/api/v1/reports").set("Authorization", bearer(moderator.accessToken)).query({ cursor, limit: "1", sort: "asc" })).status).toBe(400)
    expect((await map(other.accessToken, bbox)).body.data.items[0].canViewDetails).toBe(false)
    expect((await map(moderator.accessToken, bbox)).body.data.items[0].canViewDetails).toBe(true)
    expect((await map(owner.accessToken, { ...bbox, limit: "2", sort: "asc" })).body.data.totalCount).toBe(2)

    const limitedActor = await signInTestUser()
    for (let count = 0; count < 60; count += 1) expect((await map(limitedActor.accessToken)).status).toBe(200)
    expect((await map(limitedActor.accessToken)).status).toBe(429)
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
  })

  it("returns collection totals, linked report counts, and authorized private image bytes", async () => {
    const owner = await signInTestUser()
    const moderator = await signInTestUser("MODERATOR")
    const other = await signInTestUser()
    const first = await submitReport(owner.accessToken)
    const second = await submitReport(owner.accessToken)
    const third = await submitReport(owner.accessToken)
    const incident = await prisma.incident.create({ data: { category: "FLOODED_ROAD", confidenceScore: null, firstReportedAt: new Date("2026-07-01T09:00:00.000Z"), lastReportedAt: new Date("2026-07-01T09:05:00.000Z"), latitude: 12.9716, longitude: 77.5946, severity: "MODERATE", status: "ACTIVE" } })
    await prisma.floodReport.update({ data: { incidentId: incident.id }, where: { id: responseId(first) } })
    await prisma.floodReport.update({ data: { incidentId: incident.id }, where: { id: responseId(second) } })
    const reports = await api().get("/api/v1/reports").set("Authorization", bearer(moderator.accessToken)).query({ limit: "1", sort: "asc" })
    const own = await api().get("/api/v1/users/me/reports").set("Authorization", bearer(owner.accessToken)).query({ limit: "1" })
    const incidents = await api().get("/api/v1/incidents").query({ limit: "1" })
    expect(reports.body.data.totalCount).toBe(3)
    expect(own.body.data.totalCount).toBe(3)
    expect(incidents.body.data.totalCount).toBe(1)
    expect(incidents.body.data.items[0].reportCount).toBe(2)
    const cursor: unknown = reports.body.data.pagination.nextCursor
    if (typeof cursor !== "string") throw new Error("Expected report cursor")
    const nextReports = await api().get("/api/v1/reports").set("Authorization", bearer(moderator.accessToken)).query({ cursor, limit: "1", sort: "asc" })
    expect(nextReports.body.data.totalCount).toBe(3)

    const reportId = responseId(third)
    const stored = await prisma.floodReport.findUniqueOrThrow({ where: { id: reportId } })
    const image = await api().get(`/api/v1/reports/${reportId}/image`).set("Authorization", bearer(owner.accessToken))
    expect(image.status).toBe(200)
    expect(image.headers["content-type"]).toBe("image/jpeg")
    expect(image.headers["cache-control"]).toBe("private, no-store")
    expect(image.headers["content-disposition"]).toBe("inline")
    expect(image.headers["x-content-type-options"]).toBe("nosniff")
    expect(image.body.length).toBeGreaterThan(0)
    const hidden = await api().get(`/api/v1/reports/${reportId}/image`).set("Authorization", bearer(other.accessToken))
    expect(hidden.status).toBe(404)
    expect(JSON.stringify(hidden.body)).not.toContain(stored.imagePath)
    await rm(uploadPath(stored.imagePath))
    expect((await api().get(`/api/v1/reports/${reportId}/image`).set("Authorization", bearer(owner.accessToken))).status).toBe(404)
  })

  it("preserves legacy DEVICE_GPS and enforces manual accuracy and description boundaries", async () => {
    const actor = await signInTestUser()
    const legacy = await submitReport(actor.accessToken)
    expect(legacy.body.data.locationSource).toBe("DEVICE_GPS")
    const manual = await submitManual(actor.accessToken)
    expect(manual.status).toBe(201)
    expect(manual.body.data.gpsAccuracy).toBeNull()
    expect((await submitManual(actor.accessToken, "4.5")).status).toBe(400)
    const missingAccuracy = await api().post("/api/v1/reports").set("Authorization", bearer(actor.accessToken)).field("category", "FLOODED_ROAD").field("latitude", "12.971600").field("longitude", "77.594600").field("locationSource", "DEVICE_GPS").field("capturedAt", new Date(Date.now() - 60_000).toISOString()).attach("image", await jpegImage(), { contentType: "image/jpeg", filename: "device.jpg" })
    expect(missingAccuracy.status).toBe(400)
    expect((await submitReport(actor.accessToken, { description: "x".repeat(1000) })).status).toBe(201)
    expect((await submitReport(actor.accessToken, { description: "x".repeat(1001) })).status).toBe(400)
    expect((await submitReport(actor.accessToken, { description: "😀".repeat(1000) })).status).toBe(201)
    expect((await submitReport(actor.accessToken, { description: "😀".repeat(1001) })).status).toBe(400)
    const preserved = await submitReport(actor.accessToken, { description: "  \u00a0Preserved \u212b\u00a0  " })
    expect(preserved.status).toBe(201)
    expect(preserved.body.data.description).toBe("Preserved \u212b")
  })
})
