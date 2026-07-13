import { AppError } from "../../shared/errors/index.js"
import {
  CursorValidationError,
  encodeCursor,
  hashFilters,
  validateCursor,
} from "../../shared/validation/cursor.js"
import {
  ImageProcessingError,
  processImage,
  type ProcessedImage,
} from "../../shared/storage/image-processor.js"
import {
  ImageStorageError,
  type ImageExtension,
  type ImageStorage,
} from "../../shared/storage/image-storage.js"
import { reportsRepository, type ReportTransactionRepository } from "./reports.repository.js"
import type {
  CreateReportInput,
  ModerateReportInput,
  OwnReportListFilters,
  ReportDto,
  ReportKeyset,
  ReportListFilters,
  ReportListQuery,
  ReportMapDto,
  ReportMapPage,
  ReportPage,
  ReportRecord,
  UpdateReportInput,
  VerificationStatusValue,
} from "./reports.types.js"

export type ReportActorRole = "USER" | "MODERATOR" | "ADMIN"

interface ReportActor {
  id: string
  role: ReportActorRole
}

interface ImageLimits {
  maxBytes: number
  maxPixels: number
}

const transitions: Record<VerificationStatusValue, readonly VerificationStatusValue[]> = {
  DISPUTED: ["PENDING_REVIEW", "VERIFIED", "REJECTED"],
  PENDING_REVIEW: ["PROVISIONAL", "VERIFIED", "DISPUTED", "REJECTED"],
  PROVISIONAL: ["VERIFIED", "DISPUTED", "REJECTED", "RESOLVED", "STALE"],
  REJECTED: ["PENDING_REVIEW"],
  RESOLVED: ["VERIFIED", "STALE"],
  STALE: ["PENDING_REVIEW", "VERIFIED", "RESOLVED"],
  SUBMITTED: ["PENDING_REVIEW", "PROVISIONAL", "VERIFIED", "DISPUTED", "REJECTED"],
  VERIFIED: ["DISPUTED", "RESOLVED", "STALE"],
}

function toDto(report: ReportRecord): ReportDto {
  return {
    ...report,
    capturedAt: report.capturedAt.toISOString(),
    createdAt: report.createdAt.toISOString(),
    submittedAt: report.submittedAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  }
}

function toMapDto(report: ReportRecord, actor: ReportActor): ReportMapDto {
  return {
    id: report.id,
    category: report.category,
    severityClaim: report.severityClaim,
    latitude: report.latitude,
    longitude: report.longitude,
    capturedAt: report.capturedAt.toISOString(),
    submittedAt: report.submittedAt.toISOString(),
    verificationStatus: report.verificationStatus,
    incidentId: report.incidentId,
    updatedAt: report.updatedAt.toISOString(),
    canViewDetails: actor.role !== "USER" || report.reporterId === actor.id,
  }
}

function validationCursorError(): AppError {
  return new AppError(400, "VALIDATION_ERROR", "Invalid request", [
    { path: "query.cursor", message: "Invalid value" },
  ])
}

function imageError(error: ImageProcessingError): AppError {
  if (error.failure === "FILE_TOO_LARGE") {
    return new AppError(413, "FILE_TOO_LARGE", "Uploaded file is too large")
  }
  if (error.failure === "UNSUPPORTED_MEDIA_TYPE") {
    return new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Unsupported media type")
  }
  return new AppError(422, "INVALID_IMAGE", "Invalid image")
}

function reportFilters(query: ReportListQuery): ReportListFilters {
  return {
    bbox: query.bbox,
    category: query.category,
    from: query.from?.toISOString() ?? null,
    severity: query.severity,
    status: query.status,
    to: query.to?.toISOString() ?? null,
  }
}

function ownReportFilters(query: ReportListQuery, reporterId: string): OwnReportListFilters {
  return {
    bbox: query.bbox,
    category: query.category,
    from: query.from?.toISOString() ?? null,
    reporterId,
    severity: query.severity,
    status: query.status,
    to: query.to?.toISOString() ?? null,
  }
}

function mapContentType(extension: ImageExtension): "image/jpeg" | "image/png" | "image/webp" {
  if (extension === "jpg") {
    return "image/jpeg"
  }
  if (extension === "png") {
    return "image/png"
  }
  return "image/webp"
}

