import { mkdir, rm } from "node:fs/promises"
import { beforeEach, describe, expect, it } from "vitest"
import { config } from "../../src/config/index.js"
import { prisma } from "../../src/database/prisma.js"
import { clearDatabase } from "../helpers/database.js"
import { api } from "../helpers/http.js"
import { jpegImage } from "../fixtures/images.js"
import { bearer, responseId, signInTestUser, submitReport } from "./report-test-support.js"

const bbox = { east: "78.000000", north: "13.000000", south: "12.000000", west: "77.000000" }

beforeEach(async () => {
  await clearDatabase()
  await rm(config.UPLOAD_DIRECTORY, { force: true, recursive: true })
  await mkdir(config.UPLOAD_DIRECTORY, { recursive: true })
})

describe("Milestone 2 persisted report to map flow", () => {
  it("creates one report and returns the same persisted record through map and detail reads", async () => {
    const actor = await signInTestUser()
    const created = await submitReport(actor.accessToken, {
      description: "Water covers both lanes beside the metro station.",
      latitude: "12.971600",
      longitude: "77.594600",
      severityClaim: "SEVERE",
    })
    expect(created.status).toBe(201)
    const reportId = responseId(created)
    expect(created.body.data).toMatchObject({
      description: "Water covers both lanes beside the metro station.",
      id: reportId,
      latitude: 12.9716,
      longitude: 77.5946,
      severityClaim: "SEVERE",
      verificationStatus: "PENDING_REVIEW",
      aiAnalysis: expect.objectContaining({ status: "PROCESSING" }),
    })
    expect(typeof created.body.data.createdAt).toBe("string")
    expect(typeof created.body.data.submittedAt).toBe("string")

    const persisted = await prisma.floodReport.findUnique({ where: { id: reportId } })
    expect(persisted).not.toBeNull()

    const firstMapRead = await api().get("/api/v1/reports/map").set("Authorization", bearer(actor.accessToken)).query(bbox)
    expect(firstMapRead.status).toBe(200)
    expect(firstMapRead.body.data.items).toContainEqual(expect.objectContaining({
      id: reportId,
      latitude: 12.9716,
      longitude: 77.5946,
      severityClaim: "SEVERE",
      verificationStatus: "PENDING_REVIEW",
    }))

    const detail = await api().get(`/api/v1/reports/${reportId}`).set("Authorization", bearer(actor.accessToken))
    expect(detail.status).toBe(200)
    expect(detail.body.data).toMatchObject({ id: reportId, description: "Water covers both lanes beside the metro station." })

    const refreshMapRead = await api().get("/api/v1/reports/map").set("Authorization", bearer(actor.accessToken)).query(bbox)
    expect(refreshMapRead.status).toBe(200)
    expect(refreshMapRead.body.data.items.some((report: { id: string }) => report.id === reportId)).toBe(true)
  })

  it("rejects missing and invalid core report fields without persisting a row", async () => {
    const actor = await signInTestUser()
    expect((await submitReport(actor.accessToken, { description: "short" })).status).toBe(400)
    expect((await submitReport(actor.accessToken, { severityClaim: "EXTREME" })).status).toBe(400)
    expect((await submitReport(actor.accessToken, { latitude: "91.000000" })).status).toBe(400)
    expect((await submitReport(actor.accessToken, { longitude: "181.000000" })).status).toBe(400)

    const missingLocation = await api()
      .post("/api/v1/reports")
      .set("Authorization", bearer(actor.accessToken))
      .field("category", "FLOODED_ROAD")
      .field("description", "Water covers both lanes beside the metro station.")
      .field("severityClaim", "MODERATE")
      .field("capturedAt", new Date(Date.now() - 60_000).toISOString())
      .attach("image", await jpegImage(), { contentType: "image/jpeg", filename: "report.jpg" })
    expect(missingLocation.status).toBe(400)
    expect(await prisma.floodReport.count()).toBe(0)
  })
})
