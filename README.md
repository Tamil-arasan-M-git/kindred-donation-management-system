# Donation Platform — Camera-Based Item Detection Backend

Week 1-2 backend deliverable: browser camera capture -> YOLOv8-based item
detection -> editable cart. This package covers the AI/backend half
(dataset prep, training, inference API).

## What's in this folder

| File | Stage | What it does |
|---|---|---|
| `target_classes.py` | Setup | The 6 final categories, in fixed order. Everything else imports from here. |
| `dataset_discovery.py` | Data prep | Auto-detects a dataset's format (YOLO/COCO/VOC/class-folders) and reads it. |
| `pseudo_label.py` | Data prep | Uses the pretrained YOLOv8n (COCO classes) to auto-draft labels for electronics/furniture/utensils/books/food. |
| `prepare_dataset.py` | Data prep | Merges every dataset (pseudo-labeled + your clothing dataset) into one clean unified dataset. Prints a class-balance report at the end. |
| `dedupe_check.py` | Data prep (verify) | Checks for near-duplicate images across train/val/test splits — catches data leakage before it inflates your validation accuracy. |
| `visualize_labels.py` | Data prep (verify) | Draws bounding boxes onto a random sample of images so you can visually confirm annotations are correct, not just trust the numbers. |
| `train.py` | Training | Fine-tunes YOLOv8 nano on the unified dataset. |
| `inference_pipeline.py` | Serving | Loads the trained model, runs detection, aggregates results into cart-ready JSON. |
| `main.py` | Serving | FastAPI server: `/detect` for the camera-capture frontend, `/submissions` to save the donor's reviewed cart to PostgreSQL. |
| `db.py` | Database | SQLAlchemy models + connection, matching `schema.sql`. |
| `schema.sql` | Database | Multi-tenant PostgreSQL schema — NGOs as tenants, donors, item submissions, demand records. |
| `camera_capture_and_cart.html` | Frontend | Browser camera capture (MediaDevices API) + editable item cart, calls `/detect` then `/submissions`. |
| `requirements.txt` | Setup | Python dependencies. |
| `CODE_WALKTHROUGH.md` | Docs | Line-by-line explanation of every file (technical). |
| `SIMPLE_GUIDE.md` | Docs | Plain-language explanation of every file (beginner-friendly). |

Read `SIMPLE_GUIDE.md` first if you're new to this, then `CODE_WALKTHROUGH.md`
when you want the line-by-line detail.

## Setup

```bash
# 1. Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt
# (if you're NOT in a venv and get an "externally managed environment" error:
#  pip install -r requirements.txt --break-system-packages)
```

### Windows: "Unknown compiler" / numpy build error
If pip tries to *compile* numpy from source and fails with a
`vswhere.exe`/`cl`/`gcc not found` error, it means pip couldn't find a
prebuilt wheel for your Python version (common on brand-new Python
releases like 3.13). Fix, in order of preference:

1. Check `python --version`. If it's very new (3.13+), install Python
   3.11 or 3.12 instead and create your venv with that:
   ```bash
   py -3.11 -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. Or force pip to only use prebuilt wheels (never compile from source):
   ```bash
   pip install --only-binary :all: -r requirements.txt
   ```
   If this fails for a specific package, it means no wheel exists for
   your Python version at all — go with option 1 instead.

## Execution order

### 1. Organize your raw images
```
raw_datasets/
  electronics_raw/      # unlabeled photos
  furniture_raw/        # unlabeled photos
  utensils_raw/         # unlabeled photos
  books_raw/            # unlabeled photos
  food_raw/             # unlabeled photos
  clothing_dataset/     # your already-labeled clothing dataset, any format
```

### 2. Auto-draft labels for the 5 COCO-overlapping categories
```bash
python pseudo_label.py --input raw_datasets/electronics_raw --category electronics
python pseudo_label.py --input raw_datasets/furniture_raw   --category furniture
python pseudo_label.py --input raw_datasets/utensils_raw    --category utensils
python pseudo_label.py --input raw_datasets/books_raw       --category books
python pseudo_label.py --input raw_datasets/food_raw        --category food
```
Then open `pseudo_labeled/review_report.csv` and spot-check the flagged rows
(low confidence / zero detections) before trusting them.

### 3. Fill in the label map, dry run first
Open `prepare_dataset.py`:
- `SOURCE_ROOTS` already points at `pseudo_labeled/` and
  `raw_datasets/clothing_dataset` — adjust paths if yours differ.
- Set `DRY_RUN = True`, then run:
```bash
python prepare_dataset.py
```
This prints every class name found that isn't yet in `LABEL_MAP` (mainly
your clothing dataset's own class names). Add them to `LABEL_MAP`, mapped
to `"clothing"`.

### 4. Build the unified dataset for real
Set `DRY_RUN = False`, run `prepare_dataset.py` again. Output:
```
dataset_unified/
  images/{train,val,test}/
  labels/{train,val,test}/
  data.yaml
```
It also prints a class-balance table — check no class is far below the others.

### 5. Check for cross-split duplicates (do this before training)
```bash
python dedupe_check.py --dataset dataset_unified
```
If it reports cross-split leakage (the same/near-identical photo in two
splits), remove the duplicate from one split — otherwise your validation
accuracy will look better than the model actually is.

### 6. Visually verify a sample of annotations
```bash
python visualize_labels.py --dataset dataset_unified --split train --n 20
```
Open the images saved in `label_preview/train/` and check: is each box
actually around the right item, with the right class name? This catches
mistakes that numbers alone (confidence scores, class counts) can't show you.
This matters especially for pseudo-labeled classes and the whole-image
boxes from folder-only sources.

### 7. Sanity-check training, then train for real
```bash
python train.py --epochs 20      # quick check — catches label mistakes fast
python train.py                  # full run (default 80 epochs)
```
Best weights land at `runs/detect/donation_items_yolov8n/weights/best.pt`.

### 8. Point the inference pipeline at your weights
`inference_pipeline.py`'s `MODEL_PATH` already defaults to that path — only
edit it if you changed `--name`/`--project` during training.

### 9. Set up PostgreSQL
```bash
createdb donation_platform
psql -U your_user -d donation_platform -f schema.sql
```
Set the connection string as an environment variable before starting the API:
```bash
# macOS/Linux:
export DATABASE_URL="postgresql://your_user:your_password@localhost:5432/donation_platform"
# Windows PowerShell:
$env:DATABASE_URL = "postgresql://your_user:your_password@localhost:5432/donation_platform"
```

### 10. Run the API and test it
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
```bash
curl http://localhost:8000/health
curl -X POST -F "file=@some_test_photo.jpg" http://localhost:8000/detect
```
Once `/detect` returns sensible JSON, open `camera_capture_and_cart.html` directly
in a browser (or serve it with any static file server) to test the full
camera -> detect -> editable cart -> submit -> PostgreSQL flow end to end.

## Notes
- Clothing has no pretrained-model shortcut — COCO has no clothing classes,
  so that dataset must already be labeled (or labeled by hand).
- `target_classes.py` is the single source of truth for class order —
  don't edit it after you've started labeling/training, or class IDs will
  no longer match across your files.
- Steps 5 and 6 (dedupe check, visual label check) are easy to skip when
  in a hurry — don't. A leaked duplicate or a wrong box is much cheaper to
  catch here than after an 80-epoch training run.
