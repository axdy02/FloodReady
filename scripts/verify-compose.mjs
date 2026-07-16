import { readFile } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const names = [
  "FRONTEND_ENV",
  "NEXT_PUBLIC_API_BASE_URL",
  "INTERNAL_API_BASE_URL",
  "NEXT_PUBLIC_APP_ORIGIN",
  "NEXT_PUBLIC_MAP_STYLE_URL",
  "NEXT_PUBLIC_MAP_ATTRIBUTION",
  "NEXT_PUBLIC_MAP_CONNECT_ORIGINS",
  "NEXT_PUBLIC_MAP_IMAGE_ORIGINS",
  "NEXT_PUBLIC_DEFAULT_MAP_LATITUDE",
  "NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE",
  "NEXT_PUBLIC_DEFAULT_MAP_ZOOM",
  "NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB",
  "AI_SERVICE_BASE_URL",
  "AI_SERVICE_TOKEN",
  "AI_SERVICE_TIMEOUT_MS",
  "AI_PROVIDER",
  "AI_PROVIDER_BASE_URL",
  "AI_PROVIDER_API_KEY",
  "AI_MODEL",
  "AI_MODEL_VERSION",
  "AI_PROVIDER_TIMEOUT_SECONDS",
  "AI_MAX_IMAGE_BYTES",
  "AI_MAX_IMAGE_PIXELS",
  "AI_MAX_IMAGE_DIMENSION",
  "AI_BODY_LIMIT_BYTES",
]

const requireUrl = (value, description) => {
  const parsed = new URL(value)
  if (parsed.username !== "" || parsed.password !== "" || parsed.hash !== "") throw new Error(`invalid ${description}`)
  return parsed
}

const requireOriginList = (value, description) => {
  const entries = value.split(",").map((entry) => entry.trim())
  if (entries.length === 0 || entries.some((entry) => {
    const parsed = requireUrl(entry, description)
    return parsed.origin !== entry || parsed.search !== "" || parsed.pathname !== "/"
  }) || new Set(entries).size !== entries.length) throw new Error(`invalid ${description}`)
  return entries
}

