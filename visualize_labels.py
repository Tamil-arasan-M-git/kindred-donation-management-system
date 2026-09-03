"""
visualize_labels.py

Numbers (confidence scores, class-balance counts) can hide a wrong box.
This draws the actual boxes onto a random sample of images so you can look
at them directly — this is the single most useful sanity check before
training, and it takes two minutes.

Usage:
    python visualize_labels.py --dataset dataset_unified --split train --n 20
    python visualize_labels.py --dataset dataset_unified --split val --n 10 --class-filter utensils
"""

import argparse
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from target_classes import TARGET_CLASSES

IMG_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
BOX_COLORS = [
    "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c",
]  # one distinct color per class, cycles if you ever add more classes


def draw_boxes_on_image(img_path: Path, label_path: Path, class_filter: str = None):
    image = Image.open(img_path).convert("RGB")
    draw = ImageDraw.Draw(image)
    iw, ih = image.size

    if not label_path.exists():
        return image, 0  # no labels at all for this image

    box_count = 0
    for line in label_path.read_text().strip().splitlines():
        if not line.strip():
            continue
        parts = line.split()
        cls_id = int(parts[0])
        cx, cy, w, h = (float(v) for v in parts[1:5])
        class_name = TARGET_CLASSES[cls_id] if cls_id < len(TARGET_CLASSES) else str(cls_id)

        if class_filter and class_name != class_filter:
            continue

        # Convert normalized YOLO coords back to pixel corners for drawing.
        x1 = (cx - w / 2) * iw
        y1 = (cy - h / 2) * ih
        x2 = (cx + w / 2) * iw
        y2 = (cy + h / 2) * ih

        color = BOX_COLORS[cls_id % len(BOX_COLORS)]
        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
        draw.text((x1 + 4, max(y1 - 16, 0)), class_name, fill=color)
        box_count += 1

    return image, box_count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="dataset_unified")
    parser.add_argument("--split", default="train", choices=["train", "val", "test"])
    parser.add_argument("--n", type=int, default=20, help="how many random images to sample")
    parser.add_argument("--class-filter", default=None,
                         help="only draw boxes of this class, e.g. utensils")
    parser.add_argument("--output", default="label_preview")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    dataset_root = Path(args.dataset)
    img_dir = dataset_root / "images" / args.split
    lbl_dir = dataset_root / "labels" / args.split
    out_dir = Path(args.output) / args.split
    out_dir.mkdir(parents=True, exist_ok=True)

    all_images = [p for p in img_dir.iterdir() if p.suffix.lower() in IMG_EXTS]
    if not all_images:
        print(f"No images found in {img_dir}")
        return

    random.seed(args.seed)
    sample = random.sample(all_images, min(args.n, len(all_images)))

    zero_box_images = []
    for img_path in sample:
        label_path = lbl_dir / (img_path.stem + ".txt")
        annotated, box_count = draw_boxes_on_image(img_path, label_path, args.class_filter)
        if box_count == 0:
            zero_box_images.append(img_path.name)
        annotated.save(out_dir / img_path.name)

    print(f"Saved {len(sample)} annotated preview images to {out_dir}")
    if zero_box_images:
        print(f"\n{len(zero_box_images)} sampled image(s) had NO matching boxes drawn "
              f"(missing label file, or filtered class not present):")
        for name in zero_box_images:
            print(f"  {name}")
    print("\nOpen the images in", out_dir, "and check: is each box actually "
          "around the right item, and is the class name correct?")


if __name__ == "__main__":
    main()
