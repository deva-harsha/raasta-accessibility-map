from functools import lru_cache
from io import BytesIO
import json
from pathlib import Path
from threading import Lock
from typing import Annotated, Any, Literal
from uuid import uuid4
from datetime import datetime, timezone

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field


MODEL_NAME = "openai/clip-vit-base-patch32"
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
LOW_CONFIDENCE_THRESHOLD = 0.40

MobilityProfile = Literal["wheelchair", "crutches", "stroller", "elderly"]
Verdict = Literal[
    "Likely passable",
    "Temporary obstruction",
    "Not passable",
    "Manual verification needed",
]
UserConfirmedDetail = Literal[
    "Stairs present",
    "Ramp unavailable",
    "Lift unavailable",
    "Narrow entrance",
    "Uneven surface",
    "Temporary obstruction",
    "Other",
]

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
REPORTS_FILE = DATA_DIR / "reports.json"
REPORTS_LOCK = Lock()

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
if not REPORTS_FILE.exists():
    REPORTS_FILE.write_text("[]\n", encoding="utf-8")

CANDIDATES = [
    ("stairs", "an entrance with stairs and no wheelchair ramp"),
    ("clear_ramp", "a clear wheelchair ramp"),
    ("blocked_ramp", "a wheelchair ramp blocked by a vehicle or object"),
    ("blocked_path", "a footpath blocked by an obstacle"),
    ("clear_path", "a clear accessible footpath"),
    ("unclear", "an unclear outdoor entrance or footpath"),
]

CONDITION_LABELS = {
    "stairs": "Stairs without a visible ramp",
    "clear_ramp": "Clear ramp",
    "blocked_ramp": "Blocked ramp",
    "blocked_path": "Blocked footpath",
    "clear_path": "Clear footpath",
    "unclear": "Unclear entrance or footpath",
}

VERDICTS = {
    "stairs": "Not passable",
    "clear_ramp": "Likely passable",
    "blocked_ramp": "Temporary obstruction",
    "blocked_path": "Temporary obstruction",
    "clear_path": "Likely passable",
    "unclear": "Manual verification needed",
}

REASONS = {
    "stairs": "The image most closely matches stairs without a visible wheelchair ramp.",
    "clear_ramp": "The image most closely matches a ramp that appears clear in the visible area.",
    "blocked_ramp": "The image most closely matches a ramp obstructed by a vehicle or object.",
    "blocked_path": "The image most closely matches a footpath with a visible obstacle.",
    "clear_path": "The image most closely matches a footpath that appears clear in the visible area.",
    "unclear": "The scene does not provide a clear view of a recognizable entrance, ramp, or footpath.",
}

PROFILE_NOTES = {
    "wheelchair": (
        "Check the full route for ramp continuity, usable width, surface gaps, kerbs, and room to turn."
    ),
    "crutches": (
        "Check for handrails, stable footing, resting points, and wet or uneven surfaces that could cause a slip."
    ),
    "stroller": (
        "Check for kerbs, narrow gaps, steps, and enough space to turn or safely lift the stroller if needed."
    ),
    "elderly": (
        "Check for handrails, even ground, adequate lighting, resting places, and trip or slip hazards."
    ),
}

LIMITATION = (
    "Decision support only—not an accessibility certification. A single photo and a general-purpose "
    "vision model can miss slope, width, surface, temporary hazards, and barriers outside the frame. "
    "Verify uncertain situations before proceeding."
)


class AnalysisResponse(BaseModel):
    verdict: str
    condition: str
    confidence: int
    reason: str
    profile_note: str
    limitation: str


class CommunityReport(BaseModel):
    id: str
    location_label: str
    latitude: float
    longitude: float
    mobility_profile: MobilityProfile
    verdict: Verdict
    condition: str
    confidence: int
    reason: str
    limitation: str
    image_url: str
    created_at: datetime
    confirmation_count: int
    user_confirmed_details: list[UserConfirmedDetail] = Field(default_factory=list)
    user_note: str | None = None
    last_confirmed_at: datetime | None = None


app = FastAPI(title="Raasta local analysis API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@lru_cache(maxsize=1)
def get_clip() -> tuple[Any, Any, Any]:
    """Load the model once, on the first analysis request."""
    import torch
    from transformers import CLIPModel, CLIPProcessor

    processor = CLIPProcessor.from_pretrained(MODEL_NAME)
    model = CLIPModel.from_pretrained(MODEL_NAME)
    model.eval()
    return model, processor, torch


def decode_image(data: bytes) -> Image.Image:
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large. Use an image smaller than 12 MB.")

    try:
        Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
        with Image.open(BytesIO(data)) as source:
            source.verify()
        with Image.open(BytesIO(data)) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.load()
            return image
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(
            status_code=400,
            detail="The file is not a valid supported image, or its dimensions are too large.",
        ) from exc


def read_reports() -> list[CommunityReport]:
    try:
        raw = json.loads(REPORTS_FILE.read_text(encoding="utf-8"))
        if not isinstance(raw, list):
            raise ValueError("Report store must contain a list.")
        return [CommunityReport.model_validate(item) for item in raw]
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail="The local community report store could not be read.",
        ) from exc


def write_reports(reports: list[CommunityReport]) -> None:
    temporary = REPORTS_FILE.with_suffix(".tmp")
    try:
        payload = [report.model_dump(mode="json") for report in reports]
        temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        temporary.replace(REPORTS_FILE)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="The community report could not be saved locally.",
        ) from exc


