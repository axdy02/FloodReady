import type { BoundingBox, SortDirection, TotalCountPage } from "../../shared/types/pagination.js"
import type { ReportCategoryValue, SeverityValue } from "../reports/reports.types.js"

export const incidentStatuses = ["ACTIVE", "MONITORING", "RESOLVED", "STALE"] as const
export type IncidentStatusValue = (typeof incidentStatuses)[number]

export interface IncidentDto {
  id: string
  category: ReportCategoryValue
  severity: SeverityValue
  confidenceScore: number | null
  status: IncidentStatusValue
  latitude: number
  longitude: number
  reportCount: number
  firstReportedAt: string
  lastReportedAt: string
  createdAt: string
  updatedAt: string
}

export interface IncidentRecord {
  id: string
  category: ReportCategoryValue
  severity: SeverityValue
  confidenceScore: number | null
  status: IncidentStatusValue
  latitude: number
  longitude: number
  reportCount: number
  firstReportedAt: Date
  lastReportedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface IncidentQuery {
  bbox: BoundingBox | null
  category: ReportCategoryValue | null
  cursor: string | null
  from: Date | null
  limit: number
  severity: SeverityValue | null
  sort: SortDirection
  status: IncidentStatusValue | null
  to: Date | null
}

export interface IncidentFilters {
  bbox: BoundingBox | null
  category: ReportCategoryValue | null
  from: string | null
  severity: SeverityValue | null
  status: IncidentStatusValue | null
  to: string | null
}

export interface IncidentKeyset {
  id: string
  timestamp: Date
}

export type IncidentPage = TotalCountPage<IncidentDto>
