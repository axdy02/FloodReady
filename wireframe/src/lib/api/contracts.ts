import { z } from "zod";

export const roleSchema = z.enum(["USER", "MODERATOR", "ADMIN"]);
export const categorySchema = z.enum(["ROAD_WATERLOGGING", "FLOODED_ROAD", "CLOGGED_DRAIN", "OVERFLOWING_DRAIN", "OPEN_MANHOLE", "FALLEN_TREE", "STRANDED_VEHICLE", "UNDERPASS_FLOODING", "OTHER"]);
export const severitySchema = z.enum(["UNKNOWN", "MINOR", "MODERATE", "SEVERE", "IMPASSABLE"]);
export const verificationStatusSchema = z.enum(["SUBMITTED", "PENDING_REVIEW", "PROVISIONAL", "VERIFIED", "DISPUTED", "REJECTED", "RESOLVED", "STALE"]);
export const locationSourceSchema = z.enum(["DEVICE_GPS", "MANUAL"]);
export const incidentStatusSchema = z.enum(["ACTIVE", "MONITORING", "RESOLVED", "STALE"]);
export const aiAnalysisStatusSchema = z.enum(["PROCESSING", "SUCCEEDED", "FAILED", "TIMED_OUT"]);
export const waterLevelCategorySchema = z.enum(["NONE", "ANKLE_LEVEL", "KNEE_LEVEL", "WAIST_LEVEL", "ABOVE_WAIST", "UNKNOWN"]);
export const roadPassabilitySchema = z.enum(["PASSABLE", "CAUTION", "UNSAFE", "IMPASSABLE", "UNKNOWN"]);
export const imageQualitySchema = z.enum(["GOOD", "FAIR", "POOR", "UNUSABLE"]);

const aiAnalysisSchema = z.object({
  id: z.uuid(),
  status: aiAnalysisStatusSchema,
  floodDetected: z.boolean().nullable(),
  suggestedSeverity: severitySchema.nullable(),
  confidenceScore: z.number().min(0).max(1).nullable(),
  validationScore: z.number().min(0).max(1).nullable(),
  validationOutcome: z.enum(["ACCEPTED", "NEEDS_REVIEW", "REJECTED"]).nullable(),
  weatherSummary: z.string().max(500).nullable(),
  weatherPrecipitationMm: z.number().nonnegative().nullable(),
  weatherTemperatureC: z.number().min(-100).max(100).nullable(),
  waterLevelCategory: waterLevelCategorySchema.nullable(),
  roadPassability: roadPassabilitySchema.nullable(),
  imageQuality: imageQualitySchema.nullable(),
  summary: z.string().max(500).nullable(),
  evidenceFlags: z.array(z.string().min(1).max(64)).max(20),
  needsHumanReview: z.boolean().nullable(),
  modelName: z.string().min(1).max(100).nullable(),
  modelVersion: z.string().min(1).max(100).nullable(),
  processingTimeMs: z.number().int().nonnegative().nullable(),
}).strict();

const mapAiAnalysisSchema = aiAnalysisSchema.pick({
  status: true,
  floodDetected: true,
  suggestedSeverity: true,
  confidenceScore: true,
  validationScore: true,
  validationOutcome: true,
  needsHumanReview: true,
}).strict();

const userSchema = z.object({ id: z.uuid(), name: z.string(), email: z.string(), role: roleSchema, isActive: z.boolean(), createdAt: z.string(), updatedAt: z.string() }).strict();
const authSchema = z.object({ accessToken: z.string().min(1), tokenType: z.literal("Bearer"), expiresInSeconds: z.number().int().positive(), user: userSchema }).strict();
const reportSchema = z.object({ id: z.uuid(), reporterId: z.uuid(), category: categorySchema, description: z.string(), severityClaim: severitySchema, finalSeverity: severitySchema, aiUsed: z.boolean(), aiAnalysis: aiAnalysisSchema.nullable(), latitude: z.number(), longitude: z.number(), gpsAccuracy: z.number().nullable(), locationSource: locationSourceSchema, capturedAt: z.string(), submittedAt: z.string(), uploadSource: z.string(), verificationStatus: verificationStatusSchema, incidentId: z.uuid().nullable(), createdAt: z.string(), updatedAt: z.string() }).strict();
const mapReportSchema = z.object({ id: z.uuid(), category: categorySchema, severityClaim: severitySchema, finalSeverity: severitySchema, aiUsed: z.boolean(), aiAnalysis: mapAiAnalysisSchema.nullable(), latitude: z.number(), longitude: z.number(), capturedAt: z.string(), submittedAt: z.string(), verificationStatus: verificationStatusSchema, incidentId: z.uuid().nullable(), updatedAt: z.string(), canViewDetails: z.boolean() }).strict();
const incidentSchema = z.object({ id: z.uuid(), category: categorySchema, severity: severitySchema, confidenceScore: z.number().nullable(), status: incidentStatusSchema, latitude: z.number(), longitude: z.number(), reportCount: z.number().int().nonnegative(), firstReportedAt: z.string(), lastReportedAt: z.string(), createdAt: z.string(), updatedAt: z.string() }).strict();
const paginationSchema = z.object({ limit: z.number().int().min(1).max(100), hasMore: z.boolean(), nextCursor: z.string().nullable() }).strict();

const draftAnalysisSchema = z.object({
  draftId: z.uuid(),
  expiresAt: z.string(),
  category: categorySchema,
  description: z.string(),
  severityClaim: severitySchema,
  latitude: z.number(),
  longitude: z.number(),
  gpsAccuracy: z.number().nullable(),
  locationSource: locationSourceSchema,
  capturedAt: z.string(),
  analysis: aiAnalysisSchema,
}).strict();

export const userDtoSchema = userSchema;
export const authDtoSchema = authSchema;
export const reportDtoSchema = reportSchema;
export const reportMapDtoSchema = mapReportSchema;
export const aiAnalysisDtoSchema = aiAnalysisSchema;
export const mapAiAnalysisDtoSchema = mapAiAnalysisSchema;
export const draftAnalysisDtoSchema = draftAnalysisSchema;
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
export const servicesHealthSchema = z.object({
  backend: z.enum(["ready", "degraded", "unavailable"]),
  aiService: z.enum(["ready", "degraded", "unavailable"]),
  checkedAt: z.string(),
}).strict();

export type AuthDto = z.infer<typeof authSchema>;
export type UserDto = z.infer<typeof userSchema>;
export type ReportDto = z.infer<typeof reportSchema>;
export type ReportMapDto = z.infer<typeof mapReportSchema>;
export type AiAnalysisDto = z.infer<typeof aiAnalysisSchema>;
export type MapAiAnalysisDto = z.infer<typeof mapAiAnalysisSchema>;
export type DraftAnalysisDto = z.infer<typeof draftAnalysisSchema>;
export type IncidentDto = z.infer<typeof incidentSchema>;
export type ServicesHealthDto = z.infer<typeof servicesHealthSchema>;
