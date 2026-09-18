import { Prisma } from "../../generated/prisma/client.js"
import { prisma } from "../../database/prisma.js"
import type {
  AiAnalysisRecord,
  CreateReportMetadata,
  ReportRecord,
  ReportRepositoryListInput,
  UpdateReportInput,
  VerificationStatusValue,
} from "./reports.types.js"

interface CreateReportRowInput extends CreateReportMetadata {
  imagePath: string
  imageMime: "image/jpeg" | "image/png" | "image/webp"
  imageSha256: string
  imageSize: number
  reporterId: string
}

interface AuditInput {
  action: "REPORT_CREATED" | "REPORT_UPDATED" | "REPORT_STATUS_CHANGED"
  actorId: string
  entityId: string
  ipAddress: string
  metadata: Prisma.InputJsonValue
}

const reportSelect = {
  aiAnalysis: true,
  aiUsed: true,
  capturedAt: true,
  category: true,
  createdAt: true,
  description: true,
  gpsAccuracy: true,
  id: true,
  incidentId: true,
  latitude: true,
  locationSource: true,
  longitude: true,
  reporterId: true,
  severityClaim: true,
  finalSeverity: true,
  submittedAt: true,
  updatedAt: true,
  uploadSource: true,
  verificationStatus: true,
} satisfies Prisma.FloodReportSelect

type SelectedReport = Prisma.FloodReportGetPayload<{ select: typeof reportSelect }>

const reportColumns = Prisma.sql`
  r."id",
  r."reporter_id" AS "reporterId",
  r."category",
  r."description",
  r."severity_claim" AS "severityClaim",
  r."final_severity" AS "finalSeverity",
  r."ai_used" AS "aiUsed",
  r."latitude"::double precision AS "latitude",
  r."longitude"::double precision AS "longitude",
  r."gps_accuracy"::double precision AS "gpsAccuracy",
  r."location_source" AS "locationSource",
  r."captured_at" AS "capturedAt",
  r."submitted_at" AS "submittedAt",
  r."upload_source" AS "uploadSource",
  r."verification_status" AS "verificationStatus",
  r."incident_id" AS "incidentId",
  r."created_at" AS "createdAt",
  r."updated_at" AS "updatedAt"
`

function decimalToNumber(value: Prisma.Decimal): number {
  const number = value.toNumber()
  if (!Number.isFinite(number)) {
    throw new Error("Invalid database decimal")
  }
  return number
}

function mapSelectedReport(report: SelectedReport): ReportRecord {
  return {
    ...report,
    gpsAccuracy: report.gpsAccuracy === null ? null : decimalToNumber(report.gpsAccuracy),
    latitude: decimalToNumber(report.latitude),
    longitude: decimalToNumber(report.longitude),
    aiAnalysis: report.aiAnalysis === null ? null : mapAiAnalysis(report.aiAnalysis),
  }
}

function mapAiAnalysis(analysis: NonNullable<SelectedReport["aiAnalysis"]>): AiAnalysisRecord {
  const flags = Array.isArray(analysis.evidenceFlags) && analysis.evidenceFlags.every((flag) => typeof flag === "string")
    ? analysis.evidenceFlags
    : []
  return {
    id: analysis.id,
    draftId: analysis.draftId,
    reportId: analysis.reportId,
    status: analysis.status,
    floodDetected: analysis.floodDetected,
    suggestedSeverity: analysis.suggestedSeverity,
    confidenceScore: analysis.confidenceScore === null ? null : decimalToNumber(analysis.confidenceScore),
    validationScore: analysis.validationScore === null ? null : decimalToNumber(analysis.validationScore),
    validationOutcome: analysis.validationOutcome as AiAnalysisRecord["validationOutcome"],
    weatherSummary: analysis.weatherSummary,
    weatherPrecipitationMm: analysis.weatherPrecipitationMm === null ? null : decimalToNumber(analysis.weatherPrecipitationMm),
    weatherTemperatureC: analysis.weatherTemperatureC === null ? null : decimalToNumber(analysis.weatherTemperatureC),
    waterLevelCategory: analysis.waterLevelCategory,
    roadPassability: analysis.roadPassability,
    imageQuality: analysis.imageQuality,
    summary: analysis.summary,
    evidenceFlags: flags as AiAnalysisRecord["evidenceFlags"],
    needsHumanReview: analysis.needsHumanReview,
    modelName: analysis.modelName,
    modelVersion: analysis.modelVersion,
    processingTimeMs: analysis.processingTimeMs,
    errorCode: analysis.errorCode,
    startedAt: analysis.startedAt,
    completedAt: analysis.completedAt,
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
  }
}

