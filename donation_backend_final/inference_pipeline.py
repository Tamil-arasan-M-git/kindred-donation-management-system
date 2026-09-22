"""
inference_pipeline.py

Server-side detection pipeline: takes a raw uploaded image, runs the
fine-tuned YOLOv8 nano model, and returns a clean, aggregated list of
detected item types with estimated quantity and confidence — the exact
shape the editable cart UI expects.

Kept separate from main.py (the FastAPI app) so it can be unit-tested or
reused by a batch script without spinning up a web server.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict

import numpy as np
from PIL import Image
from ultralytics import YOLO

from taxonomy import taxonomy_for_class

MODEL_PATH = "runs/detect/donation_items_yolov8n/weights/best.pt"
CONF_THRESHOLD = 0.35   # per-box confidence floor
IOU_THRESHOLD = 0.45    # NMS overlap threshold (handled internally by ultralytics)
MIN_QUANTITY_CONF = 0.5  # a class's aggregated confidence must clear this to be
                          # auto-included; below it, still returned but flagged
                          # for the donor to double check in the cart UI


@dataclass
class DetectedBox:
    class_name: str
    category: str | None
    subcategory: str | None
    known: bool
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2] in pixel coords


@dataclass
class CatalogedItem:
    class_name: str
    category: str | None
    subcategory: str | None
    known: bool
    quantity: int
    avg_confidence: float
    needs_review: bool
    boxes: List[DetectedBox] = field(default_factory=list)


class ItemDetector:
    """Thin wrapper around the fine-tuned YOLOv8 nano model."""

    def __init__(self, model_path: str = MODEL_PATH):
        resolved_model_path = Path(model_path)
        if not resolved_model_path.is_file() and not resolved_model_path.is_absolute():
            project_relative_path = Path(__file__).resolve().parent.parent / resolved_model_path
            if project_relative_path.is_file():
                resolved_model_path = project_relative_path
        if not resolved_model_path.is_file():
            raise FileNotFoundError(
                f"Model weights not found at {resolved_model_path}. "
                "Run train.py first, or point MODEL_PATH at your trained weights."
            )
        self.model = YOLO(str(resolved_model_path))
        self.class_names = self.model.names  # {id: name}
        if self.model.task != "detect" or not self.class_names:
            raise ValueError("Custom model must be a named object detection model")

    def _run_model(self, image: Image.Image) -> List[DetectedBox]:
        results = self.model.predict(
            source=np.array(image),
            conf=CONF_THRESHOLD,
            iou=IOU_THRESHOLD,
            verbose=False,
        )[0]

        boxes: List[DetectedBox] = []
        for box in results.boxes:
            cls_id = int(box.cls.item())
            class_name = str(self.class_names[cls_id]).strip().lower()
            taxonomy = taxonomy_for_class(class_name)
            boxes.append(
                DetectedBox(
                    class_name=class_name,
                    category=taxonomy["category"],
                    subcategory=taxonomy["subcategory"],
                    known=taxonomy["known"],
                    confidence=float(box.conf.item()),
                    bbox=[float(v) for v in box.xyxy[0].tolist()],
                )
            )
        return boxes

    @staticmethod
    def _aggregate(boxes: List[DetectedBox]) -> List[CatalogedItem]:
        """Group individual boxes into per-class cataloged items with a
        quantity (box count) and an average confidence. This is the
        'quantity estimation' step — deliberately simple: count detections
        per class, let the donor correct it in the cart UI rather than
        trying to build a separate counting model."""
        by_class: Dict[tuple[str, str | None], List[DetectedBox]] = {}
        for b in boxes:
            by_class.setdefault((b.class_name, b.subcategory), []).append(b)

        items = []
        for (class_name, _), class_boxes in by_class.items():
            avg_conf = sum(b.confidence for b in class_boxes) / len(class_boxes)
            items.append(
                CatalogedItem(
                    class_name=class_name,
                    category=class_boxes[0].category,
                    subcategory=class_boxes[0].subcategory,
                    known=all(b.known for b in class_boxes),
                    quantity=len(class_boxes),
                    avg_confidence=round(avg_conf, 3),
                    needs_review=avg_conf < MIN_QUANTITY_CONF,
                    boxes=class_boxes,
                )
            )
        # Highest confidence first so the cart UI shows the model's best
        # guesses at the top.
        items.sort(key=lambda i: i.avg_confidence, reverse=True)
        return items

    def detect(self, image: Image.Image) -> List[CatalogedItem]:
        boxes = self._run_model(image)
        return self._aggregate(boxes)


def to_json(items: List[CatalogedItem]) -> List[dict]:
    """Serialize CatalogedItems into the JSON shape the cart UI consumes."""
    return [
        {
            "class": item.class_name,
            "class_name": item.class_name,
            "category": item.category,
            "subcategory": item.subcategory,
            "quantity": item.quantity,
            "confidence": item.avg_confidence,
            "needs_review": item.needs_review or not item.known,
            "boxes": [
                {"confidence": round(b.confidence, 3), "bbox": [round(v, 1) for v in b.bbox]}
                for b in item.boxes
            ],
        }
        for item in items
    ]
