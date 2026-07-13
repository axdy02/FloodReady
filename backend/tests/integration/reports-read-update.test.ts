import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "../../src/database/prisma.js"
import { clearDatabase } from "../helpers/database.js"
import { api } from "../helpers/http.js"
import { bearer, responseId, signInTestUser, submitReport } from "./report-test-support.js"

beforeEach(async () => {
  await clearDatabase()
})

describe("report reads and owner updates", () => {
  it("limits report reads by role and binds own-report pagination to the owner", async () => {
    const owner = await signInTestUser()
    const first = await submitReport(owner.accessToken, { description: "First report" })
    const second = await submitReport(owner.accessToken, { description: "Second report" })
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    const firstId = responseId(first)
    const secondId = responseId(second)

    const other = await signInTestUser()
    const hidden = await api()
      .get(`/api/v1/reports/${firstId}`)
      .set("Authorization", bearer(other.accessToken))
    expect(hidden.status).toBe(404)
    expect(hidden.body.error.code).toBe("NOT_FOUND")

    const userList = await api()
      .get("/api/v1/reports")
      .set("Authorization", bearer(owner.accessToken))
    expect(userList.status).toBe(403)
    expect(userList.body.error.code).toBe("FORBIDDEN")

    const moderator = await signInTestUser("MODERATOR")
    const moderatorList = await api()
      .get("/api/v1/reports")
      .query({ limit: "1", sort: "asc" })
      .set("Authorization", bearer(moderator.accessToken))
    expect(moderatorList.status).toBe(200)
    expect(moderatorList.body.data.items).toHaveLength(1)
    expect(moderatorList.body.data.pagination).toMatchObject({ hasMore: true, limit: 1 })
    expect(typeof moderatorList.body.data.pagination.nextCursor).toBe("string")

    const ownFirstPage = await api()
      .get("/api/v1/users/me/reports")
      .query({ limit: "1", sort: "asc" })
      .set("Authorization", bearer(owner.accessToken))
    expect(ownFirstPage.status).toBe(200)
    expect(ownFirstPage.body.data.items).toHaveLength(1)
    const cursor: unknown = ownFirstPage.body.data.pagination.nextCursor
    if (typeof cursor !== "string") {
      throw new Error("Expected own-report cursor")
    }

    const ownSecondPage = await api()
      .get("/api/v1/users/me/reports")
      .query({ cursor, limit: "1", sort: "asc" })
      .set("Authorization", bearer(owner.accessToken))
    expect(ownSecondPage.status).toBe(200)
    expect(ownSecondPage.body.data.items).toHaveLength(1)
    expect([firstId, secondId]).toContain(ownFirstPage.body.data.items[0].id)
    expect([firstId, secondId]).toContain(ownSecondPage.body.data.items[0].id)
    expect(ownSecondPage.body.data.items[0].id).not.toBe(ownFirstPage.body.data.items[0].id)

    const cursorAsOther = await api()
      .get("/api/v1/users/me/reports")
      .query({ cursor, limit: "1", sort: "asc" })
      .set("Authorization", bearer(other.accessToken))
    expect(cursorAsOther.status).toBe(400)
    expect(cursorAsOther.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("allows only editable owner fields, records real changes, and prevents edits after moderation", async () => {
    const owner = await signInTestUser()
    const created = await submitReport(owner.accessToken)
    expect(created.status).toBe(201)
    const reportId = responseId(created)

    const massAssignment = await api()
      .patch(`/api/v1/reports/${reportId}`)
      .set("Authorization", bearer(owner.accessToken))
      .send({ reporterId: owner.user.id, severityClaim: "SEVERE" })
    expect(massAssignment.status).toBe(400)
    expect(massAssignment.body.error.code).toBe("VALIDATION_ERROR")

    const update = await api()
      .patch(`/api/v1/reports/${reportId}`)
      .set("Authorization", bearer(owner.accessToken))
      .send({ description: "  Water now covers both lanes.  ", severityClaim: "SEVERE" })
    expect(update.status).toBe(200)
    expect(update.body.data).toMatchObject({
      description: "Water now covers both lanes.",
      severityClaim: "SEVERE",
    })

    const audit = await prisma.auditLog.findFirst({
      where: { action: "REPORT_UPDATED", entityId: reportId },
    })
    expect(audit?.metadata).toEqual({ changedFields: ["description", "severityClaim"] })

    const sameValue = await api()
      .patch(`/api/v1/reports/${reportId}`)
      .set("Authorization", bearer(owner.accessToken))
      .send({ description: "Water now covers both lanes.", severityClaim: "SEVERE" })
    expect(sameValue.status).toBe(200)
    expect(await prisma.auditLog.count({ where: { action: "REPORT_UPDATED", entityId: reportId } })).toBe(1)

    const moderator = await signInTestUser("MODERATOR")
    const moderation = await api()
      .patch(`/api/v1/reports/${reportId}/status`)
      .set("Authorization", bearer(moderator.accessToken))
      .send({ status: "VERIFIED" })
    expect(moderation.status).toBe(200)

    const blockedEdit = await api()
      .patch(`/api/v1/reports/${reportId}`)
      .set("Authorization", bearer(owner.accessToken))
      .send({ description: "Attempted post-verification edit" })
    expect(blockedEdit.status).toBe(409)
    expect(blockedEdit.body.error.code).toBe("REPORT_NOT_EDITABLE")
  })
})