const parse = (source, requireFinalLf = true) => {
  const values = new Map()
  const lines = source.split("\n")
  if (requireFinalLf && !source.endsWith("\n")) throw new Error("environment file must end with LF")
  const contentLines = source.endsWith("\n") ? lines.slice(0, -1) : lines
  for (const sourceLine of contentLines) {
    const line = sourceLine.endsWith("\r") ? sourceLine.slice(0, -1) : sourceLine
    const separator = line.indexOf("=")
    const candidateName = separator > 0 ? line.slice(0, separator) : ""
    const candidateValue = separator > 0 ? line.slice(separator + 1) : ""
    if (line.length === 0 || !/^[A-Z0-9_]+$/u.test(candidateName) || /[#$\\"]/u.test(candidateValue)) throw new Error(`invalid environment grammar: ${line}`)
    const name = candidateName
    if (values.has(name)) throw new Error("duplicate environment name")
    values.set(name, line.slice(separator + 1))
  }
  return values
}

const main = async () => {
  const argument = process.argv[2]
  if (process.argv.length !== 4 || argument !== "--env-file") throw new Error("expected --env-file <path>")
  const requested = process.argv[3]
  if (requested === undefined) throw new Error("missing environment path")
  const file = requested === ".env" || requested === ".env.example" ? resolve(root, requested) : isAbsolute(requested) ? requested : (() => { throw new Error("environment path must be absolute, .env, or .env.example") })()
  const values = parse(await readFile(file, "utf8"))
  for (const name of names) if (!values.has(name)) throw new Error(`missing environment value: ${name}`)
  for (const name of names.filter((name) => name !== "AI_PROVIDER_API_KEY")) {
    if (values.get(name) === "") throw new Error(`empty environment value: ${name}`)
  }
  if (values.get("FRONTEND_ENV") !== "local") throw new Error("Compose frontend environment must be local")
  const publicApi = requireUrl(values.get("NEXT_PUBLIC_API_BASE_URL"), "public API URL")
  const internalApi = requireUrl(values.get("INTERNAL_API_BASE_URL"), "internal API URL")
  const appOrigin = requireUrl(values.get("NEXT_PUBLIC_APP_ORIGIN"), "app origin")
  if (publicApi.href !== "http://localhost:3001/api/v1" || internalApi.href !== "http://backend:3000/api/v1" || appOrigin.origin !== appOrigin.href.slice(0, -1) || appOrigin.href !== "http://localhost:3000/") throw new Error("invalid Compose frontend routing")
  const style = requireUrl(values.get("NEXT_PUBLIC_MAP_STYLE_URL"), "map style URL")
  const connectOrigins = requireOriginList(values.get("NEXT_PUBLIC_MAP_CONNECT_ORIGINS"), "map connect origins")
  requireOriginList(values.get("NEXT_PUBLIC_MAP_IMAGE_ORIGINS"), "map image origins")
  if (style.protocol !== "https:" || !connectOrigins.includes(style.origin)) throw new Error("map style origin is not allowed")
  const latitude = Number(values.get("NEXT_PUBLIC_DEFAULT_MAP_LATITUDE"))
  const longitude = Number(values.get("NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE"))
  const zoom = Number(values.get("NEXT_PUBLIC_DEFAULT_MAP_ZOOM"))
  const uploadSize = Number(values.get("NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB"))
  if (!Number.isFinite(latitude) || latitude < -85.051128 || latitude > 85.051128 || !Number.isFinite(longitude) || longitude < -179.98 || longitude > 179.98 || !Number.isFinite(zoom) || zoom < 1 || zoom > 18) throw new Error("invalid default map position")
  if (!Number.isInteger(uploadSize) || uploadSize < 1 || uploadSize > 20) throw new Error("invalid upload size")
  const aiService = requireUrl(values.get("AI_SERVICE_BASE_URL"), "AI service URL")
  if (aiService.href !== "http://ai-service:8000/") throw new Error("invalid internal AI service URL")
  const aiServiceToken = values.get("AI_SERVICE_TOKEN")
  if (!/^[A-Za-z0-9_-]{43,256}$/u.test(aiServiceToken)) throw new Error("invalid AI service token")
  const aiServiceTimeout = Number(values.get("AI_SERVICE_TIMEOUT_MS"))
  const aiProviderTimeout = Number(values.get("AI_PROVIDER_TIMEOUT_SECONDS"))
  if (!Number.isInteger(aiServiceTimeout) || aiServiceTimeout < 1_000 || aiServiceTimeout > 30_000) throw new Error("invalid AI service timeout")
  if (!Number.isInteger(aiProviderTimeout) || aiProviderTimeout < 1 || aiProviderTimeout > 30) throw new Error("invalid AI provider timeout")
  const provider = values.get("AI_PROVIDER")
  if (provider !== "disabled" && provider !== "gemini") throw new Error("invalid AI provider")
  const providerBase = requireUrl(values.get("AI_PROVIDER_BASE_URL"), "AI provider URL")
  if (providerBase.protocol !== "https:" || providerBase.search !== "") throw new Error("invalid AI provider URL")
  if (provider === "gemini" && (providerBase.origin !== "https://generativelanguage.googleapis.com" || !values.get("AI_MODEL")?.startsWith("gemini-"))) throw new Error("invalid Gemini provider configuration")
  const aiMaxImageBytes = Number(values.get("AI_MAX_IMAGE_BYTES"))
  const aiMaxImagePixels = Number(values.get("AI_MAX_IMAGE_PIXELS"))
  const aiMaxImageDimension = Number(values.get("AI_MAX_IMAGE_DIMENSION"))
  const aiBodyLimit = Number(values.get("AI_BODY_LIMIT_BYTES"))
  if (!Number.isInteger(aiMaxImageBytes) || aiMaxImageBytes < 1_048_576 || aiMaxImageBytes > 20 * 1_048_576) throw new Error("invalid AI image byte limit")
  if (!Number.isInteger(aiMaxImagePixels) || aiMaxImagePixels < 1_000_000 || aiMaxImagePixels > 25_000_000) throw new Error("invalid AI image pixel limit")
  if (!Number.isInteger(aiMaxImageDimension) || aiMaxImageDimension < 256 || aiMaxImageDimension > 4096) throw new Error("invalid AI image dimension limit")
  if (!Number.isInteger(aiBodyLimit) || aiBodyLimit <= aiMaxImageBytes || aiBodyLimit > 25 * 1_048_576) throw new Error("invalid AI request body limit")
  if (values.get("DATABASE_URL") !== undefined && values.get("DATABASE_URL") !== "") {
    const databaseUrl = new URL(values.get("DATABASE_URL"))
    if (databaseUrl.protocol !== "postgresql:" || databaseUrl.hostname !== "db" || databaseUrl.port !== "5432" || databaseUrl.search !== "" || databaseUrl.hash !== "") throw new Error("invalid database URL")
  }
  process.stdout.write("compose environment valid\n")
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "compose verification failed"}\n`); process.exitCode = 1 })
