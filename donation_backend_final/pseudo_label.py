"""
pseudo_label.py

Uses the STOCK pretrained YOLOv8n (trained on COCO's 80 classes, not your
fine-tuned model) to auto-generate DRAFT labels for the 5 parent classes
that overlap with COCO: electronics, furniture, utensils, books, food.

This is NOT a replacement for your fine-tuned model. It's a labeling
shortcut: instead of drawing every box by hand, let the pretrained model
guess, map its COCO-specific classes down to your parent classes, and
only manually review/correct instead of annotating from zero.

Clothing has no COCO equivalent (closest COCO classes are backpack/handbag/
umbrella, not actual clothing) — it is NOT covered by this script. Your
separately-collected clothing dataset goes through dataset_discovery.py /
prepare_dataset.py directly, as its own source (see bottom of this file's
docstring, or the message after the code, for how the two merge).

Output layout (already valid YOLO format, ready for dataset_discovery.py
to pick up with fmt="yolo"):
    pseudo_labeled/
        images/<category>/*.jpg      (copied from your raw input)
        labels/<category>/*.txt      (auto-generated, YOLO format)
        classes.txt                  (matches TARGET_CLASSES order)
        review_report.csv            (flags every box below REVIEW_CONF
                                       and every image with zero detections,
                                       so you know exactly what to check)

Usage:
    python pseudo_label.py --input raw_datasets/electronics_raw --category electronics
    python pseudo_label.py --input raw_datasets/furniture_raw --category furniture
    ... repeat per category folder you have ...

    Then spot-check pseudo_labeled/images + labels in a tool like LabelImg
    or Roboflow before trusting it as training data.
"""

import argparse
import csv
import shutil
from pathlib import Path

from ultralytics import YOLO

from target_classes import TARGET_CLASSES, CLASS_TO_ID

# ---------------------------------------------------------------------------
# COCO class name -> your parent class name. Only classes relevant to
# donation items are mapped; everything else COCO detects (person, car,
# traffic light, ...) is irrelevant here and gets ignored automatically
# because it simply isn't in this dict.
# ---------------------------------------------------------------------------
COCO_TO_PARENT = {
    # electronics
    "laptop": "electronics", "mouse": "electronics", "keyboard": "electronics",
    "remote": "electronics", "cell phone": "electronics", "tv": "electronics",
    # furniture
    "chair": "furniture", "couch": "furniture", "bed": "furniture",
    "dining table": "furniture",
    # utensils
    "fork": "utensils", "knife": "utensils", "spoon": "utensils",
    "bowl": "utensils", "cup": "utensils",
    # books
    "book": "books",
    # food (COCO only has specific food items, no generic "food" class)
    "banana": "food", "apple": "food", "sandwich": "food", "orange": "food",
    "broccoli": "food", "carrot": "food", "pizza": "food", "cake": "food",
    "donut": "food", "hot dog": "food",
}

# Which parent classes this script is expected to touch — used to sanity
# check --category against what's actually mappable.
SUPPORTED_CATEGORIES = sorted(set(COCO_TO_PARENT.values()))

CONF_THRESHOLD = 0.25   # lower than the fine-tuned model's threshold — for
                         # pseudo-labeling we'd rather over-detect and let a
                         # human reviewer discard bad boxes than miss items
REVIEW_CONF = 0.5        # boxes below this get flagged in review_report.csv
IMG_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")


def pseudo_label_folder(input_dir: Path, category: str, output_root: Path, model: YOLO):
    if category not in SUPPORTED_CATEGORIES:
        raise ValueError(
            f"'{category}' has no COCO-overlapping classes. "
            f"Supported categories: {SUPPORTED_CATEGORIES}. "
            f"(clothing is never covered by this script — see docstring.)"
        )

    img_out = output_root / "images" / category
    lbl_out = output_root / "labels" / category
    img_out.mkdir(parents=True, exist_ok=True)
    lbl_out.mkdir(parents=True, exist_ok=True)

    review_rows = []
    images = sorted(p for p in input_dir.iterdir() if p.suffix.lower() in IMG_EXTS)
    print(f"[{category}] running pretrained model over {len(images)} images...")

    for img_path in images:
        results = model.predict(source=str(img_path), conf=CONF_THRESHOLD, verbose=False)[0]

        lines = []
        any_low_conf = False
        for box in results.boxes:
            coco_name = model.names[int(box.cls.item())]
            parent = COCO_TO_PARENT.get(coco_name)
            # Only keep boxes that map to THIS run's target category — a
            # photo taken for "furniture" that also has a stray "cup" in
            # frame won't get mislabeled into the furniture label file.
            if parent != category:
                continue
            conf = float(box.conf.item())
            cx, cy, w, h = box.xywhn[0].tolist()  # already normalized 0-1
            cls_id = CLASS_TO_ID[parent]
            lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
            if conf < REVIEW_CONF:
                any_low_conf = True
                review_rows.append([img_path.name, coco_name, f"{conf:.2f}", "low_confidence"])

        shutil.copy2(img_path, img_out / img_path.name)
        if lines:
            (lbl_out / (img_path.stem + ".txt")).write_text("\n".join(lines) + "\n")
        else:
            # Zero detections: still worth flagging — either the pretrained
            # model missed a real item, or the photo doesn't belong in this
            # category at all.
            review_rows.append([img_path.name, "-", "-", "zero_detections"])

    return review_rows


def write_classes_txt(output_root: Path):
    (output_root / "classes.txt").write_text("\n".join(TARGET_CLASSES) + "\n")


def write_review_report(output_root: Path, all_rows: list):
    report_path = output_root / "review_report.csv"
    file_exists = report_path.exists()
    with open(report_path, "a", newline="") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["image", "coco_class_detected", "confidence", "flag"])
        writer.writerows(all_rows)
    print(f"Review report: {report_path} ({len(all_rows)} rows this run)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="folder of raw unlabeled images")
    parser.add_argument("--category", required=True, choices=SUPPORTED_CATEGORIES,
                         help="which parent class these images are for")
    parser.add_argument("--output", default="pseudo_labeled")
    parser.add_argument("--model", default="yolov8n.pt", help="pretrained (not fine-tuned) checkpoint")
    args = parser.parse_args()

    output_root = Path(args.output)
    model = YOLO(args.model)  # stock COCO-pretrained weights, downloaded automatically

    rows = pseudo_label_folder(Path(args.input), args.category, output_root, model)
    write_classes_txt(output_root)
    write_review_report(output_root, rows)

    n_flagged = len(rows)
    print(f"\n[{args.category}] done. {n_flagged} item(s) need a manual look "
          f"(low confidence or zero detections) — see review_report.csv.")


if __name__ == "__main__":
    main()
