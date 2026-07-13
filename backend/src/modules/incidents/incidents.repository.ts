import { Prisma } from "../../generated/prisma/client.js"
import { prisma } from "../../database/prisma.js"
import type { IncidentKeyset, IncidentQuery, IncidentRecord } from "./incidents.types.js"

const columns = Prisma.sql`
  i."id", i."category", i."severity",
  i."confidence_score"::double precision AS "confidenceScore",
  i."status",
  i."latitude"::double precision AS "latitude",
  i."longitude"::double precision AS "longitude",
  (SELECT COUNT(*)::integer FROM "flood_reports" r WHERE r."incident_id" = i."id") AS "reportCount",
  i."first_reported_at" AS "firstReportedAt",
  i."last_reported_at" AS "lastReportedAt",
  i."created_at" AS "createdAt",
  i."updated_at" AS "updatedAt"
`

function conditions(query: IncidentQuery, keyset: IncidentKeyset | null, includeKeyset: boolean): Prisma.Sql[] {
  const clauses: Prisma.Sql[] = []
  if (query.category !== null) clauses.push(Prisma.sql`i."category" = ${query.category}::"ReportCategory"`)
  if (query.status !== null) clauses.push(Prisma.sql`i."status" = ${query.status}::"IncidentStatus"`)
  if (query.severity !== null) clauses.push(Prisma.sql`i."severity" = ${query.severity}::"Severity"`)
  if (query.from !== null) clauses.push(Prisma.sql`i."last_reported_at" >= ${query.from}::timestamptz(3)`)
  if (query.to !== null) clauses.push(Prisma.sql`i."last_reported_at" <= ${query.to}::timestamptz(3)`)
  if (query.bbox !== null) {
    clauses.push(Prisma.sql`i."location" && ST_MakeEnvelope(
      ${query.bbox.west}::double precision,
      ${query.bbox.south}::double precision,
      ${query.bbox.east}::double precision,
      ${query.bbox.north}::double precision,
      4326
    )::geography`)
  }
  if (includeKeyset && keyset !== null && query.sort === "asc") {
    clauses.push(Prisma.sql`(i."last_reported_at", i."id") > (${keyset.timestamp}::timestamptz(3), ${keyset.id}::uuid)`)
  }
  if (includeKeyset && keyset !== null && query.sort === "desc") {
    clauses.push(Prisma.sql`(i."last_reported_at", i."id") < (${keyset.timestamp}::timestamptz(3), ${keyset.id}::uuid)`)
  }
  return clauses
}

export const findIncident = async (id: string): Promise<IncidentRecord | null> => {
  const rows = await prisma.$queryRaw<IncidentRecord[]>`
    SELECT ${columns} FROM "incidents" i WHERE i."id" = ${id}::uuid
  `
  return rows[0] ?? null
}

export const listIncidents = async (
  query: IncidentQuery,
  keyset: IncidentKeyset | null,
): Promise<IncidentRecord[]> => {
  const clauses = conditions(query, keyset, true)
  const where = clauses.length === 0 ? Prisma.sql`TRUE` : Prisma.join(clauses, " AND ")
  const order = query.sort === "asc"
    ? Prisma.sql`i."last_reported_at" ASC, i."id" ASC`
    : Prisma.sql`i."last_reported_at" DESC, i."id" DESC`
  return prisma.$queryRaw<IncidentRecord[]>`
    SELECT ${columns}
    FROM "incidents" i
    WHERE ${where}
    ORDER BY ${order}
    LIMIT ${query.limit + 1}
  `
}

export const countIncidents = async (query: IncidentQuery): Promise<number> => {
  const clauses = conditions(query, null, false)
  const where = clauses.length === 0 ? Prisma.sql`TRUE` : Prisma.join(clauses, " AND ")
  const rows = await prisma.$queryRaw<Array<{ totalCount: number }>>`
    SELECT COUNT(*)::integer AS "totalCount"
    FROM "incidents" i
    WHERE ${where}
  `
  const totalCount = rows[0]?.totalCount
  if (typeof totalCount !== "number" || totalCount < 0) {
    throw new Error("Invalid incident count")
  }
  return totalCount
}