function listConditions(input: ReportRepositoryListInput, includeKeyset: boolean): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = []
  const { query } = input
  if (input.reporterId !== null) {
    conditions.push(Prisma.sql`r."reporter_id" = ${input.reporterId}::uuid`)
  }
  if (query.category !== null) {
    conditions.push(Prisma.sql`r."category" = ${query.category}::"ReportCategory"`)
  }
  if (query.status !== null) {
    conditions.push(Prisma.sql`r."verification_status" = ${query.status}::"VerificationStatus"`)
  }
  if (input.excludeRejected) {
    conditions.push(Prisma.sql`r."verification_status" <> 'REJECTED'::"VerificationStatus"`)
  }
  if (query.severity !== null) {
    conditions.push(Prisma.sql`r."severity_claim" = ${query.severity}::"Severity"`)
  }
  if (query.from !== null) {
    conditions.push(Prisma.sql`r."submitted_at" >= ${query.from}::timestamptz(3)`)
  }
  if (query.to !== null) {
    conditions.push(Prisma.sql`r."submitted_at" <= ${query.to}::timestamptz(3)`)
  }
  if (query.bbox !== null) {
    conditions.push(Prisma.sql`r."location" && ST_MakeEnvelope(
      ${query.bbox.west}::double precision,
      ${query.bbox.south}::double precision,
      ${query.bbox.east}::double precision,
      ${query.bbox.north}::double precision,
      4326
    )::geography`)
  }
  if (includeKeyset && input.keyset !== null && query.sort === "asc") {
    conditions.push(Prisma.sql`(r."submitted_at", r."id") > (${input.keyset.timestamp}::timestamptz(3), ${input.keyset.id}::uuid)`)
  }
  if (includeKeyset && input.keyset !== null && query.sort === "desc") {
    conditions.push(Prisma.sql`(r."submitted_at", r."id") < (${input.keyset.timestamp}::timestamptz(3), ${input.keyset.id}::uuid)`)
  }
  return conditions
}

export class ReportTransactionRepository {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async create(input: CreateReportRowInput): Promise<ReportRecord> {
    const report = await this.transaction.floodReport.create({
      data: {
        capturedAt: input.capturedAt,
        category: input.category,
        description: input.description,
        gpsAccuracy: input.gpsAccuracy,
        imagePath: input.imagePath,
        imageMime: input.imageMime,
        imageSha256: input.imageSha256,
        imageSize: input.imageSize,
        incidentId: null,
        latitude: input.latitude,
        locationSource: input.locationSource,
        longitude: input.longitude,
        reporterId: input.reporterId,
        severityClaim: input.severityClaim,
        finalSeverity: input.severityClaim,
        aiUsed: false,
        uploadSource: "WEB",
        verificationStatus: "PENDING_REVIEW",
      },
      select: reportSelect,
    })
    return mapSelectedReport(report)
  }

  async createProcessingAnalysis(reportId: string, analysisId: string): Promise<void> {
    await this.transaction.aiAnalysis.create({
      data: { id: analysisId, reportId, status: "PROCESSING" },
    })
  }

  async lockOwned(reportId: string, reporterId: string): Promise<ReportRecord | null> {
    const rows = await this.transaction.$queryRaw<ReportRecord[]>`
      SELECT ${reportColumns}
      FROM "flood_reports" r
      WHERE r."id" = ${reportId}::uuid AND r."reporter_id" = ${reporterId}::uuid
      FOR UPDATE
    `
    return rows[0] === undefined ? null : { ...rows[0], aiAnalysis: null }
  }

