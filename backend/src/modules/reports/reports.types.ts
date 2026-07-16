import type { TotalCountPage, SortDirection, BoundingBox } from "../../shared/types/pagination.js"

export const reportCategories = [
  "ROAD_WATERLOGGING",
  "FLOODED_ROAD",
  "CLOGGED_DRAIN",
  "OVERFLOWING_DRAIN",
  "OPEN_MANHOLE",
  "FALLEN_TREE",
  "STRANDED_VEHICLE",
  "UNDERPASS_FLOODING",
  "OTHER",
] as const

export const severities = ["UNKNOWN", "MINOR", "MODERATE", "SEVERE", "IMPASSABLE"] as const

export const verificationStatuses = [
  "SUBMITTED",
  "PENDING_REVIEW",
  "PROVISIONAL",
  "VERIFIED",
  "DISPUTED",
  "REJECTED",
  "RESOLVED",
  "STALE",
] as const

export const locationSources = ["DEVICE_GPS", "MANUAL"] as const

export const aiAnalysisStatuses = ["PROCESSING", "SUCCEEDED", "FAILED", "TIMED_OUT"] as const

export const waterLevelCategories = ["NONE", "ANKLE_LEVEL", "KNEE_LEVEL", "WAIST_LEVEL", "ABOVE_WAIST", "UNKNOWN"] as const

export const roadPassabilityValues = ["PASSABLE", "CAUTION", "UNSAFE", "IMPASSABLE", "UNKNOWN"] as const

export const imageQualityValues = ["GOOD", "FAIR", "POOR", "UNUSABLE"] as const

export const aiEvidenceFlags = [
  "ROAD_SURFACE_SUBMERGED",
  "VEHICLE_WHEEL_PARTIALLY_SUBMERGED",
  "WATER_NEAR_BUILDINGS",
  "FAST_MOVING_WATER",
  "PEOPLE_IN_WATER",
  "LOW_VISIBILITY",
  "IMAGE_OBSTRUCTED",
  "NO_FLOOD_VISIBLE",
] as const

export const moderationReasonCodes = [
  "INSUFFICIENT_EVIDENCE",
  "INVALID_LOCATION",
  "DUPLICATE_REPORT",
  "UNSUPPORTED_CONTENT",
  "SAFETY_RISK",
  "ISSUE_RESOLVED",
  "OUTDATED_INFORMATION",
  "OTHER_REVIEWED",
] as const

export type ReportCategoryValue = (typeof reportCategories)[number]
export type SeverityValue = (typeof severities)[number]
export type VerificationStatusValue = (typeof verificationStatuses)[number]
export type LocationSourceValue = (typeof locationSources)[number]
export type AiAnalysisStatusValue = (typeof aiAnalysisStatuses)[number]
export type WaterLevelCategoryValue = (typeof waterLevelCategories)[number]
export type RoadPassabilityValue = (typeof roadPassabilityValues)[number]
export type ImageQualityValue = (typeof imageQualityValues)[number]
export type AiEvidenceFlag = (typeof aiEvidenceFlags)[number]
export type ModerationReasonCode = (typeof moderationReasonCodes)[number]

export interface AiAnalysisDto {
  id: string
  status: AiAnalysisStatusValue
  floodDetected: boolean | null
  suggestedSeverity: SeverityValue | null
  confidenceScore: number | null
  waterLevelCategory: WaterLevelCategoryValue | null
  roadPassability: RoadPassabilityValue | null
  imageQuality: ImageQualityValue | null
  summary: string | null
  evidenceFlags: AiEvidenceFlag[]
  needsHumanReview: boolean | null
  modelName: string | null
  modelVersion: string | null
  processingTimeMs: number | null
  validationScore: number | null
  validationOutcome: "ACCEPTED" | "NEEDS_REVIEW" | "REJECTED" | null
  weatherSummary: string | null
  weatherPrecipitationMm: number | null
  weatherTemperatureC: number | null
}

