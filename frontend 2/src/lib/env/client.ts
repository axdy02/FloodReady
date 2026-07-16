import { z } from "zod";

type ClientSource = Record<"FRONTEND_ENV" | "NEXT_PUBLIC_API_BASE_URL" | "NEXT_PUBLIC_APP_ORIGIN" | "NEXT_PUBLIC_MAP_STYLE_URL" | "NEXT_PUBLIC_MAP_ATTRIBUTION" | "NEXT_PUBLIC_MAP_CONNECT_ORIGINS" | "NEXT_PUBLIC_MAP_IMAGE_ORIGINS" | "NEXT_PUBLIC_DEFAULT_MAP_LATITUDE" | "NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE" | "NEXT_PUBLIC_DEFAULT_MAP_ZOOM" | "NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB", string | undefined>;

function origin(value: string): boolean {
  const parsed = new URL(value);
  return parsed.origin === value && parsed.username === "" && parsed.password === "";
}

function apiUrl(value: string): boolean {
  const parsed = new URL(value);
  return parsed.pathname === "/api/v1" && parsed.search === "" && parsed.hash === "" && parsed.username === "" && parsed.password === "";
}

function mapOrigins(value: string): string[] {
  const entries = value.split(",").map((entry) => entry.trim());
  if (entries.length === 0 || entries.some((entry) => entry.length === 0 || !origin(entry)) || new Set(entries).size !== entries.length) {
    throw new Error("Invalid map origins");
  }
  return entries;
}

const baseSchema = z.object({
  FRONTEND_ENV: z.enum(["test", "local", "production"]),
  NEXT_PUBLIC_API_BASE_URL: z.string().refine(apiUrl),
  NEXT_PUBLIC_APP_ORIGIN: z.string().refine(origin),
  NEXT_PUBLIC_MAP_STYLE_URL: z.string().url(),
  NEXT_PUBLIC_MAP_ATTRIBUTION: z.string().min(1).max(240).refine((value) => value === value.trim() && !/[\r\n<>&]/u.test(value)),
  NEXT_PUBLIC_MAP_CONNECT_ORIGINS: z.string().min(1),
  NEXT_PUBLIC_MAP_IMAGE_ORIGINS: z.string().min(1),
  NEXT_PUBLIC_DEFAULT_MAP_LATITUDE: z.coerce.number().min(-85.051128).max(85.051128),
  NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE: z.coerce.number().min(-179.98).max(179.98),
  NEXT_PUBLIC_DEFAULT_MAP_ZOOM: z.coerce.number().min(1).max(18),
  NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB: z.coerce.number().int().min(1).max(20)
});

export type ClientEnvironment = z.infer<typeof baseSchema> & { mapConnectOrigins: string[]; mapImageOrigins: string[] };

export function parseClientEnvironment(source: ClientSource): ClientEnvironment {
  const parsed = baseSchema.parse(source);
  const connect = mapOrigins(parsed.NEXT_PUBLIC_MAP_CONNECT_ORIGINS);
  const images = mapOrigins(parsed.NEXT_PUBLIC_MAP_IMAGE_ORIGINS);
  const style = new URL(parsed.NEXT_PUBLIC_MAP_STYLE_URL);
  if (style.username !== "" || style.password !== "" || style.hash !== "" || !connect.includes(style.origin)) {
    throw new Error("Invalid map style URL");
  }
  if (parsed.FRONTEND_ENV === "production" && [parsed.NEXT_PUBLIC_API_BASE_URL, parsed.NEXT_PUBLIC_APP_ORIGIN, parsed.NEXT_PUBLIC_MAP_STYLE_URL, ...connect, ...images].some((entry) => !entry.startsWith("https://"))) {
    throw new Error("Production requires HTTPS");
  }
  if (parsed.FRONTEND_ENV === "local") {
    for (const value of [parsed.NEXT_PUBLIC_API_BASE_URL, parsed.NEXT_PUBLIC_APP_ORIGIN]) {
      const parsedValue = new URL(value);
      if (parsedValue.protocol === "http:" && parsedValue.hostname !== "localhost") {
        throw new Error("Local HTTP origin must use localhost");
      }
    }
    if (!style.protocol.startsWith("https")) {
      throw new Error("Map style requires HTTPS");
    }
  }
  return { ...parsed, mapConnectOrigins: connect, mapImageOrigins: images };
}

export function loadClientEnvironment(): ClientEnvironment {
  const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  const clientEnvironment = process.env.NODE_ENV === "test"
    ? "test"
    : appOrigin?.startsWith("http://localhost")
      ? "local"
      : "production";
  return parseClientEnvironment({
    FRONTEND_ENV: clientEnvironment,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_APP_ORIGIN: process.env.NEXT_PUBLIC_APP_ORIGIN,
    NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
    NEXT_PUBLIC_MAP_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION,
    NEXT_PUBLIC_MAP_CONNECT_ORIGINS: process.env.NEXT_PUBLIC_MAP_CONNECT_ORIGINS,
    NEXT_PUBLIC_MAP_IMAGE_ORIGINS: process.env.NEXT_PUBLIC_MAP_IMAGE_ORIGINS,
    NEXT_PUBLIC_DEFAULT_MAP_LATITUDE: process.env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE,
    NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE: process.env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE,
    NEXT_PUBLIC_DEFAULT_MAP_ZOOM: process.env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM,
    NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB: process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB
  });
}
