"""Smoke tests for lightweight health checks and contained model failures."""

from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from backend import main


def image_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (32, 32), "white").save(buffer, format="PNG")
    return buffer.getvalue()


def run() -> None:
    with TestClient(main.app) as client:
        cache_before = main._load_clip.cache_info()
        assert client.get("/api/health").json() == {"status": "ok"}
        assert main._load_clip.cache_info() == cache_before

        original_get_clip = main.get_clip

        def failed_model_load():
            raise RuntimeError("simulated model load failure")

        main.get_clip = failed_model_load
        try:
            response = client.post(
                "/api/analyze",
                data={"mobility_profile": "wheelchair"},
                files={"image": ("entrance.png", image_bytes(), "image/png")},
            )
        finally:
            main.get_clip = original_get_clip

        assert response.status_code == 503, response.text
        assert response.headers["content-type"].startswith("application/json")
        assert "vision analysis failed" in response.json()["detail"].lower()
        assert client.get("/api/health").status_code == 200

    print("health isolation and analysis failure smoke test ok")


if __name__ == "__main__":
    run()
