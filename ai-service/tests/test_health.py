from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["data"] == {"status": "ok"}


def test_ready(client: TestClient) -> None:
    assert client.get("/health/ready").json()["data"] == {"status": "ready", "provider": "degraded"}