  async lockById(reportId: string): Promise<ReportRecord | null> {
    const rows = await this.transaction.$queryRaw<ReportRecord[]>`
      SELECT ${reportColumns}
      FROM "flood_reports" r
      WHERE r."id" = ${reportId}::uuid
      FOR UPDATE
    `
    return rows[0] === undefined ? null : { ...rows[0], aiAnalysis: null }
  }

  async update(reportId: string, data: UpdateReportInput): Promise<ReportRecord> {
    const report = await this.transaction.floodReport.update({
      data: {
        ...(data.category === undefined ? {} : { category: data.category }),
        ...(data.description === undefined ? {} : { description: data.description }),
        ...(data.severityClaim === undefined ? {} : { severityClaim: data.severityClaim }),
      },
      select: reportSelect,
      where: { id: reportId },
    })
    return mapSelectedReport(report)
  }

  async updateStatus(reportId: string, status: VerificationStatusValue): Promise<ReportRecord> {
    const report = await this.transaction.floodReport.update({
      data: { verificationStatus: status },
      select: reportSelect,
      where: { id: reportId },
    })
    return mapSelectedReport(report)
  }

  async createAudit(input: AuditInput): Promise<void> {
    await this.transaction.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId,
        entityId: input.entityId,
        entityType: "FLOOD_REPORT",
        ipAddress: input.ipAddress,
        metadata: input.metadata,
      },
    })
  }
}

export const reportsRepository = {
  async findById(reportId: string): Promise<ReportRecord | null> {
    const report = await prisma.floodReport.findUnique({ select: reportSelect, where: { id: reportId } })
    return report === null ? null : mapSelectedReport(report)
  },

  async list(input: ReportRepositoryListInput): Promise<ReportRecord[]> {
    const conditions = listConditions(input, true)
    const where = conditions.length === 0 ? Prisma.sql`TRUE` : Prisma.join(conditions, " AND ")
    const order = input.query.sort === "asc"
      ? Prisma.sql`r."submitted_at" ASC, r."id" ASC`
      : Prisma.sql`r."submitted_at" DESC, r."id" DESC`
    const rows = await prisma.$queryRaw<ReportRecord[]>`
      SELECT ${reportColumns}
      FROM "flood_reports" r
      WHERE ${where}
      ORDER BY ${order}
      LIMIT ${input.query.limit + 1}
    `
    if (rows.length === 0) return []
    const analyses = await prisma.aiAnalysis.findMany({ where: { reportId: { in: rows.map((row) => row.id) } } })
    const analysisByReportId = new Map(analyses.flatMap((analysis) => analysis.reportId === null ? [] : [[analysis.reportId, mapAiAnalysis(analysis)] as const]))
    return rows.map((row) => ({ ...row, aiAnalysis: analysisByReportId.get(row.id) ?? null }))
  },

  async count(input: ReportRepositoryListInput): Promise<number> {
    const conditions = listConditions(input, false)
    const where = conditions.length === 0 ? Prisma.sql`TRUE` : Prisma.join(conditions, " AND ")
    const rows = await prisma.$queryRaw<Array<{ totalCount: number }>>`
      SELECT COUNT(*)::integer AS "totalCount"
      FROM "flood_reports" r
      WHERE ${where}
    `
    const totalCount = rows[0]?.totalCount
    if (typeof totalCount !== "number" || totalCount < 0) {
      throw new Error("Invalid report count")
    }
    return totalCount
  },

  async findImageById(reportId: string): Promise<{ imagePath: string; reporterId: string } | null> {
    return prisma.floodReport.findUnique({
      select: { imagePath: true, reporterId: true },
      where: { id: reportId },
    })
  },

  transaction<T>(operation: (repository: ReportTransactionRepository) => Promise<T>): Promise<T> {
    return prisma.$transaction((transaction) => operation(new ReportTransactionRepository(transaction)))
  },
}
