import { z } from "zod";

export const roleSchema = z.enum(["USER", "MODERATOR", "ADMIN"]);
export const categorySchema = z.enum(["ROAD_WATERLOGGING", "FLOODED_ROAD", "CLOGGED_DRAIN", "OVERFLOWING_DRAIN", "OPEN_MANHOLE", "FALLEN_TREE", "STRANDED_VEHICLE", "UNDERPASS_FLOODING", "OTHER"]);
export const severitySchema = z.enum(["UNKNOWN", "MINOR", "MODERATE", "SEVERE", "IMPASSABLE"]);
export const verificationStatusSchema = z.enum(["SUBMITTED", "PENDING_REVIEW", "PROVISIONAL", "VERIFIED", "DISPUTED", "REJECTED", "RESOLVED", "STALE"]);
export const locationSourceSchema = z.enum(["DEVICE_GPS", "MANUAL"]);
export const incidentStatusSchema = z.enum(["ACTIVE", "MONITORING", "RESOLVED", "STALE"]);

const userSchema = z.object({ id: z.uuid(), name: z.string(), email: z.string(), role: roleSchema, isActive: z.boolean(), createdAt: z.string(), updatedAt: z.string() }).strict();
const authSchema = z.object({ accessToken: z.string().min(1), tokenType: z.literal("Bearer"), expiresInSeconds: z.number().int().positive(), user: userSchema }).strict();
const reportSchema = z.object({ id: z.uuid(), reporterId: z.uuid(), category: categorySchema, description: z.string().nullable(), severityClaim: severitySchema, latitude: z.number(), longitude: z.number(), gpsAccuracy: z.number().nullable(), locationSource: locationSourceSchema, capturedAt: z.string(), submittedAt: z.string(), uploadSource: z.string(), verificationStatus: verificationStatusSchema, incidentId: z.uuid().nullable(), createdAt: z.string(), updatedAt: z.string() }).strict();
const mapReportSchema = z.object({ id: z.uuid(), category: categorySchema, severityClaim: severitySchema, latitude: z.number(), longitude: z.number(), capturedAt: z.string(), submittedAt: z.string(), verificationStatus: verificationStatusSchema, incidentId: z.uuid().nullable(), updatedAt: z.string(), canViewDetails: z.boolean() }).strict();
const incidentSchema = z.object({ id: z.uuid(), category: categorySchema, severity: severitySchema, confidenceScore: z.number().nullable(), status: incidentStatusSchema, latitude: z.number(), longitude: z.number(), reportCount: z.number().int().nonnegative(), firstReportedAt: z.string(), lastReportedAt: z.string(), createdAt: z.string(), updatedAt: z.string() }).strict();
const paginationSchema = z.object({ limit: z.number().int().min(1).max(100), hasMore: z.boolean(), nextCursor: z.string().nullable() }).strict();

export const userDtoSchema = userSchema;
export const authDtoSchema = authSchema;
export const reportDtoSchema = reportSchema;
export const reportMapDtoSchema = mapReportSchema;
export const incidentDtoSchema = incidentSchema;
export const reportPageSchema = z.object({ items: z.array(reportSchema), pagination: paginationSchema, totalCount: z.number().int().nonnegative() }).strict();
export const reportMapPageSchema = z.object({ items: z.array(mapReportSchema), pagination: paginationSchema, totalCount: z.number().int().nonnegative() }).strict();
export const incidentPageSchema = z.object({ items: z.array(incidentSchema), pagination: paginationSchema, totalCount: z.number().int().nonnegative() }).strict();
export const userPageSchema = z.object({ items: z.array(userSchema), pagination: paginationSchema }).strict();
export const errorSchema = z.object({ code: z.string(), message: z.string(), details: z.array(z.unknown()) }).strict();
export const successEnvelopeSchema = <T extends z.ZodType>(data: T) => z.object({ success: z.literal(true), data, requestId: z.uuid() }).strict();
export const errorEnvelopeSchema = z.object({ success: z.literal(false), error: errorSchema, requestId: z.uuid() }).strict();
export const healthSchema = z.object({ status: z.enum(["ok", "ready"]) }).strict();
export const backendHealthSchema = z.object({ status: z.enum(["ok", "ready"]) }).passthrough();

export type AuthDto = z.infer<typeof authSchema>;
export type UserDto = z.infer<typeof userSchema>;
export type ReportDto = z.infer<typeof reportSchema>;
export type ReportMapDto = z.infer<typeof mapReportSchema>;
export type IncidentDto = z.infer<typeof incidentSchema>;