function changedReportFields(current: ReportRecord, input: UpdateReportInput): string[] {
  const fields: string[] = []
  if (input.category !== undefined && input.category !== current.category) {
    fields.push("category")
  }
  if (input.description !== undefined && input.description !== current.description) {
    fields.push("description")
  }
  if (input.severityClaim !== undefined && input.severityClaim !== current.severityClaim) {
    fields.push("severityClaim")
  }
  return fields.sort()
}

function changedReportData(input: UpdateReportInput, fields: readonly string[]): UpdateReportInput {
  const data: UpdateReportInput = {}
  if (fields.includes("category") && input.category !== undefined) {
    data.category = input.category
  }
  if (fields.includes("description") && input.description !== undefined) {
    data.description = input.description
  }
  if (fields.includes("severityClaim") && input.severityClaim !== undefined) {
    data.severityClaim = input.severityClaim
  }
  return data
}

export class ReportsService {
  constructor(
    private readonly storage: ImageStorage,
    private readonly limits: ImageLimits,
  ) {}

  async create(input: CreateReportInput): Promise<ReportDto> {
    let processed: ProcessedImage
    try {
      processed = await processImage({
        bytes: input.imageBytes,
        clientMime: input.imageMime,
        maxBytes: this.limits.maxBytes,
        maxPixels: this.limits.maxPixels,
      })
    } catch (error) {
      if (error instanceof ImageProcessingError) {
        throw imageError(error)
      }
      throw error
    }
    const saved = await this.storage.saveValidatedImage({
      bytes: processed.bytes,
      extension: processed.extension,
      serverTime: input.serverTime,
    })
    try {
      const report = await reportsRepository.transaction(async (repository) => {
        const created = await repository.create({ ...input, imagePath: saved.key, reporterId: input.actorId })
        await repository.createAudit({
          action: "REPORT_CREATED",
          actorId: input.actorId,
          entityId: created.id,
          ipAddress: input.ipAddress,
          metadata: { uploadSource: "WEB", verificationStatus: "SUBMITTED" },
        })
        return created
      })
      return toDto(report)
    } catch (error) {
      await this.storage.delete(saved.key)
      throw error
    }
  }

  async list(query: ReportListQuery, reporterId: string | null): Promise<ReportPage> {
    const resource = reporterId === null ? "reports" : "ownReports"
    const filters = reporterId === null ? reportFilters(query) : ownReportFilters(query, reporterId)
    let keyset: ReportKeyset | null = null
    if (query.cursor !== null) {
      try {
        const cursor = validateCursor(query.cursor, resource, query.sort, filters)
        keyset = { id: cursor.id, timestamp: new Date(cursor.timestamp) }
      } catch (error) {
        if (error instanceof CursorValidationError) {
          throw validationCursorError()
        }
        throw error
      }
    }
    const listInput = { excludeRejected: false, keyset, query, reporterId }
    const [rows, totalCount] = await Promise.all([
      reportsRepository.list(listInput),
      reportsRepository.count(listInput),
    ])
    const hasMore = rows.length > query.limit
    const returned = rows.slice(0, query.limit)
    const last = hasMore ? returned.at(-1) : undefined
    const nextCursor = last === undefined ? null : encodeCursor({
      filterHash: hashFilters(filters),
      id: last.id,
      resource,
      sort: query.sort,
      timestamp: last.submittedAt.toISOString(),
      v: 1,
    })
    return {
      items: returned.map(toDto),
      totalCount,
      pagination: { hasMore, limit: query.limit, nextCursor },
    }
  }

