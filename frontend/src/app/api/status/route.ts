import { loadServerEnvironment } from "@/lib/env/server"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  const environment = loadServerEnvironment()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const response = await fetch(`${environment.INTERNAL_API_BASE_URL}/health/ready`, {
      cache: "no-store",
      signal: controller.signal,
    })
    return Response.json({ frontend: "ok", backend: response.ok ? "ok" : "unavailable" }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return Response.json({ frontend: "ok", backend: "unavailable" }, { headers: { "Cache-Control": "no-store" } })
  } finally {
    clearTimeout(timer)
  }
}
