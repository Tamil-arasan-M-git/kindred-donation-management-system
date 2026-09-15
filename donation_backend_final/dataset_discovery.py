"""
dataset_discovery.py

Your collected datasets don't share a folder layout or annotation format.
Rather than hand-writing per-source path configs, this module inspects a
source folder, figures out what format it's in, and returns a normalized
list of records so prepare_dataset.py doesn't need to care about the
original layout at all.

Supported formats (auto-detected):
  - YOLO        : images/ + labels/ with .txt files ("class_id cx cy w h"),
                  optionally split into train/val/test subfolders, and an
                  optional classes.txt or *.yaml giving class_id -> name.
  - COCO        : a single annotations .json with images/annotations/categories.
  - Pascal VOC  : per-image .xml files with <object><name>/<bndbox>.
  - Classification-by-folder : images sit directly under class-named
                  subfolders with no annotation files at all (common for
                  scraped/Kaggle image datasets). Each image is treated as
                  one whole-image detection instance of that class.

Every parser returns a list of DiscoveredRecord:
    image_path: Path
    boxes: list[(class_name: str, cx, cy, w, h)]   # normalized YOLO coords
    split: "train" | "val" | "test" | None          # None if source has no split

Usage:
    from dataset_discovery import discover_source
    records = discover_source("raw_datasets/source_c")
    # or force a format if auto-detection guesses wrong:
    records = discover_source("raw_datasets/source_c", fmt="coco")
"""

import json
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image

IMG_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
SPLIT_NAMES = ("train", "val", "valid", "validation", "test")
SPLIT_NORMALIZE = {"valid": "val", "validation": "val"}


@dataclass
class DiscoveredRecord:
    image_path: Path
    boxes: List[Tuple[str, float, float, float, float]]  # (class_name, cx, cy, w, h)
    split: Optional[str] = None


# ---------------------------------------------------------------------------
# Format detection
# ---------------------------------------------------------------------------

def detect_format(root: Path) -> str:
    """Best-effort guess of a source dataset's format."""
    files = list(root.rglob("*"))
    if any(f.suffix.lower() == ".json" for f in files):
        for f in files:
            if f.suffix.lower() == ".json":
                try:
                    data = json.loads(f.read_text())
                    if isinstance(data, dict) and {"images", "annotations", "categories"} <= data.keys():
                        return "coco"
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
    if any(f.suffix.lower() == ".xml" for f in files):
        return "voc"
    if any(f.suffix.lower() == ".txt" and f.name != "classes.txt" for f in files):
        return "yolo"
    # No annotation files at all: assume class-named subfolders of images.
    subdirs = [d for d in root.iterdir() if d.is_dir()]
    if subdirs and any(any(p.suffix.lower() in IMG_EXTS for p in d.iterdir()) for d in subdirs if d.is_dir()):
        return "folder"
    raise ValueError(
        f"Could not auto-detect format for {root}. "
        "Pass fmt='yolo'|'coco'|'voc'|'folder' explicitly."
    )


# ---------------------------------------------------------------------------
# YOLO
# ---------------------------------------------------------------------------

def _load_yolo_class_names(root: Path) -> Optional[List[str]]:
    for candidate in ("classes.txt", "labels.txt"):
        f = root / candidate
        if f.exists():
            return [line.strip() for line in f.read_text().splitlines() if line.strip()]
    for yaml_file in root.rglob("*.yaml"):
        text = yaml_file.read_text()
        if "names" in text:
            # Minimal parse: handles `names: [a, b, c]` or a `names:` block list.
            try:
                import re
                m = re.search(r"names:\s*\[(.*?)\]", text, re.S)
                if m:
                    return [n.strip().strip("'\"") for n in m.group(1).split(",")]
                m = re.search(r"names:\s*\n((?:\s*-\s*.+\n?)+)", text)
                if m:
                    return [line.split("-", 1)[1].strip() for line in m.group(1).splitlines() if line.strip()]
            except Exception:
                pass
    return None


def parse_yolo(root: Path) -> List[DiscoveredRecord]:
    class_names = _load_yolo_class_names(root)
    if class_names is None:
        print(f"WARNING [{root}]: no classes.txt/*.yaml found — using raw class "
              f"ids as names ('0','1',...). Map these explicitly in LABEL_MAP.")

    records = []
    img_dirs = [d for d in root.rglob("*") if d.is_dir() and d.name.lower() in ("images", "img", "imgs")]
    if not img_dirs:
        img_dirs = [root]  # flat layout: images and labels side by side

    for img_dir in img_dirs:
        # Figure out split from path components, if present.
        split = None
        for part in img_dir.parts:
            if part.lower() in SPLIT_NAMES:
                split = SPLIT_NORMALIZE.get(part.lower(), part.lower())
        label_dir_candidates = [
            Path(str(img_dir).replace("images", "labels")),
            img_dir.parent / "labels",
            img_dir,
        ]
        label_dir = next((d for d in label_dir_candidates if d.exists()), img_dir)

        for img_path in img_dir.iterdir():
            if img_path.suffix.lower() not in IMG_EXTS:
                continue
            label_path = label_dir / (img_path.stem + ".txt")
            boxes = []
            if label_path.exists():
                for line in label_path.read_text().strip().splitlines():
                    if not line.strip():
                        continue
                    parts = line.split()
                    cls_id = int(parts[0])
                    cx, cy, w, h = (float(v) for v in parts[1:5])
                    name = class_names[cls_id] if class_names and cls_id < len(class_names) else str(cls_id)
                    boxes.append((name, cx, cy, w, h))
            if boxes:
                records.append(DiscoveredRecord(img_path, boxes, split))
    return records