  async listMap(query: ReportListQuery, actor: ReportActor): Promise<ReportMapPage> {
    const filters = reportFilters(query)
    let keyset: ReportKeyset | null = null
    if (query.cursor !== null) {
      try {
        const cursor = validateCursor(query.cursor, "reportMap", query.sort, filters, actor.id)
        keyset = { id: cursor.id, timestamp: new Date(cursor.timestamp) }
      } catch (error) {
        if (error instanceof CursorValidationError) {
          throw validationCursorError()
        }
        throw error
      }
    }
    const listInput = { excludeRejected: true, keyset, query, reporterId: null }
    const [rows, totalCount] = await Promise.all([
      reportsRepository.list(listInput),
      reportsRepository.count(listInput),
    ])
    const hasMore = rows.length > query.limit
    const returned = rows.slice(0, query.limit)
    const last = hasMore ? returned.at(-1) : undefined
    const nextCursor = last === undefined ? null : encodeCursor({
      actorId: actor.id,
      filterHash: hashFilters(filters),
      id: last.id,
      resource: "reportMap",
      sort: query.sort,
      timestamp: last.submittedAt.toISOString(),
      v: 1,
    })
    return {
      items: returned.map((report) => toMapDto(report, actor)),
      totalCount,
      pagination: { hasMore, limit: query.limit, nextCursor },
    }
  }

  async get(reportId: string, actor: ReportActor): Promise<ReportDto> {
    const report = await reportsRepository.findById(reportId)
    if (report === null || actor.role === "USER" && report.reporterId !== actor.id) {
      throw new AppError(404, "NOT_FOUND", "Resource not found")
    }
    return toDto(report)
  }

  async getImage(
    reportId: string,
    actor: ReportActor,
  ): Promise<{ bytes: Buffer; contentType: "image/jpeg" | "image/png" | "image/webp" }> {
    const report = await reportsRepository.findImageById(reportId)
    if (report === null || actor.role === "USER" && report.reporterId !== actor.id) {
      throw new AppError(404, "NOT_FOUND", "Resource not found")
    }
    try {
      const image = await this.storage.read(report.imagePath)
      return { bytes: image.bytes, contentType: mapContentType(image.extension) }
    } catch (error) {
      if (error instanceof ImageStorageError) {
        throw new AppError(404, "NOT_FOUND", "Resource not found")
      }
      throw error
    }
  }

  async updateOwned(
    reportId: string,
    actorId: string,
    input: UpdateReportInput,
    ipAddress: string,
  ): Promise<ReportDto> {
    const report = await reportsRepository.transaction(async (repository) => {
      const current = await repository.lockOwned(reportId, actorId)
      if (current === null) {
        throw new AppError(404, "NOT_FOUND", "Resource not found")
      }
      if (current.verificationStatus !== "SUBMITTED" && current.verificationStatus !== "PENDING_REVIEW") {
        throw new AppError(409, "REPORT_NOT_EDITABLE", "Report cannot be edited")
      }
      const fields = changedReportFields(current, input)
      if (fields.length === 0) {
        return current
      }
      const updated = await repository.update(reportId, changedReportData(input, fields))
      await repository.createAudit({
        action: "REPORT_UPDATED",
        actorId,
        entityId: reportId,
        ipAddress,
        metadata: { changedFields: fields },
      })
      return updated
    })
    return toDto(report)
  }

  async moderate(
    reportId: string,
    actorId: string,
    input: ModerateReportInput,
    ipAddress: string,
  ): Promise<ReportDto> {
    const report = await reportsRepository.transaction(async (repository) =>
      this.moderateInTransaction(repository, reportId, actorId, input, ipAddress))
    return toDto(report)
  }

  private async moderateInTransaction(
    repository: ReportTransactionRepository,
    reportId: string,
    actorId: string,
    input: ModerateReportInput,
    ipAddress: string,
  ): Promise<ReportRecord> {
    const current = await repository.lockById(reportId)
    if (current === null) {
      throw new AppError(404, "NOT_FOUND", "Resource not found")
    }
    if (!transitions[current.verificationStatus].includes(input.status)) {
      throw new AppError(400, "INVALID_STATE_TRANSITION", "Invalid state transition")
    }
    const updated = await repository.updateStatus(reportId, input.status)
    const metadata = input.reasonCode === null
      ? { previousStatus: current.verificationStatus, newStatus: input.status }
      : { previousStatus: current.verificationStatus, newStatus: input.status, reasonCode: input.reasonCode }
    await repository.createAudit({
      action: "REPORT_STATUS_CHANGED",
      actorId,
      entityId: reportId,
      ipAddress,
      metadata,
    })
    return updated
  }
}