def clean_text(value: str, field: str, maximum: int) -> str:
    cleaned = " ".join(value.split()).strip()
    if not cleaned:
        raise HTTPException(status_code=422, detail=f"{field} is required.")
    if len(cleaned) > maximum:
        raise HTTPException(status_code=422, detail=f"{field} must be {maximum} characters or fewer.")
    return cleaned


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(
    image: Annotated[UploadFile, File(description="Entrance or path image")],
    mobility_profile: Annotated[MobilityProfile, Form()],
) -> AnalysisResponse:
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")

    uploaded = await image.read(MAX_IMAGE_BYTES + 1)
    await image.close()
    pil_image = decode_image(uploaded)

    try:
        model, processor, torch_module = get_clip()
        inputs = processor(
            text=[description for _, description in CANDIDATES],
            images=pil_image,
            return_tensors="pt",
            padding=True,
        )
        with torch_module.inference_mode():
            logits = model(**inputs).logits_per_image[0]
            probabilities = logits.softmax(dim=0)
        best_index = int(probabilities.argmax().item())
        confidence = float(probabilities[best_index].item())
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Local vision analysis failed. Confirm that the CLIP model is available, "
                "then try again. The first run requires downloading the model."
            ),
        ) from exc

    condition_key = CANDIDATES[best_index][0]
    if confidence < LOW_CONFIDENCE_THRESHOLD:
        return AnalysisResponse(
            verdict="Manual verification needed",
            condition="Low-confidence visual match",
            confidence=round(confidence * 100),
            reason=(
                f"The strongest match was {CONDITION_LABELS[condition_key].lower()}, "
                "but the model was not confident enough for a directional result."
            ),
            profile_note=PROFILE_NOTES[mobility_profile],
            limitation=LIMITATION,
        )

    return AnalysisResponse(
        verdict=VERDICTS[condition_key],
        condition=CONDITION_LABELS[condition_key],
        confidence=round(confidence * 100),
        reason=REASONS[condition_key],
        profile_note=PROFILE_NOTES[mobility_profile],
        limitation=LIMITATION,
    )


@app.get("/api/reports", response_model=list[CommunityReport])
def list_reports() -> list[CommunityReport]:
    with REPORTS_LOCK:
        reports = read_reports()
    return sorted(reports, key=lambda report: report.created_at, reverse=True)


@app.post("/api/reports", response_model=CommunityReport, status_code=201)
async def create_report(
    image: Annotated[UploadFile, File(description="Verified report image")],
    location_label: Annotated[str, Form()],
    latitude: Annotated[float, Form(ge=-90, le=90)],
    longitude: Annotated[float, Form(ge=-180, le=180)],
    mobility_profile: Annotated[MobilityProfile, Form()],
    verdict: Annotated[Verdict, Form()],
    condition: Annotated[str, Form()],
    confidence: Annotated[int, Form(ge=0, le=100)],
    reason: Annotated[str, Form()],
    limitation: Annotated[str, Form()],
    user_verified: Annotated[bool, Form()],
    user_confirmed_details: Annotated[list[UserConfirmedDetail] | None, Form()] = None,
    user_note: Annotated[str | None, Form()] = None,
) -> CommunityReport:
    if not user_verified:
        raise HTTPException(
            status_code=422,
            detail="Confirm that you checked the location before publishing.",
        )
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload the analyzed image.")

    uploaded = await image.read(MAX_IMAGE_BYTES + 1)
    await image.close()
    pil_image = decode_image(uploaded)

    report_id = uuid4().hex
    filename = f"{report_id}.jpg"
    image_path = UPLOAD_DIR / filename
    try:
        pil_image.save(image_path, format="JPEG", quality=88, optimize=True)
    except OSError as exc:
        raise HTTPException(status_code=500, detail="The report image could not be saved.") from exc

    report = CommunityReport(
        id=report_id,
        location_label=clean_text(location_label, "Location label", 120),
        latitude=latitude,
        longitude=longitude,
        mobility_profile=mobility_profile,
        verdict=verdict,
        condition=clean_text(condition, "Condition", 160),
        confidence=confidence,
        reason=clean_text(reason, "Reason", 700),
        limitation=clean_text(limitation, "Limitation", 900),
        image_url=f"/uploads/{filename}",
        created_at=datetime.now(timezone.utc),
        confirmation_count=1,
        user_confirmed_details=list(dict.fromkeys(user_confirmed_details or [])),
        user_note=clean_text(user_note, "User note", 280) if user_note else None,
        last_confirmed_at=None,
    )

    try:
        with REPORTS_LOCK:
            reports = read_reports()
            reports.append(report)
            write_reports(reports)
    except HTTPException:
        image_path.unlink(missing_ok=True)
        raise
    return report


@app.post("/api/reports/{report_id}/confirm", response_model=CommunityReport)
def confirm_report(report_id: str) -> CommunityReport:
    if not report_id or len(report_id) > 64 or not report_id.isalnum():
        raise HTTPException(status_code=400, detail="Invalid report identifier.")

    with REPORTS_LOCK:
        reports = read_reports()
        for index, report in enumerate(reports):
            if report.id == report_id:
                updated = report.model_copy(
                    update={
                        "confirmation_count": report.confirmation_count + 1,
                        "last_confirmed_at": datetime.now(timezone.utc),
                    }
                )
                reports[index] = updated
                write_reports(reports)
                return updated
    raise HTTPException(status_code=404, detail="Community report not found.")
