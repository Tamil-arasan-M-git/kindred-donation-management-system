
import io
import logging
import time
import uuid
from collections import defaultdict

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Depends,
    HTTPException
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.datastructures import Headers

from pydantic import BaseModel

from sqlalchemy.orm import Session

from PIL import Image

from ultralytics import YOLO, YOLOWorld

from db import (
    get_db,
    Donor,
    ItemSubmission,
    ItemSubmissionLine
)
from api_v2 import router as milestone2_router
from config import CORS_ALLOWED_ORIGINS, CUSTOM_MODEL_PATH, MAX_UPLOAD_BYTES, USE_CUSTOM_MODEL


# ============================================================
# FASTAPI
# ============================================================

logger = logging.getLogger("kindred.backend")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Donation Platform API",
    version="1.0.0"
)
app.include_router(milestone2_router)


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    logger.warning("HTTP %s for %s: %s", exc.status_code, request.url.path, exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    logger.exception("Unhandled exception for %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.middleware("http")
async def log_requests(request, call_next):
    started_at = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        message = f"{request.method} {request.url.path} -> 500 ({elapsed_ms:.1f} ms)"
        logger.exception(message)
        print(message, flush=True)
        raise
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    message = f"{request.method} {request.url.path} -> {response.status_code} ({elapsed_ms:.1f} ms)"
    logger.info(message)
    print(message, flush=True)
    return response


# ============================================================
# MODEL CONFIG  <<< THIS IS THE ONLY SECTION YOU EDIT LATER >>>
# ------------------------------------------------------------
# USE_CUSTOM_MODEL = False  -> today's setup: pretrained YOLO-World,
#                              zero-shot, driven by DETECTION_CLASSES below.
# USE_CUSTOM_MODEL = True   -> your own fine-tuned model (from
#                              build_and_train.py / train.py). It already
#                              knows the 6 real categories directly, so no
#                              text-class list or CATEGORY_MAP is needed —
#                              detected_name IS the category name.
#
# TO SWITCH LATER:
#   1. Flip USE_CUSTOM_MODEL to True below.
#   2. Set CUSTOM_MODEL_PATH to your best.pt
#      (e.g. "runs/detect/donation_items_yolov8n/weights/best.pt").
#   3. That's it — nothing else in this file needs to change.
# ============================================================

DETECTION_CLASSES = [
    "book",
    "shirt", "pants", "dress", "shoe",
    "bottle", "water bottle",
    "laptop", "mobile phone", "cell phone",
    "bag", "backpack", "handbag",
    "chair", "table", "sofa",
    "cup", "plate", "bowl",
    "utensil",
    "food",
]

CATEGORY_MAP = {
    "book": "books",
    "shirt": "clothing", "pants": "clothing", "dress": "clothing", "shoe": "clothing",
    "food": "food",
    "laptop": "electronics", "mobile phone": "electronics", "cell phone": "electronics",
    "chair": "furniture", "table": "furniture", "sofa": "furniture",
    "cup": "utensils", "plate": "utensils", "bowl": "utensils", "utensil": "utensils",
    "bottle": "utensils", "water bottle": "utensils",
    "bag": "clothing", "backpack": "clothing", "handbag": "clothing",
}

print(f"Loading model (USE_CUSTOM_MODEL={USE_CUSTOM_MODEL})...")

if USE_CUSTOM_MODEL:
    model = YOLO(CUSTOM_MODEL_PATH)
    # Fine-tuned model's own class names ARE the category names already
    # (from target_classes.py), so this map is just identity — kept so
    # the lookup code below doesn't need an if/else branch.
    CATEGORY_MAP = {name: name for name in model.names.values()}
    print(f"Loaded custom fine-tuned model. Classes: {list(model.names.values())}")
else:
    model = YOLOWorld("yolov8s-world.pt")
    model.set_classes(DETECTION_CLASSES)
    print("Loaded YOLO-World (zero-shot).")


# ============================================================
# REQUEST MODEL
# ============================================================

class DonationItem(BaseModel):
    class_name: str
    quantity: int
    confidence: float | None = None
    needs_review: bool = False


class SubmissionRequest(BaseModel):
    donor_id: str | None = None    # use this if the donor already has an id
    donor_name: str | None = None  # or just pass a plain name — a Donor row gets created
    ngo_id: str | None = None
    items: list[DonationItem]


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {"message": "Donation Platform API is running", "status": "OK"}


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": "custom_fine_tuned" if USE_CUSTOM_MODEL else "YOLO-World",
    }


# ============================================================
# DETECT OBJECTS
# ============================================================

@app.post("/detect")
async def detect_items(file: UploadFile = File(...)):

    if not file.content_type:
        raise HTTPException(status_code=400, detail="File type missing")

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image")

    filename = (file.filename or "").lower()
    allowed_extensions = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}
    if not filename or not any(filename.endswith(ext) for ext in allowed_extensions):
        raise HTTPException(status_code=400, detail="Unsupported image format")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image")
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large")

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image")

    try:
        results = model.predict(source=image, conf=0.25, iou=0.45, verbose=False)
    except Exception:
        logger.exception("AI detection failed for uploaded image")
        raise HTTPException(status_code=500, detail="AI detection failed")

    detected_items = defaultdict(lambda: {"quantity": 0, "confidences": []})

    for result in results:
        if result.boxes is None:
            continue
        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            detected_name = model.names[class_id].lower().strip()

            category = CATEGORY_MAP.get(detected_name)
            if category is None:
                continue

            detected_items[category]["quantity"] += 1
            detected_items[category]["confidences"].append(confidence)

    items = []
    for class_name, data in detected_items.items():
        quantity = data["quantity"]
        confidences = data["confidences"]
        average_confidence = (sum(confidences) / len(confidences)) if confidences else 0
        needs_review = average_confidence < 0.50

        items.append({
            "class": class_name,
            "quantity": quantity,
            "confidence": round(average_confidence, 3),
            "needs_review": needs_review,
        })

    items.sort(key=lambda x: x["confidence"], reverse=True)

    return {
        "success": True,
        "items": items,
        "total_types": len(items),
        "message": "Items detected successfully" if items else "No donation items detected",
    }


