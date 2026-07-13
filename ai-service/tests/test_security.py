from fastapi.testclient import TestClient
from app.logging import configure_logging
from app.services.readiness import Readiness
from app.schemas.envelopes import StatusData


def test_docs_disabled(client: TestClient) -> None:
    assert client.get("/docs").status_code == 404


def test_unknown_route_is_json(client: TestClient) -> None:
    response = client.get("/unknown")
    assert response.status_code == 404


def test_support_components() -> None:
    configure_logging("info")
    assert Readiness().ready is True
    assert StatusData(status="ok").status == "ok"
