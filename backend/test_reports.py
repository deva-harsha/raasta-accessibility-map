"""Small endpoint smoke test that never touches the real community report store."""

from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient
from PIL import Image

from backend import main


def run() -> None:
    with TemporaryDirectory() as temporary:
        root = Path(temporary)
        main.DATA_DIR = root / "data"
        main.UPLOAD_DIR = root / "uploads"
        main.REPORTS_FILE = main.DATA_DIR / "reports.json"
        main.DATA_DIR.mkdir()
        main.UPLOAD_DIR.mkdir()
        main.REPORTS_FILE.write_text("[]\n", encoding="utf-8")

        image_bytes = BytesIO()
        Image.new("RGB", (32, 32), "white").save(image_bytes, format="PNG")
        payload = {
            "location_label": "Endpoint Test Entrance",
            "latitude": "17.385",
            "longitude": "78.4867",
            "mobility_profile": "wheelchair",
            "verdict": "Likely passable",
            "condition": "Clear ramp",
            "confidence": "82",
            "reason": "The visible route appears clear.",
            "limitation": "Community decision support only.",
            "user_verified": "true",
            "user_confirmed_details": ["Ramp unavailable", "Other"],
            "user_note": "Side entrance was open during the visit.",
        }

        with TestClient(main.app) as client:
            assert client.get("/api/health").json() == {"status": "ok"}
            assert client.get("/api/reports").json() == []
            created_response = client.post(
                "/api/reports",
                data=payload,
                files={"image": ("test.png", image_bytes.getvalue(), "image/png")},
            )
            assert created_response.status_code == 201, created_response.text
            created = created_response.json()
            assert created["location_label"] == payload["location_label"]
            assert created["confirmation_count"] == 1
            assert created["user_confirmed_details"] == ["Ramp unavailable", "Other"]
            assert created["user_note"] == payload["user_note"]
            assert created["last_confirmed_at"] is None
            listed = client.get("/api/reports").json()
            assert len(listed) == 1
            assert listed[0]["id"] == created["id"]
            confirmed = client.post(f"/api/reports/{created['id']}/confirm")
            assert confirmed.status_code == 200, confirmed.text
            assert confirmed.json()["confirmation_count"] == 2
            assert confirmed.json()["last_confirmed_at"] is not None
            assert client.post("/api/reports/notfound/confirm").status_code == 404

        legacy = main.CommunityReport.model_validate({
            key: value for key, value in created.items()
            if key not in {"user_confirmed_details", "user_note", "last_confirmed_at"}
        })
        assert legacy.user_confirmed_details == []
        assert legacy.user_note is None
        assert legacy.last_confirmed_at is None

    print("backend import and report endpoint smoke test ok")


if __name__ == "__main__":
    run()
