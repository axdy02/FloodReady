import { z } from "zod";

export const dynamic = "force-dynamic";

const providerResultSchema = z.object({
  display_name: z.string().min(1),
  lat: z.string(),
  lon: z.string()
}).passthrough();

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 160) return Response.json({ message: "Enter an area name with at least two characters." }, { status: 400 });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "1", addressdetails: "0" }).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "FloodReady local project (local@floodready.invalid)" },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return Response.json({ message: "Area search is temporarily unavailable." }, { status: 502 });
    const first = z.array(providerResultSchema).parse(await response.json())[0];
    if (first === undefined) return Response.json({ message: "No matching area was found." }, { status: 404 });
    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -85.051128 || latitude > 85.051128 || longitude < -180 || longitude > 180) return Response.json({ message: "The area search returned invalid coordinates." }, { status: 502 });
    return Response.json({ name: first.display_name, latitude, longitude }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    return Response.json({ message: "Area search could not be completed." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
