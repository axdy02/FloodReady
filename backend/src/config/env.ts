import "dotenv/config";
import { resolve } from "node:path";
import { z } from "zod";

const durationPattern = /^(?<value>[1-9][0-9]*)(?<unit>ms|s|m|h|d)$/u;
const secretPlaceholderPattern = /(replace|placeholder|example|change|secret)/iu;
const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/iu;

const parseDuration = (value: string): number | null => {
  const match = durationPattern.exec(value);
  const amountText = match?.groups?.value;
  const unit = match?.groups?.unit;
  if (amountText === undefined || unit === undefined) {
    return null;
  }
  const amount = Number(amountText);
  const multiplier = unit === "ms" ? 1 : unit === "s" ? 1_000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  const result = amount * multiplier;
  return Number.isSafeInteger(result) ? result : null;
};

const isPostgresUrl = (value: string): boolean => {
  const parsed = new URL(value);
  return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
};

const isExactOrigin = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.origin === value;
  } catch {
    return false;
  }
};

const base64UrlSecret = z.string().regex(/^[A-Za-z0-9_-]+$/u).refine((value) => {
  const bytes = Buffer.from(value, "base64url");
  return bytes.length >= 64
    && bytes.toString("base64url") === value
    && !bytes.every((byte) => byte === bytes[0])
    && !secretPlaceholderPattern.test(value);
}, "Invalid secret");

const serviceToken = z.string().regex(/^[A-Za-z0-9_-]+$/u).refine((value) => {
  const bytes = Buffer.from(value, "base64url");
  return bytes.length >= 32
    && bytes.toString("base64url") === value
    && !bytes.every((byte) => byte === bytes[0])
    && !secretPlaceholderPattern.test(value);
}, "Invalid service token");

const databaseUrl = z.string().url().refine((value) => isPostgresUrl(value), "Invalid PostgreSQL URL");

const urlList = z.string().transform((value, context) => {
  const values = value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
  if (values.length === 0 || new Set(values).size !== values.length || values.some((item) => !isExactOrigin(item))) {
    context.addIssue({ code: "custom", message: "Invalid CORS origin list" });
    return z.NEVER;
  }
  return values;
});

