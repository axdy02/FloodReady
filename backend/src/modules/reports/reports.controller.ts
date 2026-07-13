import type { Request, RequestHandler } from "express"
import { AppError } from "../../shared/errors/index.js"
import { validateRequest } from "../../shared/validation/request-validation.js"
import type { ReportsService } from "./reports.service.js"
import {
  moderateReportSchema,
  parseReportMapQuery,
  parseReportListQuery,
  parseReportMetadata,
  reportIdParamsSchema,
  updateReportSchema,
} from "./reports.validation.js"
import { normalizeMultipartBody } from "./reports.upload.js"

function authenticatedUser(request: Request) {
  if (request.user === undefined) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required")
  }
  return request.user
}

function clientIp(request: Request): string {
  return request.ip ?? "::"
}

export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  readonly create: RequestHandler = async (request, response) => {
    try {
      const actor = authenticatedUser(request)
      const image = request.file
      if (image === undefined || image.buffer.length === 0) {
        throw new AppError(422, "INVALID_IMAGE", "Invalid image")
      }
      const serverTime = new Date()
      const metadata = validateRequest("body", () => parseReportMetadata(normalizeMultipartBody(request.body as unknown), serverTime))
      const report = await this.service.create({
        ...metadata,
        actorId: actor.id,
        imageBytes: image.buffer,
        imageMime: image.mimetype,
        ipAddress: clientIp(request),
        serverTime,
      })
      response.status(201).json({ success: true, data: report, requestId: request.requestId })
    } finally {
      request.uploadCapacityRelease?.()
      request.uploadCapacityRelease = undefined
    }
  }

  readonly get: RequestHandler = async (request, response) => {
    const actor = authenticatedUser(request)
    const { reportId } = validateRequest("params", () => reportIdParamsSchema.parse(request.params))
    const report = await this.service.get(reportId, { id: actor.id, role: actor.role })
    response.status(200).json({ success: true, data: report, requestId: request.requestId })
  }

  readonly list: RequestHandler = async (request, response) => {
    const reports = await this.service.list(validateRequest("query", () => parseReportListQuery(request.query)), null)
    response.status(200).json({ success: true, data: reports, requestId: request.requestId })
  }

  readonly listOwn: RequestHandler = async (request, response) => {
    const actor = authenticatedUser(request)
    const reports = await this.service.list(validateRequest("query", () => parseReportListQuery(request.query)), actor.id)
    response.status(200).json({ success: true, data: reports, requestId: request.requestId })
  }

  readonly listMap: RequestHandler = async (request, response) => {
    const actor = authenticatedUser(request)
    const reports = await this.service.listMap(
      validateRequest("query", () => parseReportMapQuery(request.query)),
      { id: actor.id, role: actor.role },
    )
    response.status(200).json({ success: true, data: reports, requestId: request.requestId })
  }

  readonly getImage: RequestHandler = async (request, response) => {
    const actor = authenticatedUser(request)
    const { reportId } = validateRequest("params", () => reportIdParamsSchema.parse(request.params))
    const image = await this.service.getImage(reportId, { id: actor.id, role: actor.role })
    response.setHeader("Content-Type", image.contentType)
    response.setHeader("Cache-Control", "private, no-store")
    response.setHeader("Content-Disposition", "inline")
    response.setHeader("X-Content-Type-Options", "nosniff")
    response.status(200).send(image.bytes)
  }

  readonly moderate: RequestHandler = async (request, response) => {
    const actor = authenticatedUser(request)
    const { reportId } = validateRequest("params", () => reportIdParamsSchema.parse(request.params))
    const report = await this.service.moderate(
      reportId,
      actor.id,
      validateRequest("body", () => moderateReportSchema.parse(request.body)),
      clientIp(request),
    )
    response.status(200).json({ success: true, data: report, requestId: request.requestId })
  }

  readonly updateOwned: RequestHandler = async (request, response) => {
    const actor = authenticatedUser(request)
    const { reportId } = validateRequest("params", () => reportIdParamsSchema.parse(request.params))
    const report = await this.service.updateOwned(
      reportId,
      actor.id,
      validateRequest("body", () => updateReportSchema.parse(request.body)),
      clientIp(request),
    )
    response.status(200).json({ success: true, data: report, requestId: request.requestId })
  }
}
