from app.services.weather import _weather_score, unavailable_weather


def test_weather_score_rewards_rain_and_penalizes_hot_dry_conditions() -> None:
    assert _weather_score(15.0, 0.0, 26.0) == 1.0
    assert _weather_score(0.0, 0.2, 32.0) == 1.0
    assert _weather_score(5.0, 0.0, 30.0) == 0.82
    assert _weather_score(0.0, 0.0, 37.0) == 0.15


def test_unavailable_weather_keeps_a_neutral_image_only_context() -> None:
    evidence = unavailable_weather()
    assert evidence.available is False
    assert evidence.precipitation_mm is None
    assert evidence.temperature_c is None
    assert evidence.score == 0.5