export interface AiAnalysisRecord extends AiAnalysisDto {
  draftId: string | null
  reportId: string | null
  errorCode: string | null
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ReportDto {
  id: string
  reporterId: string
  category: ReportCategoryValue
  description: string
  severityClaim: SeverityValue
  finalSeverity: SeverityValue
  aiUsed: boolean
  latitude: number
  longitude: number
  gpsAccuracy: number | null
  locationSource: LocationSourceValue
  capturedAt: string
  submittedAt: string
  uploadSource: string
  verificationStatus: VerificationStatusValue
  incidentId: string | null
  createdAt: string
  updatedAt: string
  aiAnalysis: AiAnalysisDto | null
}

export interface ReportRecord {
  id: string
  reporterId: string
  category: ReportCategoryValue
  description: string
  severityClaim: SeverityValue
  finalSeverity: SeverityValue
  aiUsed: boolean
  latitude: number
  longitude: number
  gpsAccuracy: number | null
  locationSource: LocationSourceValue
  capturedAt: Date
  submittedAt: Date
  uploadSource: string
  verificationStatus: VerificationStatusValue
  incidentId: string | null
  createdAt: Date
  updatedAt: Date
  aiAnalysis?: AiAnalysisRecord | null
}

export interface StoredImageMetadata {
  imagePath: string
  imageMime: "image/jpeg" | "image/png" | "image/webp"
  imageSize: number
  imageSha256: string
}

export interface ReportDraftRecord extends CreateReportMetadata, StoredImageMetadata {
  id: string
  reporterId: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
  aiAnalysis: AiAnalysisRecord
}

export interface ReportDraftDto {
  draftId: string
  expiresAt: string
  category: ReportCategoryValue
  description: string
  severityClaim: SeverityValue
  latitude: number
  longitude: number
  gpsAccuracy: number | null
  locationSource: LocationSourceValue
  capturedAt: string
  analysis: AiAnalysisDto
}

export interface SubmitReportInput {
  finalSeverity: SeverityValue
}

export interface CreateReportMetadata {
  category: ReportCategoryValue
  description: string
  severityClaim: SeverityValue
  latitude: number
  longitude: number
  gpsAccuracy: number | null
  locationSource: LocationSourceValue
  capturedAt: Date
}

export interface CreateReportInput extends CreateReportMetadata {
  actorId: string
  imageBytes: Buffer
  imageMime: string
  ipAddress: string
  serverTime: Date
}

export interface ReportListQuery {
  bbox: BoundingBox | null
  category: ReportCategoryValue | null
  cursor: string | null
  from: Date | null
  limit: number
  severity: SeverityValue | null
  sort: SortDirection
  status: VerificationStatusValue | null
  to: Date | null
}

export interface ReportListFilters {
  bbox: BoundingBox | null
  category: ReportCategoryValue | null
  from: string | null
  severity: SeverityValue | null
  status: VerificationStatusValue | null
  to: string | null
}

export interface OwnReportListFilters extends ReportListFilters {
  reporterId: string
}

export interface ReportKeyset {
  id: string
  timestamp: Date
}

export interface ReportRepositoryListInput {
  excludeRejected: boolean
  keyset: ReportKeyset | null
  query: ReportListQuery
  reporterId: string | null
}

export type ReportPage = TotalCountPage<ReportDto>

export interface ReportMapDto {
  id: string
  category: ReportCategoryValue
  severityClaim: SeverityValue
  finalSeverity: SeverityValue
  aiUsed: boolean
  latitude: number
  longitude: number
  capturedAt: string
  submittedAt: string
  verificationStatus: VerificationStatusValue
  incidentId: string | null
  updatedAt: string
  canViewDetails: boolean
  aiAnalysis: Pick<AiAnalysisDto, "status" | "floodDetected" | "suggestedSeverity" | "confidenceScore" | "validationScore" | "validationOutcome" | "needsHumanReview"> | null
}

export type ReportMapPage = TotalCountPage<ReportMapDto>

export interface UpdateReportInput {
  category?: ReportCategoryValue | undefined
  description?: string | undefined
  severityClaim?: SeverityValue | undefined
}

export interface ModerateReportInput {
  reasonCode: ModerationReasonCode | null
  status: VerificationStatusValue
}