# ============================================================
# SAVE DONATION
# ============================================================

@app.post("/submissions")
def create_submission(request: SubmissionRequest, db: Session = Depends(get_db)):

    if not request.items:
        raise HTTPException(status_code=400, detail="No donation items submitted")

    submission = ItemSubmission(status="submitted")

    if request.donor_id:
        try:
            submission.donor_id = uuid.UUID(request.donor_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid donor ID")
    elif request.donor_name:
        # No donor_id given — create a new Donor row from the plain name
        # the donor typed in on the cart screen.
        donor = Donor(name=request.donor_name.strip())
        db.add(donor)
        db.flush()  # assigns donor.id before we reference it below
        submission.donor_id = donor.id

    if request.ngo_id:
        try:
            submission.ngo_id = uuid.UUID(request.ngo_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid NGO ID")

    db.add(submission)
    db.flush()

    for item in request.items:
        if item.quantity < 0:
            raise HTTPException(status_code=400, detail="Quantity cannot be negative")

        line = ItemSubmissionLine(
            submission_id=submission.id,
            class_name=item.class_name,
            quantity=item.quantity,
            detection_confidence=item.confidence,
            was_edited_by_donor=False,
        )
        db.add(line)

    try:
        db.commit()
        db.refresh(submission)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {
        "success": True,
        "message": "Donation submitted successfully",
        "submission_id": str(submission.id),
        "status": submission.status,
    }


# ============================================================
# LIST ALL SUBMISSIONS — this is your "view the database" screen.
# Open http://127.0.0.1:8000/submissions in a browser, or use it from
# /docs, to see everything stored so far without touching psql/pgAdmin.
# ============================================================

@app.get("/submissions")
def list_submissions(db: Session = Depends(get_db), limit: int = 50):
    submissions = (
        db.query(ItemSubmission)
        .order_by(ItemSubmission.created_at.desc())
        .limit(limit)
        .all()
    )

    result = []
    for submission in submissions:
        donor = db.query(Donor).filter(Donor.id == submission.donor_id).first() \
            if submission.donor_id else None

        result.append({
            "id": str(submission.id),
            "donor_name": donor.name if donor else None,
            "status": submission.status,
            "created_at": submission.created_at.isoformat() if submission.created_at else None,
            "items": [
                {
                    "class": line.class_name,
                    "quantity": line.quantity,
                    "confidence": float(line.detection_confidence) if line.detection_confidence else None,
                }
                for line in submission.lines
            ],
        })

    return {"count": len(result), "submissions": result}


# ============================================================
# GET SUBMISSION
# ============================================================

@app.get("/submissions/{submission_id}")
def get_submission(submission_id: str, db: Session = Depends(get_db)):

    try:
        submission_uuid = uuid.UUID(submission_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid submission ID")

    submission = db.query(ItemSubmission).filter(
        ItemSubmission.id == submission_uuid
    ).first()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    return {
        "id": str(submission.id),
        "status": submission.status,
        "created_at": submission.created_at.isoformat() if submission.created_at else None,
        "items": [
            {
                "class": line.class_name,
                "quantity": line.quantity,
                "confidence": float(line.detection_confidence) if line.detection_confidence else None,
                "was_edited": line.was_edited_by_donor,
            }
            for line in submission.lines
        ],
    }


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
