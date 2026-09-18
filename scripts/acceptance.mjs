import { randomBytes } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const runId = `${Date.now()}-${randomBytes(6).toString("hex")}`
const runDir = resolve(root, ".acceptance", runId)
const envFile = resolve(runDir, "root.env")
const mode = process.argv[2] ?? "full"
const project = `floodready-m2-${runId}`
const allowed = new Set(["full", "--compose-only", "--e2e-only"])

const command = (executable, args, environment) => new Promise((resolvePromise, reject) => {
  const child = spawn(executable, args, { cwd: root, env: environment, stdio: "inherit", shell: false })
  child.once("error", reject)
  child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${executable} failed`)))
})

const main = async () => {
  if (!allowed.has(mode)) throw new Error("unsupported acceptance mode")
  const dbPassword = randomBytes(32).toString("base64url")
  const access = randomBytes(64).toString("base64url")
  const refresh = randomBytes(64).toString("base64url")
  const aiServiceToken = randomBytes(48).toString("base64url")
  const demoCitizen = randomBytes(24).toString("base64url")
  const demoModerator = randomBytes(24).toString("base64url")
  const demoAdmin = randomBytes(24).toString("base64url")
  const values = {
    POSTGRES_DB: "floodready", POSTGRES_USER: "floodready", POSTGRES_PASSWORD: dbPassword,
    DATABASE_URL: `postgresql://floodready:${dbPassword}@db:5432/floodready`, DB_POOL_MAX: "10", DB_CONNECTION_TIMEOUT_MS: "2000", DB_IDLE_TIMEOUT_MS: "10000", DB_QUERY_TIMEOUT_MS: "5000", ACCESS_TOKEN_SECRET: access, REFRESH_TOKEN_SECRET: refresh, ACCESS_TOKEN_TTL: "15m", REFRESH_TOKEN_TTL: "30d", JWT_ISSUER: "floodready", JWT_AUDIENCE: "floodready-api", PUBLIC_API_ORIGIN: "http://localhost:3001", CORS_ORIGINS: "http://localhost:3000", COOKIE_DOMAIN: "", MAX_UPLOAD_SIZE_MB: "10", MAX_IMAGE_PIXELS: "20000000", UPLOAD_PROCESSING_CONCURRENCY: "2", UPLOAD_QUEUE_MAX: "8", JSON_BODY_LIMIT_KB: "100", RATE_LIMIT_WINDOW_MS: "900000", RATE_LIMIT_MAX_REQUESTS: "100", AUTH_RATE_LIMIT_WINDOW_MS: "900000", AUTH_RATE_LIMIT_MAX_REQUESTS: "20", REPORT_RATE_LIMIT_WINDOW_MS: "3600000", REPORT_RATE_LIMIT_MAX_REQUESTS: "10", LOGIN_FAILURE_WINDOW_MS: "900000", LOGIN_FAILURE_MAX: "5", LOGIN_LOCK_MS: "900000", TRUST_PROXY_HOPS: "0", SHUTDOWN_TIMEOUT_MS: "10000", LOG_LEVEL: "info", AI_SERVICE_BASE_URL: "http://ai-service:8000", AI_SERVICE_TOKEN: aiServiceToken, AI_SERVICE_TIMEOUT_MS: "8000",
    FRONTEND_ENV: "local", NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001/api/v1", INTERNAL_API_BASE_URL: "http://backend:3000/api/v1", NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000", NEXT_PUBLIC_MAP_STYLE_URL: "https://tiles.openfreemap.org/styles/liberty", NEXT_PUBLIC_MAP_ATTRIBUTION: "OpenFreeMap | OpenStreetMap contributors", NEXT_PUBLIC_MAP_CONNECT_ORIGINS: "https://tiles.openfreemap.org", NEXT_PUBLIC_MAP_IMAGE_ORIGINS: "https://tiles.openfreemap.org", NEXT_PUBLIC_DEFAULT_MAP_LATITUDE: "28.33505", NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE: "77.05345", NEXT_PUBLIC_DEFAULT_MAP_ZOOM: "10", NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB: "10", AI_ENV: "development", AI_HOST: "0.0.0.0", AI_PORT: "8000", AI_LOG_LEVEL: "info", AI_TRUSTED_HOSTS: "localhost,127.0.0.1,ai-service", AI_BODY_LIMIT_BYTES: "12582912", AI_SHUTDOWN_TIMEOUT_SECONDS: "10", AI_PROVIDER: "gemini", AI_PROVIDER_BASE_URL: "https://generativelanguage.googleapis.com/v1beta", AI_PROVIDER_API_KEY: "", AI_MODEL: "gemini-3.1-flash-lite", AI_MODEL_VERSION: "gemini-3.1-flash-lite", AI_PROVIDER_TIMEOUT_SECONDS: "8", AI_MAX_IMAGE_BYTES: "10485760", AI_MAX_IMAGE_PIXELS: "20000000", AI_MAX_IMAGE_DIMENSION: "1024", DEMO_SEED_ENABLED: mode === "full" ? "false" : "true", DEMO_CITIZEN_PASSWORD: demoCitizen, DEMO_MODERATOR_PASSWORD: demoModerator, DEMO_ADMIN_PASSWORD: demoAdmin
  }
  await mkdir(runDir, { recursive: true })
  await writeFile(envFile, `${Object.entries(values).map(([name, value]) => `${name}=${value}`).join("\n")}\n`, { mode: 0o600 })
  const environment = { Path: process.env.Path ?? "", SystemRoot: process.env.SystemRoot ?? "", ProgramFiles: process.env.ProgramFiles ?? "", ProgramData: process.env.ProgramData ?? "", USERPROFILE: process.env.USERPROFILE ?? "", DOCKER_CONFIG: process.env.DOCKER_CONFIG ?? "" }
  await command(process.execPath, [resolve(root, "scripts/check-source.mjs")], environment)
  await command(process.execPath, [resolve(root, "scripts/verify-compose.mjs"), "--env-file", envFile], environment)
  await command("docker", ["compose", "--project-name", project, "--env-file", envFile, "config", "--quiet"], environment)
  await command("docker", ["compose", "--project-name", project, "--env-file", envFile, "build", "--pull", "--no-cache"], environment)
  await command("docker", ["compose", "--project-name", project, "--env-file", envFile, "up", "--detach", "--wait", "--wait-timeout", "180", "db"], environment)
  await command("docker", ["compose", "--project-name", project, "--env-file", envFile, "run", "--rm", "--no-deps", "migrate"], environment)
  await command("docker", ["compose", "--project-name", project, "--env-file", envFile, "up", "--detach", "--no-deps", "--wait", "--wait-timeout", "180", "backend", "ai-service", "frontend"], environment)
  if (mode !== "full") await command("docker", ["compose", "--project-name", project, "--env-file", envFile, "--profile", "demo", "run", "--rm", "--no-deps", "demo-seed"], environment)
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "acceptance failed"}\n`); process.exitCode = 1 }).finally(async () => {
  const environment = { Path: process.env.Path ?? "", SystemRoot: process.env.SystemRoot ?? "", ProgramFiles: process.env.ProgramFiles ?? "", ProgramData: process.env.ProgramData ?? "", USERPROFILE: process.env.USERPROFILE ?? "", DOCKER_CONFIG: process.env.DOCKER_CONFIG ?? "" }
  await command("docker", ["compose", "--project-name", project, "--env-file", envFile, "down", "--volumes", "--remove-orphans"], environment).catch(() => undefined)
  await rm(runDir, { recursive: true, force: true })
})
