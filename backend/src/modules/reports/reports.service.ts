import { AppError } from "../../shared/errors/index.js"
import { createHash, randomUUID } from "node:crypto"
import { prisma } from "../../database/prisma.js"
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
import { AiAnalysisClient, AiAnalysisClientError } from "./reports.ai-client.js"
import { config } from "../../config/env.js"
import type {
  AiAnalysisDto,
  AiAnalysisRecord,
  CreateReportInput,
  ReportDraftDto,
  ReportDraftRecord,
  SubmitReportInput,
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
  SeverityValue,
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

function toAiAnalysisDto(analysis: AiAnalysisRecord | null | undefined): AiAnalysisDto | null {
  if (analysis === null || analysis === undefined) return null
  return {
    id: analysis.id,
    status: analysis.status,
    floodDetected: analysis.floodDetected,
    suggestedSeverity: analysis.suggestedSeverity,
    confidenceScore: analysis.confidenceScore,
    validationScore: analysis.validationScore,
    validationOutcome: analysis.validationOutcome,
    weatherSummary: analysis.weatherSummary,
    weatherPrecipitationMm: analysis.weatherPrecipitationMm,
    weatherTemperatureC: analysis.weatherTemperatureC,
    waterLevelCategory: analysis.waterLevelCategory,
    roadPassability: analysis.roadPassability,
    imageQuality: analysis.imageQuality,
    summary: analysis.summary,
    evidenceFlags: analysis.evidenceFlags,
    needsHumanReview: analysis.needsHumanReview,
    modelName: analysis.modelName,
    modelVersion: analysis.modelVersion,
    processingTimeMs: analysis.processingTimeMs,
  }
}

function toDto(report: ReportRecord): ReportDto {
  return {
    ...report,
    finalSeverity: report.finalSeverity ?? report.severityClaim,
    aiUsed: report.aiUsed ?? false,
    aiAnalysis: toAiAnalysisDto(report.aiAnalysis),
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
    finalSeverity: report.finalSeverity ?? report.severityClaim,
    aiUsed: report.aiUsed ?? false,
    latitude: report.latitude,
    longitude: report.longitude,
    capturedAt: report.capturedAt.toISOString(),
    submittedAt: report.submittedAt.toISOString(),
    verificationStatus: report.verificationStatus,
    incidentId: report.incidentId,
    updatedAt: report.updatedAt.toISOString(),
    canViewDetails: actor.role !== "USER" || report.reporterId === actor.id,
    aiAnalysis: report.aiAnalysis === undefined || report.aiAnalysis === null ? null : {
      status: report.aiAnalysis.status,
      floodDetected: report.aiAnalysis.floodDetected,
      suggestedSeverity: report.aiAnalysis.suggestedSeverity,
      confidenceScore: report.aiAnalysis.confidenceScore,
      validationScore: report.aiAnalysis.validationScore,
      validationOutcome: report.aiAnalysis.validationOutcome,
      needsHumanReview: report.aiAnalysis.needsHumanReview,
    },
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

function mimeForExtension(extension: ImageExtension): "image/jpeg" | "image/png" | "image/webp" {
  return mapContentType(extension)
}

function toDraftDto(draft: ReportDraftRecord): ReportDraftDto {
  return {
    draftId: draft.id,
    expiresAt: draft.expiresAt.toISOString(),
    category: draft.category,
    description: draft.description,
    severityClaim: draft.severityClaim,
    latitude: draft.latitude,
    longitude: draft.longitude,
    gpsAccuracy: draft.gpsAccuracy,
    locationSource: draft.locationSource,
    capturedAt: draft.capturedAt.toISOString(),
    analysis: {
      id: draft.aiAnalysis.id,
      status: draft.aiAnalysis.status,
      floodDetected: draft.aiAnalysis.floodDetected,
      suggestedSeverity: draft.aiAnalysis.suggestedSeverity,
      confidenceScore: draft.aiAnalysis.confidenceScore,
      waterLevelCategory: draft.aiAnalysis.waterLevelCategory,
      roadPassability: draft.aiAnalysis.roadPassability,
      imageQuality: draft.aiAnalysis.imageQuality,
      summary: draft.aiAnalysis.summary,
      evidenceFlags: draft.aiAnalysis.evidenceFlags,
      needsHumanReview: draft.aiAnalysis.needsHumanReview,
      modelName: draft.aiAnalysis.modelName,
      modelVersion: draft.aiAnalysis.modelVersion,
      processingTimeMs: draft.aiAnalysis.processingTimeMs,
      validationScore: draft.aiAnalysis.validationScore,
      validationOutcome: draft.aiAnalysis.validationOutcome,
      weatherSummary: draft.aiAnalysis.weatherSummary,
      weatherPrecipitationMm: draft.aiAnalysis.weatherPrecipitationMm,
      weatherTemperatureC: draft.aiAnalysis.weatherTemperatureC,
    },
  }
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

  async create(input: CreateReportInput, requestId: string = randomUUID()): Promise<ReportDto> {
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
    const imageMime = mimeForExtension(processed.extension)
    const imageSha256 = createHash("sha256").update(processed.bytes).digest("hex")
    const analysisId = randomUUID()
    try {
      const created = await reportsRepository.transaction(async (repository) => {
        const report = await repository.create({
          ...input,
          imageMime,
          imagePath: saved.key,
          imageSha256,
          imageSize: processed.bytes.length,
          reporterId: input.actorId,
        })
        await repository.createProcessingAnalysis(report.id, analysisId)
        await repository.createAudit({
          action: "REPORT_CREATED",
          actorId: input.actorId,
          entityId: report.id,
          ipAddress: input.ipAddress,
          metadata: { uploadSource: "WEB", verificationStatus: "PENDING_REVIEW" },
        })
        return report
      })
      const report = await reportsRepository.findById(created.id)
      if (report === null) throw new Error("Created report was not found")
      if (config.NODE_ENV !== "test") {
        queueMicrotask(() => {
          void this.processReportAnalysis({
            analysisId,
            description: created.description,
            imageBytes: processed.bytes,
            imageMime,
            latitude: created.latitude,
            longitude: created.longitude,
            reportId: created.id,
            requestId,
            userSeverity: created.severityClaim,
          })
        })
      }
      return toDto(report)
    } catch (error) {
      await this.storage.delete(saved.key)
      throw error
    }
  }

  private async processReportAnalysis(input: {
    analysisId: string
    description: string
    imageBytes: Buffer
    imageMime: "image/jpeg" | "image/png" | "image/webp"
    latitude: number
    longitude: number
    reportId: string
    requestId: string
    userSeverity: SeverityValue
  }): Promise<void> {
    const client = new AiAnalysisClient(config.AI_SERVICE_BASE_URL, config.AI_SERVICE_TOKEN, config.AI_SERVICE_TIMEOUT_MS)
    try {
      const result = await client.analyze(input)
      await prisma.$transaction([
        prisma.aiAnalysis.update({
          where: { id: input.analysisId },
          data: {
            status: "SUCCEEDED",
            floodDetected: result.floodDetected,
            suggestedSeverity: result.suggestedSeverity,
            confidenceScore: result.confidenceScore,
            validationScore: result.validationScore,
            validationOutcome: result.validationOutcome,
            weatherSummary: result.weatherSummary,
            weatherPrecipitationMm: result.weatherPrecipitationMm,
            weatherTemperatureC: result.weatherTemperatureC,
            weatherScore: result.weatherScore,
            waterLevelCategory: result.waterLevelCategory,
            roadPassability: result.roadPassability,
            imageQuality: result.imageQuality,
            summary: result.summary,
            evidenceFlags: result.evidenceFlags,
            needsHumanReview: result.needsHumanReview,
            modelName: result.modelName,
            modelVersion: result.modelVersion,
            processingTimeMs: result.processingTimeMs,
            completedAt: new Date(),
          },
        }),
        prisma.floodReport.update({
          where: { id: input.reportId },
          data: {
            aiUsed: true,
            finalSeverity: result.suggestedSeverity,
            verificationStatus: "PROVISIONAL",
          },
        }),
      ])
    } catch (error) {
      const failure = error instanceof AiAnalysisClientError ? error : new AiAnalysisClientError("FAILED", "AI_UNAVAILABLE")
      await prisma.aiAnalysis.update({
        where: { id: input.analysisId },
        data: { status: failure.failure, errorCode: failure.errorCode, completedAt: new Date() },
      })
    }
  }

  async analyze(input: CreateReportInput, requestId: string): Promise<ReportDraftDto> {
    let processed: ProcessedImage
    try {
      processed = await processImage({ bytes: input.imageBytes, clientMime: input.imageMime, maxBytes: this.limits.maxBytes, maxPixels: this.limits.maxPixels })
    } catch (error) {
      if (error instanceof ImageProcessingError) throw imageError(error)
      throw error
    }
    const saved = await this.storage.saveValidatedImage({ bytes: processed.bytes, extension: processed.extension, serverTime: input.serverTime })
    const draftId = randomUUID()
    const analysisId = randomUUID()
    const imageMime = mimeForExtension(processed.extension)
    const imageSha256 = createHash("sha256").update(processed.bytes).digest("hex")
    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.reportDraft.create({
          data: {
            id: draftId, reporterId: input.actorId, category: input.category, description: input.description,
            severityClaim: input.severityClaim, latitude: input.latitude, longitude: input.longitude,
            gpsAccuracy: input.gpsAccuracy, locationSource: input.locationSource, capturedAt: input.capturedAt,
            imagePath: saved.key, imageMime, imageSize: processed.bytes.length, imageSha256,
            expiresAt: new Date(input.serverTime.getTime() + 30 * 60 * 1000),
          },
        })
        await transaction.aiAnalysis.create({ data: { id: analysisId, draftId, status: "PROCESSING" } })
      })
    } catch (error) {
      await this.storage.delete(saved.key)
      throw error
    }
    const client = new AiAnalysisClient(config.AI_SERVICE_BASE_URL, config.AI_SERVICE_TOKEN, config.AI_SERVICE_TIMEOUT_MS)
    try {
      const result = await client.analyze({ analysisId, reportId: draftId, description: input.description, userSeverity: input.severityClaim, latitude: input.latitude, longitude: input.longitude, imageBytes: processed.bytes, imageMime, requestId })
      await prisma.aiAnalysis.update({
        where: { id: analysisId },
        data: { status: "SUCCEEDED", floodDetected: result.floodDetected, suggestedSeverity: result.suggestedSeverity,
          confidenceScore: result.confidenceScore, validationScore: result.validationScore,
          validationOutcome: result.validationOutcome, weatherSummary: result.weatherSummary,
          weatherPrecipitationMm: result.weatherPrecipitationMm, weatherTemperatureC: result.weatherTemperatureC,
          weatherScore: result.weatherScore, waterLevelCategory: result.waterLevelCategory,
          roadPassability: result.roadPassability, imageQuality: result.imageQuality, summary: result.summary,
          evidenceFlags: result.evidenceFlags, needsHumanReview: result.needsHumanReview, modelName: result.modelName,
          modelVersion: result.modelVersion, processingTimeMs: result.processingTimeMs, completedAt: new Date() },
      })
    } catch (error) {
      const failure = error instanceof AiAnalysisClientError ? error : new AiAnalysisClientError("FAILED", "AI_UNAVAILABLE")
      await prisma.aiAnalysis.update({ where: { id: analysisId }, data: { status: failure.failure, errorCode: failure.errorCode, completedAt: new Date() } })
    }
    const draft = await this.findDraft(draftId, input.actorId)
    return toDraftDto(draft)
  }

  async submitDraft(draftId: string, actorId: string, input: SubmitReportInput, ipAddress: string): Promise<ReportDto> {
    const reportId = await prisma.$transaction(async (transaction) => {
      const draft = await transaction.reportDraft.findUnique({ include: { aiAnalysis: true }, where: { id: draftId } })
      if (draft === null || draft.reporterId !== actorId) throw new AppError(404, "NOT_FOUND", "Resource not found")
      if (draft.expiresAt <= new Date() || draft.aiAnalysis === null || draft.aiAnalysis.status === "PROCESSING") throw new AppError(409, "DRAFT_NOT_READY", "Draft is not ready")
      const created = await transaction.floodReport.create({
        data: { id: draft.id, reporterId: draft.reporterId, category: draft.category, description: draft.description,
          severityClaim: draft.severityClaim, finalSeverity: input.finalSeverity, aiUsed: true, latitude: draft.latitude,
          longitude: draft.longitude, gpsAccuracy: draft.gpsAccuracy, locationSource: draft.locationSource,
          capturedAt: draft.capturedAt, imagePath: draft.imagePath, imageMime: draft.imageMime, imageSize: draft.imageSize,
          imageSha256: draft.imageSha256, uploadSource: "WEB", verificationStatus: "SUBMITTED" },
        include: { aiAnalysis: true },
      })
      await transaction.aiAnalysis.update({ where: { id: draft.aiAnalysis.id }, data: { draftId: null, reportId: created.id } })
      await transaction.reportDraft.delete({ where: { id: draft.id } })
      await transaction.auditLog.create({ data: { action: "REPORT_CREATED", actorId, entityType: "FLOOD_REPORT", entityId: created.id, ipAddress, metadata: { aiUsed: true, finalSeverity: input.finalSeverity } } })
      return created.id
    })
    const report = await reportsRepository.findById(reportId)
    if (report === null) throw new Error("Created report was not found")
    return toDto(report)
  }

  async retryAnalysis(reportId: string, actorId: string, requestId: string): Promise<ReportDto> {
    const report = await reportsRepository.findById(reportId)
    if (report === null || report.reporterId !== actorId) throw new AppError(404, "NOT_FOUND", "Resource not found")
    const analysis = report.aiAnalysis
    if (analysis === undefined || analysis === null || analysis.status === "PROCESSING" || analysis.status === "SUCCEEDED") {
      throw new AppError(409, "AI_ANALYSIS_NOT_RETRYABLE", "AI analysis cannot be retried")
    }
    const imageRecord = await reportsRepository.findImageById(reportId)
    if (imageRecord === null || imageRecord.reporterId !== actorId) throw new AppError(404, "NOT_FOUND", "Resource not found")
    let image: Awaited<ReturnType<ImageStorage["read"]>>
    try {
      image = await this.storage.read(imageRecord.imagePath)
    } catch (error) {
      if (error instanceof ImageStorageError) throw new AppError(409, "AI_ANALYSIS_NOT_RETRYABLE", "Stored evidence is unavailable")
      throw error
    }
    const imageMime = mimeForExtension(image.extension)
    await prisma.aiAnalysis.update({
      where: { id: analysis.id },
      data: { status: "PROCESSING", errorCode: null, completedAt: null, startedAt: new Date() },
    })
    queueMicrotask(() => {
      void this.processReportAnalysis({
        analysisId: analysis.id,
        description: report.description,
        imageBytes: image.bytes,
        imageMime,
        latitude: report.latitude,
        longitude: report.longitude,
        reportId,
        requestId,
        userSeverity: report.severityClaim,
      })
    })
    const updated = await reportsRepository.findById(reportId)
    if (updated === null) throw new Error("Retried report was not found")
    return toDto(updated)
  }

  private async findDraft(draftId: string, actorId: string): Promise<ReportDraftRecord> {
    const draft = await prisma.reportDraft.findUnique({ include: { aiAnalysis: true }, where: { id: draftId } })
    if (draft === null || draft.reporterId !== actorId || draft.aiAnalysis === null) throw new AppError(404, "NOT_FOUND", "Resource not found")
    const analysis = draft.aiAnalysis
    const evidenceFlags = Array.isArray(analysis.evidenceFlags) && analysis.evidenceFlags.every((flag) => typeof flag === "string") ? analysis.evidenceFlags : []
    return {
      id: draft.id, reporterId: draft.reporterId, category: draft.category, description: draft.description,
      severityClaim: draft.severityClaim, latitude: Number(draft.latitude), longitude: Number(draft.longitude),
      gpsAccuracy: draft.gpsAccuracy === null ? null : Number(draft.gpsAccuracy), locationSource: draft.locationSource,
      capturedAt: draft.capturedAt, imagePath: draft.imagePath, imageMime: draft.imageMime as "image/jpeg" | "image/png" | "image/webp",
      imageSize: draft.imageSize, imageSha256: draft.imageSha256, expiresAt: draft.expiresAt, createdAt: draft.createdAt, updatedAt: draft.updatedAt,
      aiAnalysis: { id: analysis.id, draftId: analysis.draftId, reportId: analysis.reportId, status: analysis.status,
        floodDetected: analysis.floodDetected, suggestedSeverity: analysis.suggestedSeverity,
        confidenceScore: analysis.confidenceScore === null ? null : Number(analysis.confidenceScore),
        validationScore: analysis.validationScore === null ? null : Number(analysis.validationScore),
        validationOutcome: analysis.validationOutcome as ReportDraftRecord["aiAnalysis"]["validationOutcome"],
        weatherSummary: analysis.weatherSummary,
        weatherPrecipitationMm: analysis.weatherPrecipitationMm === null ? null : Number(analysis.weatherPrecipitationMm),
        weatherTemperatureC: analysis.weatherTemperatureC === null ? null : Number(analysis.weatherTemperatureC),
        waterLevelCategory: analysis.waterLevelCategory,
        roadPassability: analysis.roadPassability, imageQuality: analysis.imageQuality, summary: analysis.summary,
        evidenceFlags: evidenceFlags as ReportDraftRecord["aiAnalysis"]["evidenceFlags"], needsHumanReview: analysis.needsHumanReview,
        modelName: analysis.modelName, modelVersion: analysis.modelVersion, processingTimeMs: analysis.processingTimeMs,
        errorCode: analysis.errorCode, startedAt: analysis.startedAt, completedAt: analysis.completedAt, createdAt: analysis.createdAt, updatedAt: analysis.updatedAt },
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
