import { mkdir, readFile, rm } from "node:fs/promises"
import { resolve } from "node:path"
import sharp from "sharp"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { config } from "../../src/config/index.js"
import { prisma } from "../../src/database/prisma.js"
import { jpegImage, jpegWithMetadata, truncatedJpeg } from "../fixtures/images.js"
import { clearDatabase } from "../helpers/database.js"
import { api } from "../helpers/http.js"
import { bearer, reportFields, responseId, signInTestUser, submitReport } from "./report-test-support.js"

const uploadPath = (key: string): string => resolve(config.UPLOAD_DIRECTORY, ...key.split("/"))

beforeEach(async () => {
  await clearDatabase()
  await rm(config.UPLOAD_DIRECTORY, { force: true, recursive: true })
  await mkdir(config.UPLOAD_DIRECTORY, { recursive: true })
})

afterEach(async () => {
  await rm(config.UPLOAD_DIRECTORY, { force: true, recursive: true })
})

describe("POST /api/v1/reports", () => {
  it("creates an owner-scoped submitted report, audit record, and metadata-free image", async () => {
    const actor = await signInTestUser()
    const uploaded = await jpegWithMetadata()
    const uploadedMetadata = await sharp(uploaded).metadata()
    expect(uploadedMetadata.exif).toBeDefined()

    const response = await submitReport(actor.accessToken, {}, uploaded)

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      success: true,
      data: {
        category: "FLOODED_ROAD",
        gpsAccuracy: 4.5,
        incidentId: null,
        latitude: 12.9716,
        longitude: 77.5946,
        reporterId: actor.user.id,
        severityClaim: "MODERATE",
        uploadSource: "WEB",
        verificationStatus: "SUBMITTED",
      },
    })
    expect(response.body.data).not.toHaveProperty("imagePath")
    expect(response.body.data).not.toHaveProperty("imageKey")

    const id = responseId(response)
    const report = await prisma.floodReport.findUnique({
      select: { imagePath: true, incidentId: true, reporterId: true, verificationStatus: true },
      where: { id },
    })
    expect(report).not.toBeNull()
    expect(report).toMatchObject({
      incidentId: null,
      reporterId: actor.user.id,
      verificationStatus: "SUBMITTED",
    })
    if (report === null) {
      throw new Error("Expected the persisted report")
    }
    expect(report.imagePath).toMatch(/^reports\/\d{4}\/(0[1-9]|1[0-2])\/[0-9a-f-]+\.jpg$/u)
    expect(report.imagePath).not.toContain("untrusted-client-name")

    const storedMetadata = await sharp(await readFile(uploadPath(report.imagePath))).metadata()
    expect(storedMetadata.exif).toBeUndefined()
    expect(storedMetadata.icc).toBeUndefined()

    const audit = await prisma.auditLog.findFirst({
      where: { action: "REPORT_CREATED", entityId: id },
    })
    expect(audit).toMatchObject({
      actorId: actor.user.id,
      entityType: "FLOOD_REPORT",
      metadata: { uploadSource: "WEB", verificationStatus: "SUBMITTED" },
    })
  })

  it("rejects missing authentication before accepting report data", async () => {
    const response = await api()
      .post("/api/v1/reports")
      .field("category", "FLOODED_ROAD")
      .field("latitude", "12.971600")
      .field("longitude", "77.594600")
      .field("gpsAccuracy", "4.5")
      .field("capturedAt", new Date(Date.now() - 60_000).toISOString())
      .attach("image", await jpegImage(), { contentType: "image/jpeg", filename: "report.jpg" })

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED")
    expect(await prisma.floodReport.count()).toBe(0)
  })

  it("rejects duplicate and unknown fields plus forged and corrupt image uploads", async () => {
    const actor = await signInTestUser()
    const fields = reportFields()
    const duplicate = await api()
      .post("/api/v1/reports")
      .set("Authorization", bearer(actor.accessToken))
      .field("category", fields.category)
      .field("latitude", fields.latitude)
      .field("latitude", "13.000000")
      .field("longitude", fields.longitude)
      .field("gpsAccuracy", fields.gpsAccuracy)
      .field("capturedAt", fields.capturedAt)
      .attach("image", await jpegImage(), { contentType: "image/jpeg", filename: "duplicate.jpg" })
    expect(duplicate.status).toBe(400)
    expect(duplicate.body.error.code).toBe("VALIDATION_ERROR")

    const unknown = await api()
      .post("/api/v1/reports")
      .set("Authorization", bearer(actor.accessToken))
      .field("category", fields.category)
      .field("latitude", fields.latitude)
      .field("longitude", fields.longitude)
      .field("gpsAccuracy", fields.gpsAccuracy)
      .field("capturedAt", fields.capturedAt)
      .field("reporterId", actor.user.id)
      .attach("image", await jpegImage(), { contentType: "image/jpeg", filename: "unknown.jpg" })
    expect(unknown.status).toBe(400)
    expect(unknown.body.error.code).toBe("VALIDATION_ERROR")

    const mimeMismatch = await submitReport(actor.accessToken, {}, await jpegImage(), "image/png")
    expect(mimeMismatch.status).toBe(415)
    expect(mimeMismatch.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE")

    const corrupt = await submitReport(actor.accessToken, {}, truncatedJpeg())
    expect(corrupt.status).toBe(422)
    expect(corrupt.body.error.code).toBe("INVALID_IMAGE")
    expect(await prisma.floodReport.count()).toBe(0)
  })
})