const passwordIsValid = (value: string): boolean => {
  const count = Array.from(value).length;
  return count >= 12 && count <= 128 && Buffer.byteLength(value, "utf8") <= 512;
};

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().min(1).max(65_535),
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl.optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(500).max(10_000),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000),
  DB_QUERY_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000),
  AI_SERVICE_BASE_URL: z.string().refine((value) => isExactOrigin(value), "Invalid AI service origin"),
  AI_SERVICE_TOKEN: serviceToken,
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000),
  ACCESS_TOKEN_SECRET: base64UrlSecret,
  REFRESH_TOKEN_SECRET: base64UrlSecret,
  ACCESS_TOKEN_TTL: z.string().regex(durationPattern),
  REFRESH_TOKEN_TTL: z.string().regex(durationPattern),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  PUBLIC_API_ORIGIN: z.string().refine((value) => isExactOrigin(value), "Invalid API origin"),
  CORS_ORIGINS: urlList,
  COOKIE_DOMAIN: z.string(),
  UPLOAD_DIRECTORY: z.string().trim().min(1).transform((value) => resolve(value)),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().min(1).max(20),
  MAX_IMAGE_PIXELS: z.coerce.number().int().min(1_000_000).max(25_000_000),
  UPLOAD_PROCESSING_CONCURRENCY: z.coerce.number().int().min(1).max(4),
  UPLOAD_QUEUE_MAX: z.coerce.number().int().min(0).max(50),
  JSON_BODY_LIMIT_KB: z.coerce.number().int().min(1).max(1_024),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive(),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(10_000),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive(),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(100),
  REPORT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive(),
  REPORT_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(100),
  LOGIN_FAILURE_WINDOW_MS: z.coerce.number().int().positive(),
  LOGIN_FAILURE_MAX: z.coerce.number().int().min(1).max(10),
  LOGIN_LOCK_MS: z.coerce.number().int().positive(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(30_000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]),
  SEED_ADMIN_NAME: z.string().optional(),
  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional()
}).superRefine((value, context) => {
  const accessDuration = parseDuration(value.ACCESS_TOKEN_TTL);
  const refreshDuration = parseDuration(value.REFRESH_TOKEN_TTL);
  const accessSecret = Buffer.from(value.ACCESS_TOKEN_SECRET, "base64url");
  const refreshSecret = Buffer.from(value.REFRESH_TOKEN_SECRET, "base64url");
  const aiServiceToken = Buffer.from(value.AI_SERVICE_TOKEN, "base64url");
  const publicOrigin = new URL(value.PUBLIC_API_ORIGIN);

  if (accessSecret.equals(refreshSecret)) {
    context.addIssue({ code: "custom", path: ["REFRESH_TOKEN_SECRET"], message: "Token secrets must differ" });
  }
  if (aiServiceToken.equals(accessSecret) || aiServiceToken.equals(refreshSecret)) {
    context.addIssue({ code: "custom", path: ["AI_SERVICE_TOKEN"], message: "Service token must differ from JWT secrets" });
  }
  if (accessDuration === null || accessDuration < 300_000 || accessDuration > 1_800_000) {
    context.addIssue({ code: "custom", path: ["ACCESS_TOKEN_TTL"], message: "Access token TTL must be 5 to 30 minutes" });
  }
  if (refreshDuration === null || refreshDuration < 86_400_000 || refreshDuration > 7_776_000_000) {
    context.addIssue({ code: "custom", path: ["REFRESH_TOKEN_TTL"], message: "Refresh token TTL must be 1 to 90 days" });
  }
  if (value.NODE_ENV === "test") {
    if (value.TEST_DATABASE_URL === undefined || !new URL(value.TEST_DATABASE_URL).pathname.endsWith("_test")) {
      context.addIssue({ code: "custom", path: ["TEST_DATABASE_URL"], message: "A test database URL ending in _test is required" });
    }
  }
  if (value.COOKIE_DOMAIN.length > 0 && !domainPattern.test(value.COOKIE_DOMAIN)) {
    context.addIssue({ code: "custom", path: ["COOKIE_DOMAIN"], message: "Invalid cookie domain" });
  }
  for (const origin of [value.PUBLIC_API_ORIGIN, ...value.CORS_ORIGINS]) {
    const parsed = new URL(origin);
    if (value.NODE_ENV === "production" && parsed.protocol !== "https:") {
      context.addIssue({ code: "custom", path: ["CORS_ORIGINS"], message: "Production origins must use HTTPS" });
      break;
    }
    if (value.COOKIE_DOMAIN.length === 0) {
      if (parsed.hostname !== publicOrigin.hostname) {
        context.addIssue({ code: "custom", path: ["CORS_ORIGINS"], message: "Origins must use the API hostname" });
        break;
      }
    } else if (parsed.hostname !== value.COOKIE_DOMAIN && !parsed.hostname.endsWith(`.${value.COOKIE_DOMAIN}`)) {
      context.addIssue({ code: "custom", path: ["CORS_ORIGINS"], message: "Origins must match the cookie domain" });
      break;
    }
  }
  const seedValues = [value.SEED_ADMIN_NAME, value.SEED_ADMIN_EMAIL, value.SEED_ADMIN_PASSWORD];
  if (seedValues.some((item) => item !== undefined) && seedValues.some((item) => item === undefined)) {
    context.addIssue({ code: "custom", message: "Seed administrator values must be supplied together" });
  }
  if (value.SEED_ADMIN_NAME !== undefined && (Array.from(value.SEED_ADMIN_NAME.normalize("NFKC").trim()).length < 2 || Array.from(value.SEED_ADMIN_NAME.normalize("NFKC").trim()).length > 100)) {
    context.addIssue({ code: "custom", path: ["SEED_ADMIN_NAME"], message: "Invalid seed administrator name" });
  }
  if (value.SEED_ADMIN_EMAIL !== undefined && (value.SEED_ADMIN_EMAIL.trim().length > 254 || !z.email().safeParse(value.SEED_ADMIN_EMAIL.trim().toLowerCase()).success)) {
    context.addIssue({ code: "custom", path: ["SEED_ADMIN_EMAIL"], message: "Invalid seed administrator email" });
  }
  if (value.SEED_ADMIN_PASSWORD !== undefined && !passwordIsValid(value.SEED_ADMIN_PASSWORD)) {
    context.addIssue({ code: "custom", path: ["SEED_ADMIN_PASSWORD"], message: "Invalid seed administrator password" });
  }
});

type ParsedConfig = z.infer<typeof schema>;

export type Config = Omit<ParsedConfig, "CORS_ORIGINS"> & {
  CORS_ORIGINS: readonly string[];
  accessTokenTtlMs: number;
  refreshTokenTtlMs: number;
};

export const loadConfig = (): Readonly<Config> => {
  const parsed = schema.parse(process.env);
  const accessTokenTtlMs = parseDuration(parsed.ACCESS_TOKEN_TTL);
  const refreshTokenTtlMs = parseDuration(parsed.REFRESH_TOKEN_TTL);
  if (accessTokenTtlMs === null || refreshTokenTtlMs === null) {
    throw new Error("Invalid configured duration");
  }
  return Object.freeze({
    ...parsed,
    CORS_ORIGINS: Object.freeze([...parsed.CORS_ORIGINS]),
    accessTokenTtlMs,
    refreshTokenTtlMs
  });
};

export const config = loadConfig();
