import { z } from "zod"
import { isoTimestamp } from "../../shared/validation/iso-timestamp.js"
import { reportCategories, severities } from "../reports/reports.types.js"
import { incidentStatuses, type IncidentQuery } from "./incidents.types.js"

const integerPattern = /^[1-9][0-9]*$/
const maxRange = 366 * 24 * 60 * 60 * 1000

const queryCoordinate = (minimum: number, maximum: number) =>
  z.string().refine((value) => value.length > 0 && value.trim() === value, "Invalid value").transform((value, context) => {
    const number = Number(value)
    if (!Number.isFinite(number) || number < minimum || number > maximum) {
      context.addIssue({ code: "custom", message: "Invalid value" })
      return z.NEVER
    }
    return Object.is(number, -0) ? 0 : number
  })

export const incidentIdSchema = z.object({ incidentId: z.uuid() }).strict()

const querySchema = z.object({
  category: z.enum(reportCategories).optional().transform((value) => value ?? null),
  cursor: z.string().min(1).max(512).optional().transform((value) => value ?? null),
  east: queryCoordinate(-180, 180).optional(),
  from: isoTimestamp.optional().transform((value) => value ?? null),
  limit: z.string().regex(integerPattern).transform(Number).pipe(z.number().int().min(1).max(100)).optional().default(20),
  north: queryCoordinate(-90, 90).optional(),
  severity: z.enum(severities).optional().transform((value) => value ?? null),
  sort: z.enum(["asc", "desc"]).optional().default("desc"),
  south: queryCoordinate(-90, 90).optional(),
  status: z.enum(incidentStatuses).optional().transform((value) => value ?? null),
  to: isoTimestamp.optional().transform((value) => value ?? null),
  west: queryCoordinate(-180, 180).optional(),
}).strict().superRefine((value, context) => {
  const bounds = [value.west, value.south, value.east, value.north]
  if (bounds.some((item) => item === undefined) && bounds.some((item) => item !== undefined)) {
    context.addIssue({ code: "custom", path: ["west"], message: "Invalid value" })
  }
  if (value.west !== undefined && value.east !== undefined && value.west >= value.east) {
    context.addIssue({ code: "custom", path: ["east"], message: "Invalid value" })
  }
  if (value.south !== undefined && value.north !== undefined && value.south >= value.north) {
    context.addIssue({ code: "custom", path: ["north"], message: "Invalid value" })
  }
  if (value.from !== null && value.to !== null) {
    const range = value.to.getTime() - value.from.getTime()
    if (range < 0 || range > maxRange) {
      context.addIssue({ code: "custom", path: ["to"], message: "Invalid value" })
    }
  }
})

export const incidentQuerySchema = querySchema.transform((query): IncidentQuery => ({
  bbox: query.west !== undefined && query.south !== undefined && query.east !== undefined && query.north !== undefined
    ? { east: query.east, north: query.north, south: query.south, west: query.west }
    : null,
  category: query.category,
  cursor: query.cursor,
  from: query.from,
  limit: query.limit,
  severity: query.severity,
  sort: query.sort,
  status: query.status,
  to: query.to,
}))