# ---------------------------------------------------------------------------
# COCO
# ---------------------------------------------------------------------------

def parse_coco(root: Path, split: Optional[str] = None) -> List[DiscoveredRecord]:
    json_files = [f for f in root.rglob("*.json")]
    records: List[DiscoveredRecord] = []

    for jf in json_files:
        try:
            data = json.loads(jf.read_text())
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        if not (isinstance(data, dict) and {"images", "annotations", "categories"} <= data.keys()):
            continue

        cat_id_to_name = {c["id"]: c["name"] for c in data["categories"]}
        img_id_to_info = {img["id"]: img for img in data["images"]}
        boxes_by_img: dict = {}
        for ann in data["annotations"]:
            img_id = ann["image_id"]
            x, y, w, h = ann["bbox"]  # COCO: pixel [x_min, y_min, width, height]
            img_info = img_id_to_info.get(img_id)
            if img_info is None:
                continue
            iw, ih = img_info["width"], img_info["height"]
            cx, cy = (x + w / 2) / iw, (y + h / 2) / ih
            nw, nh = w / iw, h / ih
            name = cat_id_to_name.get(ann["category_id"], str(ann["category_id"]))
            boxes_by_img.setdefault(img_id, []).append((name, cx, cy, nw, nh))

        # Guess split from this json's own filename/folder if not passed in.
        inferred_split = split
        if inferred_split is None:
            for part in jf.parts:
                if part.lower() in SPLIT_NAMES:
                    inferred_split = SPLIT_NORMALIZE.get(part.lower(), part.lower())

        for img_id, img_info in img_id_to_info.items():
            img_path = root / img_info["file_name"]
            # file_name is sometimes relative to a different subfolder; fall
            # back to a filename search if the direct path doesn't exist.
            if not img_path.exists():
                matches = list(root.rglob(Path(img_info["file_name"]).name))
                if matches:
                    img_path = matches[0]
            boxes = boxes_by_img.get(img_id, [])
            if boxes and img_path.exists():
                records.append(DiscoveredRecord(img_path, boxes, inferred_split))
    return records


# ---------------------------------------------------------------------------
# Pascal VOC
# ---------------------------------------------------------------------------

def parse_voc(root: Path) -> List[DiscoveredRecord]:
    records = []
    for xml_path in root.rglob("*.xml"):
        try:
            tree = ET.parse(xml_path)
        except ET.ParseError:
            continue
        r = tree.getroot()
        size = r.find("size")
        if size is None:
            continue
        iw = float(size.findtext("width", "0"))
        ih = float(size.findtext("height", "0"))
        if iw <= 0 or ih <= 0:
            continue

        filename = r.findtext("filename")
        img_path = xml_path.parent / filename if filename else None
        if img_path is None or not img_path.exists():
            matches = list(root.rglob(filename)) if filename else []
            img_path = matches[0] if matches else None
        if img_path is None:
            continue

        split = None
        for part in xml_path.parts:
            if part.lower() in SPLIT_NAMES:
                split = SPLIT_NORMALIZE.get(part.lower(), part.lower())

        boxes = []
        for obj in r.findall("object"):
            name = obj.findtext("name", "unknown")
            bnd = obj.find("bndbox")
            if bnd is None:
                continue
            xmin, ymin = float(bnd.findtext("xmin")), float(bnd.findtext("ymin"))
            xmax, ymax = float(bnd.findtext("xmax")), float(bnd.findtext("ymax"))
            cx, cy = (xmin + xmax) / 2 / iw, (ymin + ymax) / 2 / ih
            w, h = (xmax - xmin) / iw, (ymax - ymin) / ih
            boxes.append((name, cx, cy, w, h))
        if boxes:
            records.append(DiscoveredRecord(img_path, boxes, split))
    return records


# ---------------------------------------------------------------------------
# Classification-by-folder (no annotation files, class = subfolder name)
# ---------------------------------------------------------------------------

def parse_folder(root: Path) -> List[DiscoveredRecord]:
    """Each class-named subfolder's images become one whole-image box each
    (cx=0.5, cy=0.5, w=1.0, h=1.0) — i.e. 'this whole photo is one item of
    this class'. Fine for donation photos that are one item per frame;
    if a source has multiple items per photo, it needs real annotation,
    not this fallback."""
    records = []
    for split_or_class_dir in root.iterdir():
        if not split_or_class_dir.is_dir():
            continue
        if split_or_class_dir.name.lower() in SPLIT_NAMES:
            split = SPLIT_NORMALIZE.get(split_or_class_dir.name.lower(), split_or_class_dir.name.lower())
            class_dirs = [d for d in split_or_class_dir.iterdir() if d.is_dir()]
        else:
            split = None
            class_dirs = [split_or_class_dir]

        for class_dir in class_dirs:
            class_name = class_dir.name
            for img_path in class_dir.iterdir():
                if img_path.suffix.lower() in IMG_EXTS:
                    records.append(DiscoveredRecord(
                        img_path, [(class_name, 0.5, 0.5, 1.0, 1.0)], split
                    ))
    return records


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def discover_source(root_path: str, fmt: Optional[str] = None) -> List[DiscoveredRecord]:
    root = Path(root_path)
    if not root.exists():
        print(f"WARNING: {root} does not exist")
        return []

    resolved_fmt = fmt or detect_format(root)
    print(f"[{root.name}] detected format: {resolved_fmt}")

    if resolved_fmt == "yolo":
        return parse_yolo(root)
    if resolved_fmt == "coco":
        return parse_coco(root)
    if resolved_fmt == "voc":
        return parse_voc(root)
    if resolved_fmt == "folder":
        return parse_folder(root)
    raise ValueError(f"Unknown format '{resolved_fmt}'")
