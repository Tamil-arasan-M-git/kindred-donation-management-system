# Donation Platform — Camera-Based Item Detection Backend

Week 1-2 backend deliverable: browser camera capture -> YOLOv8-based item
detection -> editable cart. This package covers the AI/backend half
(dataset prep, training, inference API).

## What's in this folder

| File                           | Stage              | What it does                                                                                                                            |
| ------------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `target_classes.py`            | Setup              | The 6 final categories, in fixed order. Everything else imports from here.                                                              |
| `dataset_discovery.py`         | Data prep          | Auto-detects a dataset's format (YOLO/COCO/VOC/class-folders) and reads it.                                                             |
| `pseudo_label.py`              | Data prep          | Uses the pretrained YOLOv8n (COCO classes) to auto-draft labels for electronics/furniture/utensils/books/food.                          |
| `prepare_dataset.py`           | Data prep          | Merges every dataset (pseudo-labeled + your clothing dataset) into one clean unified dataset. Prints a class-balance report at the end. |
| `dedupe_check.py`              | Data prep (verify) | Checks for near-duplicate images across train/val/test splits — catches data leakage before it inflates your validation accuracy.       |
| `visualize_labels.py`          | Data prep (verify) | Draws bounding boxes onto a random sample of images so you can visually confirm annotations are correct, not just trust the numbers.    |
| `train.py`                     | Training           | Fine-tunes YOLOv8 nano on the unified dataset.                                                                                          |
| `inference_pipeline.py`        | Serving            | Loads the trained model, runs detection, aggregates results into cart-ready JSON.                                                       |
| `main.py`                      | Serving            | FastAPI server: `/detect` for the camera-capture frontend, `/submissions` to save the donor's reviewed cart to PostgreSQL.              |
| `db.py`                        | Database           | SQLAlchemy models + connection, matching `schema.sql`.                                                                                  |
| `schema.sql`                   | Database           | Multi-tenant PostgreSQL schema — NGOs as tenants, donors, item submissions, demand records.                                             |
| `camera_capture_and_cart.html` | Frontend           | Browser camera capture (MediaDevices API) + editable item cart, calls `/detect` then `/submissions`.                                    |
| `requirements.txt`             | Setup              | Python dependencies.                                                                                                                    |
| `CODE_WALKTHROUGH.md`          | Docs               | Line-by-line explanation of every file (technical).                                                                                     |
| `SIMPLE_GUIDE.md`              | Docs               | Plain-language explanation of every file (beginner-friendly).                                                                           |

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

If pip tries to _compile_ numpy from source and fails with a
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

For Milestone 2, copy `.env.example` to `.env` and set at least
`DATABASE_URL` and a long random `JWT_SECRET_KEY`. The API loads these
settings at startup; `.env` is ignored by Git. You can also configure
`JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ALLOWED_ORIGINS`,
`USE_CUSTOM_MODEL`, `CUSTOM_MODEL_PATH`, and `MAX_UPLOAD_BYTES`.

`MAX_UPLOAD_BYTES` defaults to 10 MiB. The `/detect` endpoint accepts only
PNG, JPG/JPEG, BMP, and WebP uploads. The API also adds basic security
headers and returns generic 500 responses while logging the detailed server
exception locally.

Apply the additive tables and constraint changes in `schema.sql` to an
existing development database using a migration process; do not drop data.
The current database rules require donation and demand quantities to be at
least 1, and detection confidence values must be between 0 and 1 when present.

Milestone 2 authenticated routes are grouped under `/api`: authentication,
NGO and demand management, donor donations, audited status transitions, and
transparent rule-based matching. Matching uses item category, quantity fit,
Haversine distance when coordinates exist, and demand priority. Semantic
vector similarity is intentionally reported as unavailable until an actual
embedding service is configured.

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

## API endpoint reference

The interactive API documentation is available at `/docs`, with the raw
OpenAPI document at `/openapi.json` and ReDoc at `/redoc`.

### Public and legacy endpoints

These routes are preserved for the Milestone 1 frontend.

