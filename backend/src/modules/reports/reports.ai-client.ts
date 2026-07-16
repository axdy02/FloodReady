import { z } from "zod"
import {
  aiEvidenceFlags,
  imageQualityValues,
  roadPassabilityValues,
  severities,
  waterLevelCategories,
  type AiEvidenceFlag,
  type ImageQualityValue,
  type RoadPassabilityValue,
  type SeverityValue,
  type WaterLevelCategoryValue,
} from "./reports.types.js"

const evidenceFlagsSchema = z.array(z.enum(aiEvidenceFlags)).max(aiEvidenceFlags.length).superRefine((value, context) => {
  if (new Set(value).size !== value.length) {
    context.addIssue({ code: "custom", message: "Duplicate evidence flag" })
  }
})

const responseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    analysisId: z.uuid(),
    status: z.literal("SUCCEEDED"),
    floodDetected: z.boolean(),
    suggestedSeverity: z.enum(severities),
    confidenceScore: z.number().min(0).max(1),
    validationScore: z.number().min(0).max(1),
    validationOutcome: z.enum(["ACCEPTED", "NEEDS_REVIEW", "REJECTED"]),
    weatherSummary: z.string().trim().min(1).max(500),
    weatherPrecipitationMm: z.number().min(0).max(5_000).nullable(),
    weatherTemperatureC: z.number().min(-100).max(100).nullable(),
    weatherScore: z.number().min(0).max(1),
    waterLevelCategory: z.enum(waterLevelCategories),
    roadPassability: z.enum(roadPassabilityValues),
    imageQuality: z.enum(imageQualityValues),
    summary: z.string().trim().min(1).max(500),
    evidenceFlags: evidenceFlagsSchema,
    needsHumanReview: z.boolean(),
    modelName: z.string().trim().min(1).max(100),
    modelVersion: z.string().trim().min(1).max(100),
    processingTimeMs: z.number().int().min(0).max(300_000),
  }).strict(),
  requestId: z.uuid(),
}).strict()

export interface AiAnalysisClientInput {
  analysisId: string
  reportId: string
  description: string
  userSeverity: SeverityValue
  latitude: number
  longitude: number
  imageBytes: Buffer
  imageMime: "image/jpeg" | "image/png" | "image/webp"
  requestId: string
}

export interface SuccessfulAiAnalysis {
  analysisId: string
  floodDetected: boolean
  suggestedSeverity: SeverityValue
  confidenceScore: number
  validationScore: number
  validationOutcome: "ACCEPTED" | "NEEDS_REVIEW" | "REJECTED"
  weatherSummary: string
  weatherPrecipitationMm: number | null
  weatherTemperatureC: number | null
  weatherScore: number
  waterLevelCategory: WaterLevelCategoryValue
  roadPassability: RoadPassabilityValue
  imageQuality: ImageQualityValue
  summary: string
  evidenceFlags: AiEvidenceFlag[]
  needsHumanReview: boolean
  modelName: string
  modelVersion: string
  processingTimeMs: number
}

export type AiAnalysisClientFailure = "FAILED" | "TIMED_OUT"

export class AiAnalysisClientError extends Error {
  override readonly name = "AiAnalysisClientError"

  constructor(
    readonly failure: AiAnalysisClientFailure,
    readonly errorCode: "AI_TIMEOUT" | "AI_UNAVAILABLE" | "AI_SERVICE_ERROR" | "AI_INVALID_RESPONSE",
  ) {
    super("AI analysis request failed")
  }
}

export class AiAnalysisClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly timeoutMs: number,
  ) {}

  async analyze(input: AiAnalysisClientInput): Promise<SuccessfulAiAnalysis> {
    const form = new FormData()
    form.set("analysisId", input.analysisId)
    form.set("reportId", input.reportId)
    form.set("mimeType", input.imageMime)
    form.set("description", input.description)
    form.set("userSeverity", input.userSeverity)
    form.set("latitude", String(input.latitude))
    form.set("longitude", String(input.longitude))
    form.set("allowedSeverityValues", JSON.stringify(severities))
    form.set("image", new Blob([Uint8Array.from(input.imageBytes)], { type: input.imageMime }), `evidence.${this.extension(input.imageMime)}`)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await fetch(`${this.baseUrl}/internal/v1/flood-analyses`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.token}`,
          "X-Request-Id": input.requestId,
        },
        body: form,
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new AiAnalysisClientError("FAILED", "AI_SERVICE_ERROR")
      }
      const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
      if (contentType !== "application/json") {
        throw new AiAnalysisClientError("FAILED", "AI_INVALID_RESPONSE")
      }
      const text = await response.text()
      if (Buffer.byteLength(text, "utf8") > 16_384) {
        throw new AiAnalysisClientError("FAILED", "AI_INVALID_RESPONSE")
      }
      let decoded: unknown
      try {
        decoded = JSON.parse(text) as unknown
      } catch {
        throw new AiAnalysisClientError("FAILED", "AI_INVALID_RESPONSE")
      }
      const result = responseSchema.safeParse(decoded)
      if (!result.success || result.data.data.analysisId !== input.analysisId) {
        throw new AiAnalysisClientError("FAILED", "AI_INVALID_RESPONSE")
      }
      const analysis = result.data.data
      return {
        analysisId: analysis.analysisId,
        floodDetected: analysis.floodDetected,
        suggestedSeverity: analysis.suggestedSeverity,
        confidenceScore: analysis.confidenceScore,
        validationScore: analysis.validationScore,
        validationOutcome: analysis.validationOutcome,
        weatherSummary: analysis.weatherSummary,
        weatherPrecipitationMm: analysis.weatherPrecipitationMm,
        weatherTemperatureC: analysis.weatherTemperatureC,
        weatherScore: analysis.weatherScore,
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
    } catch (error) {
      if (error instanceof AiAnalysisClientError) {
        throw error
      }
      if (controller.signal.aborted) {
        throw new AiAnalysisClientError("TIMED_OUT", "AI_TIMEOUT")
      }
      throw new AiAnalysisClientError("FAILED", "AI_UNAVAILABLE")
    } finally {
      clearTimeout(timeout)
    }
  }

  private extension(mime: AiAnalysisClientInput["imageMime"]): "jpg" | "png" | "webp" {
    if (mime === "image/jpeg") {
      return "jpg"
    }
    if (mime === "image/png") {
      return "png"
    }
    return "webp"
  }
}
