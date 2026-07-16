import { z } from "zod";

export const dynamic = "force-dynamic";

const providerSchema = z.object({
  timezone: z.string().min(1),
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    precipitation: z.number().nonnegative(),
    rain: z.number().nonnegative().optional(),
    weather_code: z.number().int()
  }).passthrough(),
  hourly: z.object({
    time: z.array(z.string()),
    precipitation: z.array(z.number().nonnegative()),
    temperature_2m: z.array(z.number())
  }).passthrough(),
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_sum: z.array(z.number().nonnegative()),
    precipitation_probability_max: z.array(z.number().min(0).max(100)),
    weather_code: z.array(z.number().int())
  }).passthrough()
}).passthrough();

const coordinate = (value: string | null, minimum: number, maximum: number): number | null => {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
};

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const latitude = coordinate(params.get("lat"), -85.051128, 85.051128);
  const longitude = coordinate(params.get("lng"), -180, 180);
  if (latitude === null || longitude === null) return Response.json({ message: "Valid latitude and longitude are required." }, { status: 400 });

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: "auto",
    past_days: "2",
    forecast_days: "7",
    current: "temperature_2m,precipitation,rain,weather_code",
    hourly: "temperature_2m,precipitation",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code"
  }).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!response.ok) return Response.json({ message: "Weather data is temporarily unavailable." }, { status: 502 });
    const weather = providerSchema.parse(await response.json());
    const currentIndex = Math.max(0, weather.hourly.time.findIndex((time) => time === weather.current.time));
    const startIndex = Math.max(0, currentIndex - 48);
    const recentPrecipitation = weather.hourly.precipitation.slice(startIndex, currentIndex + 1);
    let lastRainAt: string | null = null;
    for (let index = currentIndex; index >= startIndex; index -= 1) {
      if ((weather.hourly.precipitation[index] ?? 0) >= 0.1) { lastRainAt = weather.hourly.time[index] ?? null; break; }
    }
    const today = weather.current.time.slice(0, 10);
    const daily = weather.daily.time.map((date, index) => ({
      date,
      temperatureMaxC: weather.daily.temperature_2m_max[index] ?? null,
      temperatureMinC: weather.daily.temperature_2m_min[index] ?? null,
      precipitationMm: weather.daily.precipitation_sum[index] ?? 0,
      precipitationProbability: weather.daily.precipitation_probability_max[index] ?? 0,
      weatherCode: weather.daily.weather_code[index] ?? 0
    })).filter((day) => day.date >= today).slice(0, 7);
    return Response.json({
      location: { latitude, longitude, timezone: weather.timezone },
      current: {
        temperatureC: weather.current.temperature_2m,
        precipitationMm: weather.current.precipitation,
        weatherCode: weather.current.weather_code,
        isRaining: weather.current.precipitation > 0 || (weather.current.rain ?? 0) > 0
      },
      recent: { precipitationMm: recentPrecipitation.reduce((sum, value) => sum + value, 0), lastRainAt },
      forecast: daily,
      fetchedAt: new Date().toISOString()
    }, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch {
    return Response.json({ message: "Weather data could not be loaded." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
