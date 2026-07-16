from dataclasses import dataclass
from typing import cast

import httpx


_OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


@dataclass(frozen=True, slots=True)
class WeatherEvidence:
    available: bool
    precipitation_mm: float | None
    current_precipitation_mm: float | None
    temperature_c: float | None
    score: float
    summary: str


def unavailable_weather() -> WeatherEvidence:
    return WeatherEvidence(
        available=False,
        precipitation_mm=None,
        current_precipitation_mm=None,
        temperature_c=None,
        score=0.5,
        summary="Weather context was unavailable, so the validation score uses image evidence only.",
    )


async def fetch_weather(latitude: float, longitude: float) -> WeatherEvidence:
    params: dict[str, str | int | float] = {
        "latitude": latitude,
        "longitude": longitude,
        "past_days": 2,
        "forecast_days": 1,
        "daily": "precipitation_sum",
        "current": "temperature_2m,precipitation",
        "timezone": "auto",
    }
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=False) as client:
            response = await client.get(_OPEN_METEO_FORECAST_URL, params=params)
            response.raise_for_status()
            body = response.json()
    except (httpx.HTTPError, ValueError):
        return unavailable_weather()

    if not isinstance(body, dict):
        return unavailable_weather()
    daily = body.get("daily")
    current = body.get("current")
    if not isinstance(daily, dict) or not isinstance(current, dict):
        return unavailable_weather()
    precipitation_values = daily.get("precipitation_sum")
    if not isinstance(precipitation_values, list) or len(precipitation_values) < 2:
        return unavailable_weather()
    try:
        recent_precipitation = sum(float(value) for value in precipitation_values[-3:])
        current_precipitation = float(cast(str | int | float, current["precipitation"]))
        temperature = float(cast(str | int | float, current["temperature_2m"]))
    except (KeyError, TypeError, ValueError):
        return unavailable_weather()
    if not all(value >= 0 for value in (recent_precipitation, current_precipitation)) or not -100 <= temperature <= 100:
        return unavailable_weather()

    score = _weather_score(recent_precipitation, current_precipitation, temperature)
    return WeatherEvidence(
        available=True,
        precipitation_mm=round(recent_precipitation, 2),
        current_precipitation_mm=round(current_precipitation, 2),
        temperature_c=round(temperature, 1),
        score=score,
        summary=(
            f"Weather check: {recent_precipitation:.1f} mm rain across the last two days and today; "
            f"current temperature {temperature:.1f}\N{DEGREE SIGN}C, current precipitation {current_precipitation:.1f} mm."
        ),
    )


def _weather_score(recent_precipitation: float, current_precipitation: float, temperature: float) -> float:
    if current_precipitation >= 0.1 or recent_precipitation >= 12:
        return 1.0
    if recent_precipitation >= 5:
        return 0.82
    if recent_precipitation >= 1:
        return 0.64
    if temperature >= 35:
        return 0.15
    if temperature >= 30:
        return 0.28
    return 0.45