| Method | Endpoint                       | What it does                                                                                                                                 | Access             |
| ------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `GET`  | `/`                            | Confirms that the Donation Platform API is running.                                                                                          | Public             |
| `GET`  | `/health`                      | Returns backend health and the active AI model name.                                                                                         | Public             |
| `POST` | `/detect`                      | Accepts an image, runs YOLO/YOLO-World detection, maps objects to the six donation categories, and returns quantities and confidence values. | Public             |
| `POST` | `/submissions`                 | Saves the reviewed cart from the existing camera frontend as a donation submission.                                                          | Public legacy flow |
| `GET`  | `/submissions`                 | Lists saved legacy submissions for the database view.                                                                                        | Public legacy flow |
| `GET`  | `/submissions/{submission_id}` | Returns one legacy submission and its item lines.                                                                                            | Public legacy flow |

### Authentication

Send the returned token on protected requests as
`Authorization: Bearer <access_token>`.

| Method | Endpoint             | What it does                                                                                                                          | Access        |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `POST` | `/api/auth/register` | Creates a donor or NGO account and securely hashes the password. Donor and NGO accounts are linked to their ownership record; admin accounts cannot be created publicly. | Public        |
| `POST` | `/api/auth/login`    | Checks credentials and returns a JWT access token plus basic user information.                                                        | Public        |
| `GET`  | `/api/auth/me`       | Returns the currently authenticated user's ID, email, role, and active status.                                                        | Authenticated |

### NGO management

| Method   | Endpoint                          | What it does                                                                                             | Access             |
| -------- | --------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------ |
| `POST`   | `/api/ngos`                       | Creates an NGO, validates contact details and coordinates, and starts it as unverified.                  | Admin              |
| `GET`    | `/api/ngos`                       | Lists NGOs with optional `city`, `verified`, `limit`, and `offset` filters.                              | Public             |
| `GET`    | `/api/ngos/{ngo_id}`              | Returns public information for one NGO.                                                                  | Public             |
| `PUT`    | `/api/ngos/{ngo_id}`              | Updates an NGO's profile and location information.                                                       | NGO owner or admin |
| `PATCH`  | `/api/ngos/{ngo_id}/verification` | Approves or removes an NGO's verified status.                                                            | Admin              |
| `DELETE` | `/api/ngos/{ngo_id}`              | Deactivates an NGO by un-verifying it and disabling its NGO users without deleting historical donations. | Admin              |

### Admin donor registry

The donor registry is available only to authenticated admin users. Send the
JWT returned by `/api/auth/login` as `Authorization: Bearer <access_token>`.

| Method | Endpoint | What it does | Access |
| ------ | -------- | ------------ | ------ |
| `GET` | `/api/admin/donors` | Lists donor records ordered by donor ID. Supports `limit` and `offset`; `limit` must be between 1 and 100. | Admin |

Example:

```bash
curl -H "Authorization: Bearer <admin_access_token>" \
  "http://localhost:8000/api/admin/donors?limit=50&offset=0"
```

Unauthenticated or non-admin requests receive `401` or `403` respectively.

### NGO demand registry

Supported categories are `clothing`, `food`, `books`, `electronics`,
`furniture`, and `utensils`. Demand priority is from 1 to 5.

| Method   | Endpoint                     | What it does                                                                                                                                  | Access             |
| -------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `POST`   | `/api/ngos/{ngo_id}/demands` | Creates an NGO demand with category, quantity, priority, and optional expiry date.                                                            | NGO owner or admin |
| `GET`    | `/api/ngos/{ngo_id}/demands` | Lists demands with optional `active_only`, `class_name`, `priority`, `limit`, and `offset` filters. Active demands have quantity above zero and are not expired. | NGO owner or admin |
| `GET`    | `/api/demands/{demand_id}`   | Returns one demand after checking NGO ownership.                                                                                              | NGO owner or admin |
| `PUT`    | `/api/demands/{demand_id}`   | Updates a demand's category, quantity, priority, or expiry date.                                                                              | NGO owner or admin |
| `DELETE` | `/api/demands/{demand_id}`   | Deletes a demand.                                                                                                                             | NGO owner or admin |

