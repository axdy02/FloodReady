import { z } from "zod";
import { parseClientEnvironment } from "@/lib/env/client";

type ServerSource = Record<"FRONTEND_ENV" | "NEXT_PUBLIC_API_BASE_URL" | "INTERNAL_API_BASE_URL" | "NEXT_PUBLIC_APP_ORIGIN" | "NEXT_PUBLIC_MAP_STYLE_URL" | "NEXT_PUBLIC_MAP_ATTRIBUTION" | "NEXT_PUBLIC_MAP_CONNECT_ORIGINS" | "NEXT_PUBLIC_MAP_IMAGE_ORIGINS" | "NEXT_PUBLIC_DEFAULT_MAP_LATITUDE" | "NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE" | "NEXT_PUBLIC_DEFAULT_MAP_ZOOM" | "NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB", string | undefined>;

const internalSchema = z.string().url().refine((value) => {
  const parsed = new URL(value);
  return parsed.pathname === "/api/v1" && parsed.search === "" && parsed.hash === "" && parsed.username === "" && parsed.password === "";
});

export function parseServerEnvironment(source: ServerSource) {
  const client = parseClientEnvironment(source);
  const internal = internalSchema.parse(source.INTERNAL_API_BASE_URL);
  if (new URL(internal).hostname !== "backend" && new URL(internal).hostname !== "localhost") {
    throw new Error("Invalid internal API host");
  }
  return { ...client, INTERNAL_API_BASE_URL: internal, NODE_ENV: process.env.NODE_ENV };
}

export function loadServerEnvironment() {
  return parseServerEnvironment({
    FRONTEND_ENV: process.env.FRONTEND_ENV,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    INTERNAL_API_BASE_URL: process.env.INTERNAL_API_BASE_URL,
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
