import { beforeEach, describe, expect, it } from "vitest"
import { prisma } from "../../src/database/prisma.js"
import { clearDatabase } from "../helpers/database.js"
import { api } from "../helpers/http.js"
import { bearer, responseId, signInTestUser, submitReport } from "./report-test-support.js"

beforeEach(async () => {
  await clearDatabase()
})

describe("report moderation", () => {
  it("enforces the role gate and the required reason code for disputed or rejected reports", async () => {
    const owner = await signInTestUser()
    const created = await submitReport(owner.accessToken)
    expect(created.status).toBe(201)
    const reportId = responseId(created)

    const unauthorized = await api()
      .patch(`/api/v1/reports/${reportId}/status`)
      .set("Authorization", bearer(owner.accessToken))
      .send({ status: "PENDING_REVIEW" })
    expect(unauthorized.status).toBe(403)
    expect(unauthorized.body.error.code).toBe("FORBIDDEN")

    const moderator = await signInTestUser("MODERATOR")
    const missingReason = await api()
      .patch(`/api/v1/reports/${reportId}/status`)
      .set("Authorization", bearer(moderator.accessToken))
      .send({ status: "REJECTED" })
    expect(missingReason.status).toBe(400)
    expect(missingReason.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("persists allowed status transitions with exact transition audit metadata", async () => {
    const owner = await signInTestUser()
    const created = await submitReport(owner.accessToken)
    expect(created.status).toBe(201)
    const reportId = responseId(created)
    const moderator = await signInTestUser("MODERATOR")

    expect(created.body.data.verificationStatus).toBe("PENDING_REVIEW")

    const disputed = await api()
      .patch(`/api/v1/reports/${reportId}/status`)
      .set("Authorization", bearer(moderator.accessToken))
      .send({ reasonCode: "DUPLICATE_REPORT", status: "DISPUTED" })
    expect(disputed.status).toBe(200)
    expect(disputed.body.data.verificationStatus).toBe("DISPUTED")

    const latestAudit = await prisma.auditLog.findFirst({
      orderBy: { createdAt: "desc" },
      where: { action: "REPORT_STATUS_CHANGED", entityId: reportId },
    })
    expect(latestAudit).toMatchObject({
      actorId: moderator.user.id,
      entityType: "FLOOD_REPORT",
      metadata: {
        newStatus: "DISPUTED",
        previousStatus: "PENDING_REVIEW",
        reasonCode: "DUPLICATE_REPORT",
      },
    })

    const sameStatus = await api()
      .patch(`/api/v1/reports/${reportId}/status`)
      .set("Authorization", bearer(moderator.accessToken))
      .send({ reasonCode: "DUPLICATE_REPORT", status: "DISPUTED" })
    expect(sameStatus.status).toBe(400)
    expect(sameStatus.body.error.code).toBe("INVALID_STATE_TRANSITION")
  })
})
