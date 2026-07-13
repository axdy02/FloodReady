import { AppError } from "../../shared/errors/index.js"
import {
  CursorValidationError,
  encodeCursor,
  hashFilters,
  validateCursor,
} from "../../shared/validation/cursor.js"
import { countIncidents, findIncident, listIncidents } from "./incidents.repository.js"
import type {
  IncidentDto,
  IncidentFilters,
  IncidentKeyset,
  IncidentPage,
  IncidentQuery,
  IncidentRecord,
} from "./incidents.types.js"

const toDto = (incident: IncidentRecord): IncidentDto => ({
  ...incident,
  createdAt: incident.createdAt.toISOString(),
  firstReportedAt: incident.firstReportedAt.toISOString(),
  lastReportedAt: incident.lastReportedAt.toISOString(),
  updatedAt: incident.updatedAt.toISOString(),
})

const normalizedFilters = (query: IncidentQuery): IncidentFilters => ({
  bbox: query.bbox,
  category: query.category,
  from: query.from?.toISOString() ?? null,
  severity: query.severity,
  status: query.status,
  to: query.to?.toISOString() ?? null,
})

const invalidCursor = (): AppError => new AppError(
  400,
  "VALIDATION_ERROR",
  "Invalid request",
  [{ path: "query.cursor", message: "Invalid value" }],
)

export const get = async (id: string): Promise<IncidentDto> => {
  const incident = await findIncident(id)
  if (incident === null) {
    throw new AppError(404, "NOT_FOUND", "Resource not found")
  }
  return toDto(incident)
}

export const list = async (query: IncidentQuery): Promise<IncidentPage> => {
  const filters = normalizedFilters(query)
  let keyset: IncidentKeyset | null = null
  if (query.cursor !== null) {
    try {
      const cursor = validateCursor(query.cursor, "incidents", query.sort, filters)
      keyset = { id: cursor.id, timestamp: new Date(cursor.timestamp) }
    } catch (error) {
      if (error instanceof CursorValidationError) throw invalidCursor()
      throw error
    }
  }
  const [rows, totalCount] = await Promise.all([
    listIncidents(query, keyset),
    countIncidents(query),
  ])
  const hasMore = rows.length > query.limit
  const returned = rows.slice(0, query.limit)
  const last = hasMore ? returned.at(-1) : undefined
  const nextCursor = last === undefined ? null : encodeCursor({
    filterHash: hashFilters(filters),
    id: last.id,
    resource: "incidents",
    sort: query.sort,
    timestamp: last.lastReportedAt.toISOString(),
    v: 1,
  })
  return {
    items: returned.map(toDto),
    totalCount,
    pagination: { hasMore, limit: query.limit, nextCursor },
  }
}
