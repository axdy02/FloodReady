import { z } from "zod"
import { isoTimestamp } from "../../shared/validation/iso-timestamp.js"
import {
  moderationReasonCodes,
  locationSources,
  reportCategories,
  severities,
  verificationStatuses,
  type CreateReportMetadata,
  type ReportListQuery,
  type SubmitReportInput,
  type UpdateReportInput,
} from "./reports.types.js"

const latitudePattern = /^-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/
const longitudePattern = latitudePattern
const accuracyPattern = /^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/
const integerPattern = /^[1-9][0-9]*$/
const maxDateRangeMs = 366 * 24 * 60 * 60 * 1000

const decimalString = (pattern: RegExp, minimum: number, maximum: number) =>
  z.string().regex(pattern).transform((value, context) => {
    const number = Number(value)
    if (!Number.isFinite(number) || number < minimum || number > maximum) {
      context.addIssue({ code: "custom", message: "Invalid value" })
      return z.NEVER
    }
    return Object.is(number, -0) ? 0 : number
  })

const queryDecimalString = (minimum: number, maximum: number) =>
  z.string().refine((value) => value.length > 0 && value.trim() === value, "Invalid value").transform((value, context) => {
    const number = Number(value)
    if (!Number.isFinite(number) || number < minimum || number > maximum) {
      context.addIssue({ code: "custom", message: "Invalid value" })
      return z.NEVER
    }
    return Object.is(number, -0) ? 0 : number
  })

const optionalQueryTimestamp = isoTimestamp.optional().transform((value) => value ?? null)
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().transform((value) => value ?? null)

const description = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => {
    const length = Array.from(value).length
    return length >= 10 && length <= 1000
  }, "Invalid value")

const multipartMetadataSchema = z
  .object({
    capturedAt: isoTimestamp,
    category: z.enum(reportCategories),
    description,
    gpsAccuracy: decimalString(accuracyPattern, Number.MIN_VALUE, 100000).optional(),
    latitude: decimalString(latitudePattern, -90, 90),
    locationSource: z.enum(locationSources).optional().default("DEVICE_GPS"),
    longitude: decimalString(longitudePattern, -180, 180),
    severityClaim: z.enum(severities).optional().default("UNKNOWN"),
  })
  .strict()
  .superRefine((metadata, context) => {
    if (metadata.locationSource === "DEVICE_GPS" && metadata.gpsAccuracy === undefined) {
      context.addIssue({ code: "custom", path: ["gpsAccuracy"], message: "Invalid value" })
    }
    if (metadata.locationSource === "MANUAL" && metadata.gpsAccuracy !== undefined) {
      context.addIssue({ code: "custom", path: ["gpsAccuracy"], message: "Invalid value" })
    }
  })

const listLimit = z.string().regex(integerPattern).transform(Number).pipe(z.number().int().min(1).max(100)).optional().default(20)

const reportListSchema = z
  .object({
    category: optionalEnum(reportCategories),
    cursor: z.string().min(1).max(512).optional().transform((value) => value ?? null),
    east: queryDecimalString(-180, 180).optional(),
    from: optionalQueryTimestamp,
    limit: listLimit,
    north: queryDecimalString(-90, 90).optional(),
    severity: optionalEnum(severities),
    sort: z.enum(["asc", "desc"]).optional().default("desc"),
    south: queryDecimalString(-90, 90).optional(),
    status: optionalEnum(verificationStatuses),
    to: optionalQueryTimestamp,
    west: queryDecimalString(-180, 180).optional(),
  })
  .strict()
  .superRefine((value, context) => {
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
      if (range < 0 || range > maxDateRangeMs) {
        context.addIssue({ code: "custom", path: ["to"], message: "Invalid value" })
      }
    }
  })

export const reportIdParamsSchema = z.object({ reportId: z.uuid() }).strict()

export const submitReportSchema = z
  .object({ finalSeverity: z.enum(severities) })
  .strict()
  .transform((value): SubmitReportInput => value)

