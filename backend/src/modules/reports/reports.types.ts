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
export type ModerationReasonCode = (typeof moderationReasonCodes)[number]

export interface ReportDto {
  id: string
  reporterId: string
  category: ReportCategoryValue
  description: string | null
  severityClaim: SeverityValue
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
}

export interface ReportRecord {
  id: string
  reporterId: string
  category: ReportCategoryValue
  description: string | null
  severityClaim: SeverityValue
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
}

export interface CreateReportMetadata {
  category: ReportCategoryValue
  description: string | null
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
  latitude: number
  longitude: number
  capturedAt: string
  submittedAt: string
  verificationStatus: VerificationStatusValue
  incidentId: string | null
  updatedAt: string
  canViewDetails: boolean
}

export type ReportMapPage = TotalCountPage<ReportMapDto>

export interface UpdateReportInput {
  category?: ReportCategoryValue | undefined
  description?: string | null | undefined
  severityClaim?: SeverityValue | undefined
}

export interface ModerateReportInput {
  reasonCode: ModerationReasonCode | null
  status: VerificationStatusValue
}
