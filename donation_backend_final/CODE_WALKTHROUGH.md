# Code Walkthrough — Item Detection Backend

This explains every file, block by block, in the order you'd actually run them:
`dataset_discovery.py` → `prepare_dataset.py` → `train.py` → `inference_pipeline.py` → `main.py`.

---

## 1. `dataset_discovery.py`

**Job:** look at one source dataset folder, figure out what annotation format it uses, and return a normalized list of records — regardless of the original layout.

### Imports and constants
```python
import json
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
```
- `json` — reads COCO annotation files (they're JSON).
- `xml.etree.ElementTree as ET` — Python's built-in XML parser, used for Pascal VOC files.
- `dataclass` — a shortcut for writing simple classes that just hold data (no need to write `__init__` by hand).
- `Path` — object-oriented file path handling (`Path("a") / "b"` instead of string concatenation).

```python
IMG_EXTS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
SPLIT_NAMES = ("train", "val", "valid", "validation", "test")
SPLIT_NORMALIZE = {"valid": "val", "validation": "val"}
```
- `IMG_EXTS` — which file extensions count as images, used everywhere we scan a folder.
- `SPLIT_NAMES` — every spelling of "validation" you might find in a folder name.
- `SPLIT_NORMALIZE` — maps the odd spellings (`valid`, `validation`) to the one name we use internally (`val`), so downstream code only ever has to check for `"val"`.

### `DiscoveredRecord`
```python
@dataclass
class DiscoveredRecord:
    image_path: Path
    boxes: List[Tuple[str, float, float, float, float]]
    split: Optional[str] = None
```
This is the **common output shape** every parser converts into, no matter the input format:
- `image_path` — where the image file lives.
- `boxes` — a list of `(class_name, cx, cy, w, h)` tuples. `cx, cy, w, h` are always **normalized YOLO format** (0–1 fractions of image width/height), even if the source was COCO or VOC (which use pixel coordinates) — the parsers do that conversion for you.
- `split` — `"train"`, `"val"`, `"test"`, or `None` if the source had no split.

### `detect_format(root)`
```python
files = list(root.rglob("*"))
```
`rglob("*")` recursively lists every file/folder under `root`. We use this list to sniff out the format.

```python
if any(f.suffix.lower() == ".json" for f in files):
    for f in files:
        if f.suffix.lower() == ".json":
            try:
                data = json.loads(f.read_text())
                if isinstance(data, dict) and {"images", "annotations", "categories"} <= data.keys():
                    return "coco"
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
```
If there's any `.json` file, we try to parse it and check whether it has the three keys every COCO file has (`images`, `annotations`, `categories`). `{"images", ...} <= data.keys()` means "is this set a subset of the dict's keys" — i.e. "does the dict contain all three of these keys". If parsing fails (bad JSON or wrong encoding) we just skip that file rather than crashing.

```python
if any(f.suffix.lower() == ".xml" for f in files):
    return "voc"
if any(f.suffix.lower() == ".txt" and f.name != "classes.txt" for f in files):
    return "yolo"
```
XML files → Pascal VOC. `.txt` files (excluding `classes.txt`, which is a class-name list, not a label file) → YOLO.

```python
subdirs = [d for d in root.iterdir() if d.is_dir()]
if subdirs and any(any(p.suffix.lower() in IMG_EXTS for p in d.iterdir()) for d in subdirs if d.is_dir()):
    return "folder"
```
If none of the above matched, but there are subfolders that directly contain images, we assume it's "classification by folder" — each subfolder name is a class, no annotation files needed.

```python
raise ValueError(...)
```
If nothing matched, we refuse to guess — better to error loudly than silently mis-parse a dataset.

### `_load_yolo_class_names(root)`
Looks for `classes.txt` or `labels.txt` (one class name per line) — the standard YOLO convention for mapping numeric class IDs to names:
```python
for candidate in ("classes.txt", "labels.txt"):
    f = root / candidate
    if f.exists():
        return [line.strip() for line in f.read_text().splitlines() if line.strip()]
```
If neither exists, it falls back to scanning any `.yaml` file for a `names:` field, using a regex to pull out either the inline list form (`names: [a, b, c]`) or the multi-line dash-list form. This is a *minimal* parser — it's not a full YAML parser, just enough to grab that one field without adding a `pyyaml` dependency.

### `parse_yolo(root)`
```python
img_dirs = [d for d in root.rglob("*") if d.is_dir() and d.name.lower() in ("images", "img", "imgs")]
if not img_dirs:
    img_dirs = [root]
```
Finds every folder literally named `images`/`img`/`imgs` anywhere under `root` (handles nested `train/images`, `val/images`, etc.). If none exist, assumes a flat layout where images and label `.txt` files sit in the same folder.

```python
split = None
for part in img_dir.parts:
    if part.lower() in SPLIT_NAMES:
        split = SPLIT_NORMALIZE.get(part.lower(), part.lower())
```
`img_dir.parts` breaks a path like `raw_datasets/source_a/train/images` into `('raw_datasets', 'source_a', 'train', 'images')`. We check each piece against `SPLIT_NAMES` to detect if this image folder belongs to a train/val/test split.

```python
label_dir_candidates = [
    Path(str(img_dir).replace("images", "labels")),
    img_dir.parent / "labels",
    img_dir,
]
label_dir = next((d for d in label_dir_candidates if d.exists()), img_dir)
```
Tries three guesses for where the matching labels live: (1) same path with `images`→`labels` swapped in the string, (2) a `labels` sibling folder, (3) same folder as images (flat layout). Uses whichever one actually exists.

```python
for img_path in img_dir.iterdir():
    if img_path.suffix.lower() not in IMG_EXTS:
        continue
    label_path = label_dir / (img_path.stem + ".txt")
    boxes = []
    if label_path.exists():
        for line in label_path.read_text().strip().splitlines():
            ...
            cls_id = int(parts[0])
            cx, cy, w, h = (float(v) for v in parts[1:5])
            name = class_names[cls_id] if class_names and cls_id < len(class_names) else str(cls_id)
            boxes.append((name, cx, cy, w, h))
    if boxes:
        records.append(DiscoveredRecord(img_path, boxes, split))
```
For each image, finds its matching `.txt` label file (same filename stem), parses each line (`class_id cx cy w h`), converts the numeric ID to a name via the class list we loaded earlier (or keeps it as a string digit if we don't have names), and only keeps the image if it actually has boxes.

### `parse_coco(root, split=None)`
```python
cat_id_to_name = {c["id"]: c["name"] for c in data["categories"]}
img_id_to_info = {img["id"]: img for img in data["images"]}
```
Builds lookup dicts: category ID → class name, and image ID → the image's metadata (filename, width, height).

```python
for ann in data["annotations"]:
    img_id = ann["image_id"]
    x, y, w, h = ann["bbox"]
    img_info = img_id_to_info.get(img_id)
    iw, ih = img_info["width"], img_info["height"]
    cx, cy = (x + w / 2) / iw, (y + h / 2) / ih
    nw, nh = w / iw, h / ih
```
This is the **format conversion**: COCO gives boxes as `[x_min, y_min, width, height]` in raw pixels. YOLO wants `[center_x, center_y, width, height]` normalized to 0–1. So: `x + w/2` gets the pixel center, then dividing by image width (`iw`) normalizes it. Same for height.

```python
img_path = root / img_info["file_name"]
if not img_path.exists():
    matches = list(root.rglob(Path(img_info["file_name"]).name))
    if matches:
        img_path = matches[0]
```
COCO's `file_name` field is sometimes a relative path that doesn't match your actual folder structure. If the direct path fails, we fall back to searching the whole dataset tree for a file with that exact name.

### `parse_voc(root)`
```python
tree = ET.parse(xml_path)
r = tree.getroot()
size = r.find("size")
iw = float(size.findtext("width", "0"))
ih = float(size.findtext("height", "0"))
```
Each VOC `.xml` file has a `<size><width>...</width><height>...</height></size>` block — we need this to normalize pixel coordinates, same reasoning as COCO above.

```python
for obj in r.findall("object"):
    name = obj.findtext("name", "unknown")
    bnd = obj.find("bndbox")
    xmin, ymin = float(bnd.findtext("xmin")), float(bnd.findtext("ymin"))
    xmax, ymax = float(bnd.findtext("xmax")), float(bnd.findtext("ymax"))
    cx, cy = (xmin + xmax) / 2 / iw, (ymin + ymax) / 2 / ih
    w, h = (xmax - xmin) / iw, (ymax - ymin) / ih
```
VOC gives corner coordinates (`xmin, ymin, xmax, ymax`) instead of COCO's `x, y, width, height`. Center = midpoint of the two corners; width/height = difference between corners, then both normalized by image size.

### `parse_folder(root)`
```python
for split_or_class_dir in root.iterdir():
    if split_or_class_dir.name.lower() in SPLIT_NAMES:
        split = ...
        class_dirs = [d for d in split_or_class_dir.iterdir() if d.is_dir()]
    else:
        split = None
        class_dirs = [split_or_class_dir]
```
Handles two possible layouts: `train/clothing/*.jpg` (split folder containing class folders) or just `clothing/*.jpg` (no split, class folder directly under root).

```python
records.append(DiscoveredRecord(
    img_path, [(class_name, 0.5, 0.5, 1.0, 1.0)], split
))
```
Since there's no bounding box info at all — just "this image is class X" — we treat the **whole image** as one box: centered (`0.5, 0.5`) covering 100% of the frame (`1.0, 1.0`). This only makes sense if each photo has one item filling the frame; the docstring above this function flags that limitation.

### `discover_source(root_path, fmt=None)`
The public function everything else calls. If `fmt` isn't passed explicitly, it calls `detect_format()` to guess, then dispatches to the matching parser function.

---

## 2. `prepare_dataset.py`

**Job:** run `discover_source()` on every dataset you list, remap every class name to one of your 6 parent classes, and write out one clean unified dataset.

```python
TARGET_CLASSES = ["clothing", "food", "books", "electronics", "furniture", "utensils"]
CLASS_TO_ID = {name: i for i, name in enumerate(TARGET_CLASSES)}
```
Your 6 final classes, and a dict mapping each name to its index (`0`-`5`) — this index is what actually gets written into YOLO label files.

```python
LABEL_MAP = {
    "shirt": "clothing", ...
}
```
The manual translation table: **every** original class name you've seen, across every dataset, mapped to one of the 6 parent names. This is the one part of the whole pipeline that has to be hand-curated, because only you know what your source datasets called things.

```python
SOURCE_ROOTS = [
    {"name": "source_a", "root": "raw_datasets/source_a"},
    {"name": "source_b", "root": "raw_datasets/source_b", "fmt": "coco"},
]
```
Your list of dataset folders. `"fmt"` is optional — only set it if `detect_format()` guesses wrong for that particular source.

```python
DRY_RUN = False
```
When `True`, the script discovers everything and prints which class names it found that *aren't yet* in `LABEL_MAP`, but doesn't write any files. Meant to be run once first so you can fill in `LABEL_MAP` from real data instead of guessing.

### `remap_boxes(record, unmapped_seen)`
```python
for name, cx, cy, w, h in record.boxes:
    target = LABEL_MAP.get(name)
    if target is None:
        unmapped_seen.add(name)
        continue
    cls_id = CLASS_TO_ID[target]
    lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
```
For each box in a discovered record: look up its class name in `LABEL_MAP`. If it's not there, record it in `unmapped_seen` (for the warning report) and drop the box — **we never guess a mapping**, a dropped box is safer than a wrong label. Otherwise, format it as a standard YOLO label line: `class_id cx cy w h`, each number to 6 decimal places.

### `collect_pairs()`
```python
for src in SOURCE_ROOTS:
    records = discover_source(src["root"], fmt=src.get("fmt"))
```
Runs discovery on each source. `src.get("fmt")` returns `None` if `"fmt"` wasn't set, which tells `discover_source` to auto-detect.

```python
    for rec in records:
        lines = remap_boxes(rec, unmapped_seen)
        if not lines:
            continue
        pair = (rec.image_path, lines)
        if rec.split and rec.split in presplit:
            presplit[rec.split].append(pair)
        else:
            unsplit.append(pair)
```
This is the **presplit vs. unsplit routing**: if the discovered record already knows its split (because the source folder had `train`/`val`/`test` subfolders), it goes straight into that bucket, untouched. Otherwise it goes into `unsplit`, to be divided up later.

### `main()`
```python
random.shuffle(unsplit)
n_val = int(len(unsplit) * VAL_SPLIT)
n_test = int(len(unsplit) * TEST_SPLIT)
final = {
    "train": presplit["train"] + unsplit[n_val + n_test:],
    "val": presplit["val"] + unsplit[:n_val],
    "test": presplit["test"] + unsplit[n_val:n_val + n_test],
}
```
Shuffles the pooled unsplit images randomly (so the split isn't biased by, say, alphabetical filename order), slices off the first `n_val` for validation, the next `n_test` for test, and the rest for train — then merges each slice with whatever was already presplit for that same bucket.

```python
for split_name, pairs in final.items():
    write_split(pairs, split_name)
```
`write_split()` copies each image into `dataset_unified/images/<split>/` and writes its label lines into `dataset_unified/labels/<split>/<same_name>.txt`. `write_data_yaml()` then writes the `data.yaml` file that `train.py` needs, listing the 6 class names and where to find each split.

---

## 3. `train.py`

**Job:** fine-tune YOLOv8 nano on the unified dataset.

```python
model = YOLO(args.model)
```
Loads a pretrained YOLOv8n checkpoint (`yolov8n.pt`, downloaded automatically by ultralytics on first use) — we're fine-tuning from ImageNet/COCO-pretrained weights, not training from scratch, which needs far less data.

```python
model.train(
    data=args.data,
    epochs=args.epochs,
    imgsz=args.imgsz,
    batch=args.batch,
    patience=args.patience,
    hsv_h=0.015, hsv_s=0.6, hsv_v=0.4,
    degrees=5.0, translate=0.1, scale=0.4, shear=2.0,
    fliplr=0.5,
    mosaic=1.0,
)
```
- `data` — path to `data.yaml`.
- `epochs`/`imgsz`/`batch` — standard training hyperparameters.
- `patience` — stop early if validation performance hasn't improved for this many epochs (avoids wasting time overfitting).
- `hsv_h/s/v` — randomly jitter hue/saturation/brightness during training, since donation photos come from many different phone cameras and lighting.
- `degrees/translate/scale/shear` — random rotation/shift/zoom/skew augmentation, so the model isn't overly sensitive to exact framing.
- `fliplr` — 50% chance of horizontal flip per image.
- `mosaic` — combines 4 training images into one during training (a YOLO-specific augmentation that helps with small/partial objects).

```python
metrics = model.val(data=args.data)
for i, name in enumerate(metrics.names.values()):
    print(f"  {name}: {metrics.box.maps[i]:.3f}")
```
After training, runs validation and prints **per-class** mAP (mean average precision) — so you can see if, say, "utensils" is much worse than "clothing", which tells you that class needs more/cleaner data.

---

## 4. `inference_pipeline.py`

**Job:** wrap the trained model so it's easy to call from the API — turns a raw image into a clean, cart-ready item list.

```python
@dataclass
class DetectedBox:
    class_name: str
    confidence: float
    bbox: List[float]
```
One raw detection: what class, how confident, and where (pixel coordinates `[x1, y1, x2, y2]`).

```python
@dataclass
class CatalogedItem:
    class_name: str
    quantity: int
    avg_confidence: float
    needs_review: bool
    boxes: List[DetectedBox] = field(default_factory=list)
```
The **aggregated** output per class — e.g. "3 books detected, avg confidence 0.81". `field(default_factory=list)` is needed instead of `boxes: List[DetectedBox] = []` because mutable defaults (like an empty list) are a classic Python bug — without this, every `CatalogedItem` would accidentally share the *same* list object.

### `ItemDetector.__init__`
```python
if not Path(model_path).exists():
    raise FileNotFoundError(...)
self.model = YOLO(model_path)
self.class_names = self.model.names
```
Fails loudly and early if the trained weights file doesn't exist yet, rather than crashing confusingly later on first request. `self.model.names` pulls the class-id-to-name mapping directly from the trained model file (baked in during training from `data.yaml`).

### `_run_model(image)`
```python
results = self.model.predict(
    source=np.array(image),
    conf=CONF_THRESHOLD,
    iou=IOU_THRESHOLD,
    verbose=False,
)[0]
```
Runs the actual detection. `conf=CONF_THRESHOLD` (0.35) discards any detection below 35% confidence. `iou=IOU_THRESHOLD` controls Non-Max Suppression — when the same object gets multiple overlapping boxes, this merges/removes duplicates. `[0]` because `predict()` returns a list (one result per input image) — we only passed one image.

```python
for box in results.boxes:
    cls_id = int(box.cls.item())
    boxes.append(DetectedBox(
        class_name=self.class_names[cls_id],
        confidence=float(box.conf.item()),
        bbox=[float(v) for v in box.xyxy[0].tolist()],
    ))
```
Each `box` from ultralytics is a tensor-based object; `.cls.item()` and `.conf.item()` pull out plain Python numbers from PyTorch tensors. `box.xyxy[0].tolist()` gets the `[x1, y1, x2, y2]` pixel coordinates as a plain list.

### `_aggregate(boxes)` — the quantity estimation step
```python
by_class: Dict[str, List[DetectedBox]] = {}
for b in boxes:
    by_class.setdefault(b.class_name, []).append(b)
```
Groups all detected boxes by class name. `setdefault(key, [])` means "give me `by_class[key]`, creating it as an empty list first if it doesn't exist yet" — a compact way to build groups without checking `if key not in dict` manually.

```python
for class_name, class_boxes in by_class.items():
    avg_conf = sum(b.confidence for b in class_boxes) / len(class_boxes)
    items.append(CatalogedItem(
        class_name=class_name,
        quantity=len(class_boxes),
        avg_confidence=round(avg_conf, 3),
        needs_review=avg_conf < MIN_QUANTITY_CONF,
    ))
```
For each class: **quantity = how many boxes of that class were found** (this is the whole "quantity estimation" logic — deliberately simple, just a count). `needs_review` flags the item if the average confidence is under 0.5, so the frontend can visually highlight it for the donor to double-check.

```python
items.sort(key=lambda i: i.avg_confidence, reverse=True)
```
Sorts so the model's most confident detections appear first in the cart — donor sees the "safe" ones at top, uncertain ones lower down.

### `to_json(items)`
Converts the dataclass objects into plain dicts/lists — dataclasses aren't directly JSON-serializable, so this is the explicit conversion step before the FastAPI endpoint returns them.

---

## 5. `main.py`

**Job:** the actual HTTP server the browser talks to.

```python
app = FastAPI(title="Donation Item Detection Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```
Creates the web app. CORS middleware is needed because your React frontend (running on a different port/domain) needs permission from the backend to make requests to it — browsers block cross-origin requests by default. `allow_origins=["*"]` (allow anyone) is fine for local development but should be locked down to your actual frontend's URL before deploying.

```python
detector: ItemDetector | None = None

@app.on_event("startup")
def load_model():
    global detector
    try:
        detector = ItemDetector()
    except FileNotFoundError as e:
        detector = None
```
Loads the model **once**, when the server starts — not on every request, which would be extremely slow. `@app.on_event("startup")` is a FastAPI hook that runs this exactly once at boot. `global detector` is needed because we're reassigning a module-level variable from inside a function. If the model file doesn't exist yet, we don't crash the whole server — we let it start (so `/health` still works for debugging) but leave `detector` as `None`.

```python
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": detector is not None}
```
A simple endpoint to check the server is alive and whether the model actually loaded — useful when integrating with the frontend and something's not working.

```python
@app.post("/detect")
async def detect_items(file: UploadFile = File(...)):
    if detector is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")
```
`File(...)` tells FastAPI this endpoint expects a multipart file upload (the photo from the browser). `503 Service Unavailable` if the model never loaded — clearer than a generic 500 crash.

```python
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")

    raw = await file.read()
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image")
```
Validates the upload is actually an image before wasting time on it, reads the raw bytes, and opens it with PIL. `io.BytesIO(raw)` wraps the raw bytes so PIL can read them as if they were a file. `.convert("RGB")` normalizes format — some images are grayscale or have a transparency channel (RGBA), and the model expects consistent 3-channel RGB input.

```python
    items = detector.detect(image)
    return {
        "items": to_json(items),
        "item_count": len(items),
        "total_quantity": sum(i.quantity for i in items),
    }
```
Runs detection, converts to JSON-friendly form, and returns it along with two summary numbers the frontend can show immediately without recomputing them itself.

---

## Quick mental model

```
browser photo
    -> main.py (/detect endpoint)
        -> inference_pipeline.py (ItemDetector.detect)
            -> raw YOLOv8 boxes -> grouped into CatalogedItems
        <- JSON: [{class, quantity, confidence, needs_review}, ...]
    <- cart UI renders this, donor edits, submits

separately, offline, before any of the above works:
raw messy datasets
    -> dataset_discovery.py (auto-detects format per source)
    -> prepare_dataset.py (remaps to 6 classes, builds dataset_unified/)
    -> train.py (fine-tunes YOLOv8n, produces best.pt)
        -> that best.pt is what inference_pipeline.py loads
```