export const updateReportSchema = z
  .object({
    category: z.enum(reportCategories).optional(),
    description: description.optional(),
    severityClaim: z.enum(severities).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Invalid value" })
  .transform((value): UpdateReportInput => {
    const result: UpdateReportInput = {}
    if (value.category !== undefined) {
      result.category = value.category
    }
    if (value.description !== undefined) {
      result.description = value.description
    }
    if (value.severityClaim !== undefined) {
      result.severityClaim = value.severityClaim
    }
    return result
  })

export const moderateReportSchema = z
  .object({
    reasonCode: z.enum(moderationReasonCodes).optional(),
    status: z.enum(verificationStatuses),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.status === "DISPUTED" || value.status === "REJECTED") && value.reasonCode === undefined) {
      context.addIssue({ code: "custom", path: ["reasonCode"], message: "Invalid value" })
    }
  })
  .transform((value) => ({ reasonCode: value.reasonCode ?? null, status: value.status }))

export function parseReportMetadata(value: unknown, now: Date): CreateReportMetadata {
  const metadata = multipartMetadataSchema.superRefine((parsed, context) => {
    if (parsed.capturedAt.getTime() > now.getTime() + 5 * 60 * 1000) {
      context.addIssue({ code: "custom", path: ["capturedAt"], message: "Invalid value" })
    }
  }).parse(value)
  return { ...metadata, gpsAccuracy: metadata.gpsAccuracy ?? null }
}

export function parseReportListQuery(value: unknown): ReportListQuery {
  const query = reportListSchema.parse(value)
  const bbox = query.west !== undefined && query.south !== undefined && query.east !== undefined && query.north !== undefined
    ? { east: query.east, north: query.north, south: query.south, west: query.west }
    : null
  return {
    bbox,
    category: query.category,
    cursor: query.cursor,
    from: query.from,
    limit: query.limit,
    severity: query.severity,
    sort: query.sort,
    status: query.status,
    to: query.to,
  }
}

const reportMapQuerySchema = z
  .object({
    category: optionalEnum(reportCategories),
    cursor: z.string().min(1).max(512).optional().transform((value) => value ?? null),
    east: decimalString(longitudePattern, -180, 180),
    from: optionalQueryTimestamp,
    limit: listLimit,
    north: decimalString(latitudePattern, -90, 90),
    severity: optionalEnum(severities),
    sort: z.enum(["asc", "desc"]).optional().default("desc"),
    south: decimalString(latitudePattern, -90, 90),
    status: optionalEnum(verificationStatuses),
    to: optionalQueryTimestamp,
    west: decimalString(longitudePattern, -180, 180),
  })
  .strict()
  .superRefine((value, context) => {
    const longitudeSpan = value.east - value.west
    const latitudeSpan = value.north - value.south
    if (longitudeSpan <= 0 || longitudeSpan > 2) {
      context.addIssue({ code: "custom", path: ["east"], message: "Invalid value" })
    }
    if (latitudeSpan <= 0 || latitudeSpan > 2) {
      context.addIssue({ code: "custom", path: ["north"], message: "Invalid value" })
    }
    if (longitudeSpan * latitudeSpan > 1) {
      context.addIssue({ code: "custom", path: ["north"], message: "Invalid value" })
    }
    if (value.from !== null && value.to !== null) {
      const range = value.to.getTime() - value.from.getTime()
      if (range < 0 || range > maxDateRangeMs) {
        context.addIssue({ code: "custom", path: ["to"], message: "Invalid value" })
      }
    }
  })

export function parseReportMapQuery(value: unknown): ReportListQuery {
  const query = reportMapQuerySchema.parse(value)
  return {
    bbox: { east: query.east, north: query.north, south: query.south, west: query.west },
    category: query.category,
    cursor: query.cursor,
    from: query.from,
    limit: query.limit,
    severity: query.severity,
    sort: query.sort,
    status: query.status,
    to: query.to,
  }
}
