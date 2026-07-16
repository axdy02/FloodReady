import { randomUUID } from "node:crypto"

const writeFlow = process.argv.includes("--write-flow")
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL
const frontendUrl = process.env.FRONTEND_URL ?? "http://127.0.0.1:3000"
const aiUrl = process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8000"
const latitude = Number(process.env.NEXT_PUBLIC_DEFAULT_MAP_LATITUDE)
const longitude = Number(process.env.NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE)

function required(name, value) {
  if (value === undefined || value.trim() === "") throw new Error(`${name} is required`)
  return value
}

async function jsonRequest(url, options = {}) {
  const headers = new Headers(options.headers)
  headers.set("Accept", "application/json")
  headers.set("X-Request-Id", randomUUID())
  const response = await fetch(url, { ...options, headers })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`${url} returned ${response.status}: ${JSON.stringify(body)}`)
  return body
}

async function health(name, url) {
  await jsonRequest(url)
  process.stdout.write(`PASS ${name}: ${url}\n`)
}

async function verifyWriteFlow() {
  const configuredEmail = process.env.M2_DEMO_EMAIL?.trim() || undefined
  const configuredPassword = process.env.M2_DEMO_PASSWORD?.trim() === "" ? undefined : process.env.M2_DEMO_PASSWORD
  if ((configuredEmail === undefined) !== (configuredPassword === undefined)) throw new Error("M2_DEMO_EMAIL and M2_DEMO_PASSWORD must be supplied together")
  const email = configuredEmail ?? `m2-preflight-${randomUUID()}@example.com`
  const password = configuredPassword ?? `${randomUUID()}!Aa1`
  if (configuredEmail === undefined) {
    await jsonRequest(`${apiBase}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Milestone 2 Preflight", email, password }),
    })
    process.stdout.write("PASS registered isolated preflight user\n")
  }
  const login = await jsonRequest(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const token = login?.data?.accessToken
  if (typeof token !== "string" || token.length === 0) throw new Error("Login did not return an access token")

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
  const form = new FormData()
  form.append("category", "FLOODED_ROAD")
  form.append("description", "Milestone 2 preflight report at the configured map point.")
  form.append("severityClaim", "MODERATE")
  form.append("latitude", String(latitude))
  form.append("longitude", String(longitude))
  form.append("locationSource", "MANUAL")
  form.append("capturedAt", new Date().toISOString())
  form.append("image", new Blob([png], { type: "image/png" }), "milestone2-preflight.png")
  const created = await jsonRequest(`${apiBase}/reports`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form })
  const reportId = created?.data?.id
  if (typeof reportId !== "string") throw new Error("Report creation did not return an ID")

  const bounds = new URLSearchParams({
    west: String(longitude - 0.2),
    south: String(latitude - 0.2),
    east: String(longitude + 0.2),
    north: String(latitude + 0.2),
    limit: "100",
    sort: "desc",
  })
  const map = await jsonRequest(`${apiBase}/reports/map?${bounds}`, { headers: { Authorization: `Bearer ${token}` } })
  const marker = map?.data?.items?.find((item) => item.id === reportId)
  if (marker === undefined || marker.latitude !== latitude || marker.longitude !== longitude) throw new Error("Created report was not returned as the matching map marker")
  process.stdout.write(`PASS persisted report -> map marker: ${reportId}\n`)
}

async function main() {
  required("NEXT_PUBLIC_API_BASE_URL", apiBase)
  if (!Number.isFinite(latitude) || latitude < -85.051128 || latitude > 85.051128) throw new Error("NEXT_PUBLIC_DEFAULT_MAP_LATITUDE is invalid")
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE is invalid")
  await health("frontend", `${frontendUrl}/api/health`)
  await health("backend", `${apiBase}/health/ready`)
  await health("AI service (health-only; triage disabled)", `${aiUrl}/health/ready`)
  if (writeFlow) await verifyWriteFlow()
  else process.stdout.write("SKIP write/read flow: rerun with --write-flow (optional M2_DEMO_EMAIL/M2_DEMO_PASSWORD)\n")
  process.stdout.write("Milestone 2 preflight complete.\n")
}

main().catch((error) => {
  process.stderr.write(`FAIL ${error instanceof Error ? error.message : "Unknown preflight failure"}\n`)
  process.exitCode = 1
})
