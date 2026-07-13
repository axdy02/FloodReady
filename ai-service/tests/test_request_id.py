from fastapi.testclient import TestClient


def test_request_id_is_preserved(client: TestClient) -> None:
    value = "10000000-0000-4000-8000-000000000001"
    response = client.get("/health", headers={"X-Request-Id": value})
    assert response.headers["X-Request-Id"] == value
    assert response.json()["requestId"] == value


def test_request_id_invalid_is_replaced(client: TestClient) -> None:
    response = client.get("/health", headers={"X-Request-Id": "invalid"})
    assert response.status_code == 200
    assert response.json()["requestId"] != "invalid"
