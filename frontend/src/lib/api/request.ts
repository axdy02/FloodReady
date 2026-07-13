import { z } from "zod";
import { loadClientEnvironment } from "@/lib/env/client";
import { ApiError, RequestCancelledError } from "@/lib/api/errors";
import { errorEnvelopeSchema, successEnvelopeSchema } from "@/lib/api/contracts";

export type TimeoutMode = "normal" | "imageUpload";
export type ResponseMode = "json" | "protectedReportImage";
type RequestOptions<T extends z.ZodType> = { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string; schema: T; body?: BodyInit; accessToken?: string; signal?: AbortSignal; mode?: TimeoutMode; timeoutClass?: TimeoutMode; responseMode?: ResponseMode };

const timeoutMs: Record<TimeoutMode, number> = { normal: 10000, imageUpload: 15000 };
const uuidPath = /^\/reports\/[0-9a-f-]{36}\/image$/iu;

function requestId(): string {
  return globalThis.crypto.randomUUID();
}

function retryable(method: RequestOptions<z.ZodType>["method"], status: number | null, error: ApiError): boolean {
  return method === "GET" && (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT" || status === 500 || status === 503);
}

async function delay(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const abort = () => { clearTimeout(timer); reject(new RequestCancelledError()); };
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function oneAttempt<T extends z.ZodType>(options: RequestOptions<T>, url: string, id: string): Promise<z.infer<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs[options.timeoutClass ?? options.mode ?? "normal"]);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const headers = new Headers({ Accept: "application/json", "X-Request-Id": id });
    if (options.body !== undefined && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (options.accessToken !== undefined) headers.set("Authorization", `Bearer ${options.accessToken}`);
    const init: RequestInit = { method: options.method, headers, credentials: "include", signal: controller.signal };
    if (options.body !== undefined) init.body = options.body;
    const response = await fetch(url, init);
    if (options.responseMode === "protectedReportImage") {
      if (options.method !== "GET" || !uuidPath.test(options.path) || options.accessToken === undefined) throw new ApiError("VALIDATION_ERROR", "Invalid image request", response.status);
      if (!response.ok) throw await parseError(response);
      const contentType = response.headers.get("Content-Type");
      const cacheControl = response.headers.get("Cache-Control") ?? "";
      const size = Number(response.headers.get("Content-Length") ?? "0");
      if (contentType === null || !["image/jpeg", "image/png", "image/webp"].includes(contentType) || !cacheControl.includes("private") || !cacheControl.includes("no-store") || size > loadClientEnvironment().NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB * 1048576) throw new ApiError("INTERNAL_ERROR", "Invalid image response", response.status);
      const blob = await response.blob();
      if (blob.size === 0 || blob.size > loadClientEnvironment().NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB * 1048576) throw new ApiError("INTERNAL_ERROR", "Invalid image response", response.status);
      return { blob, mime: contentType } as z.infer<T>;
    }
    if (!response.ok) throw await parseError(response);
    const body = await response.json();
    const parsed = successEnvelopeSchema(options.schema).parse(body) as { data: z.infer<T> };
    return parsed.data;
  } catch (error) {
    if (options.signal?.aborted) throw new RequestCancelledError();
    if (error instanceof DOMException && error.name === "AbortError") throw new ApiError("TIMEOUT", "Request timed out", null);
    if (error instanceof ApiError) throw error;
    throw new ApiError("NETWORK_ERROR", "Network request failed", null);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const parsed = errorEnvelopeSchema.parse(await response.json());
    return new ApiError(parsed.error.code as ApiError["code"], parsed.error.message, response.status, parsed.error.details);
  } catch {
    return new ApiError("INTERNAL_ERROR", "Request failed", response.status);
  }
}

export async function request<T extends z.ZodType>(options: RequestOptions<T>): Promise<z.infer<T>> {
  const environment = loadClientEnvironment();
  if (!options.path.startsWith("/") || options.path.includes(":") || options.path.includes("..")) throw new ApiError("VALIDATION_ERROR", "Invalid request path", null);
  const base = new URL(environment.NEXT_PUBLIC_API_BASE_URL);
  const url = new URL(`${base.pathname.replace(/\/$/u, "")}/${options.path.replace(/^\//u, "")}`, base.origin);
  const id = requestId();
  let attempt = 0;
  while (true) {
    try {
      return await oneAttempt(options, url.toString(), id);
    } catch (error) {
      if (!(error instanceof ApiError) || !retryable(options.method, error.status, error) || attempt >= 2) throw error;
      await delay((attempt + 1) * 1000, options.signal ?? new AbortController().signal);
      attempt += 1;
    }
  }
}