### Donation management

| Method | Endpoint                              | What it does                                                                                                                                                      | Access                                     |
| ------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `POST` | `/api/donations`                      | Creates a submitted donation for the authenticated donor and stores each item, quantity, and AI confidence.                                                       | Donor                                      |
| `GET`  | `/api/donations`                      | Lists donations. Donors see only their own donations; NGO users see donations matched to their NGO; admins can see all. Supports `status`, `limit`, and `offset`. | Authenticated                              |
| `GET`  | `/api/donations/{donation_id}`        | Returns one donation with ownership and item details.                                                                                                             | Owner, associated NGO, or admin            |
| `PUT`  | `/api/donations/{donation_id}`        | Replaces item lines before matching and marks the new lines as donor-edited while retaining submitted confidence values.                                          | Donation owner while status is `submitted` |
| `POST` | `/api/donations/{donation_id}/cancel` | Cancels a donation through the legal status-transition system.                                                                                                    | Donation owner, associated NGO, or admin   |

The current API keeps image detection separate for frontend compatibility:
call `POST /detect` first, let the donor review the result, then call
`POST /api/donations` or the legacy `POST /submissions` route. A separate
`/api/donations/from-image` endpoint is not currently implemented.

### Donation status and audit history

Allowed transitions are `submitted -> matched -> packaging_notified ->
pickup_scheduled -> collected -> delivered -> acknowledged`. A donation can
be cancelled before collection. Every status change records the previous
status, new status, authenticated user, timestamp, and optional notes.

| Method  | Endpoint                                      | What it does                                                                          | Access                                   |
| ------- | --------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------- |
| `PATCH` | `/api/donations/{donation_id}/status`         | Validates and applies a legal status transition, then writes a status-history record. | Donation owner, associated NGO, or admin |
| `GET`   | `/api/donations/{donation_id}/status-history` | Returns the donation's chronological status changes and notes.                        | Donation owner, associated NGO, or admin |

### Matching

Matching considers verified NGOs with active demands. It calculates exact
category match, quantity fit, geographic proximity using the Haversine
formula when coordinates exist, and NGO demand priority. Results are ranked
and the score components are returned for transparency. Semantic/vector
similarity is not claimed or used unless a future embedding service is added.

| Method | Endpoint                               | What it does                                                                                                                  | Access                                   |
| ------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `POST` | `/api/donations/{donation_id}/match`   | Finds active compatible NGO demands, calculates explainable scores, stores recommended matches, and returns them ranked.      | Donation owner or admin                  |
| `GET`  | `/api/donations/{donation_id}/matches` | Lists stored matches for a donation, sorted by score with score components and explanations.                                  | Donation owner, associated NGO, or admin |
| `GET`  | `/api/matches/{match_id}`              | Returns one match with its NGO, donation reference, score breakdown, and rejection reason if present.                         | Donation owner, matched NGO, or admin    |
| `POST` | `/api/matches/{match_id}/accept`       | Accepts a candidate, rejects competing candidates, associates the donation with the NGO, and moves the donation to `matched`. | Donation owner, matched NGO, or admin    |
| `POST` | `/api/matches/{match_id}/reject`       | Rejects a match and preserves an optional rejection reason.                                                                   | Donation owner, matched NGO, or admin    |
| `GET`  | `/api/ngos/{ngo_id}/matches`           | Lists incoming matches for an NGO with optional `status`, `limit`, and `offset` filters.                                      | NGO owner or admin                       |

## Notes

- Clothing has no pretrained-model shortcut — COCO has no clothing classes,
  so that dataset must already be labeled (or labeled by hand).
- `target_classes.py` is the single source of truth for class order —
  don't edit it after you've started labeling/training, or class IDs will
  no longer match across your files.
- Steps 5 and 6 (dedupe check, visual label check) are easy to skip when
  in a hurry — don't. A leaked duplicate or a wrong box is much cheaper to
  catch here than after an 80-epoch training run.
