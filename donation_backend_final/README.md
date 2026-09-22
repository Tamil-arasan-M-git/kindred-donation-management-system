# Kindred Donation Backend

FastAPI backend for the Kindred donation platform. It combines camera-based
item detection with the authenticated donation-management workflow used by
donors, NGOs, staff, and administrators.

## Backend structure

```text
donation_backend_final/
├── main.py                         FastAPI application and legacy routes
├── api_v2.py                       Authenticated /api routes
├── db.py                           SQLAlchemy models and database session
├── schemas.py                      Pydantic request/response validation
├── security.py                     Password hashing, JWT, and role checks
├── config.py                       Environment configuration
├── inference_pipeline.py           Reusable fine-tuned YOLOv8 pipeline
├── taxonomy.py                      Central model-class to category/subcategory normalization
├── target_classes.py               Canonical donation categories
├── status_service.py               Donation status transitions and permissions
├── packaging_service.py            Category-specific packaging checklists
├── notification_service.py         In-app, email, and optional Twilio delivery
├── schema.sql                      Complete PostgreSQL schema
├── migrations/                      Additive Milestone 6 and subcategory migrations
├── requirements.txt                Python dependencies
├── .env.example                    Environment variable template
├── train.py                        Fine-tunes the custom YOLOv8 model
├── prepare_dataset.py              Builds the unified training dataset
├── dataset_discovery.py            Detects supported dataset formats
├── pseudo_label.py                 Creates draft labels for supported classes
├── dedupe_check.py                 Checks train/validation/test leakage
├── visualize_labels.py             Renders annotation previews
├── camera_capture_and_cart.html    Legacy browser camera client
├── CODE_WALKTHROUGH.md             Technical file walkthrough
└── SIMPLE_GUIDE.md                 Beginner-friendly project guide
```

## Original AI model details

The backend supports two model modes controlled by `USE_CUSTOM_MODEL`.

### Default model: YOLO-World

With `USE_CUSTOM_MODEL=false`, `main.py` loads the pretrained
`yolov8s-world.pt` YOLO-World model and supplies these text classes:

```text
book, shirt, pants, dress, shoe, bottle, water bottle,
laptop, mobile phone, cell phone, bag, backpack, handbag,
chair, table, sofa, cup, plate, bowl, utensil, food
```

Detected objects are mapped into six platform categories:

| Platform category | Mapped examples |
| --- | --- |
| `books` | book |
| `clothing` | shirt, pants, dress, shoe, bag, backpack, handbag |
| `food` | food |
| `electronics` | laptop, mobile phone, cell phone |
| `furniture` | chair, table, sofa |
| `utensils` | bottle, water bottle, cup, plate, bowl, utensil |

The `/detect` route runs inference with confidence `0.25` and IoU `0.45`.
YOLO-World results are grouped by category; custom-model results remain
separate by fine-grained class. Quantities are estimated by counting detection
boxes, and average confidence below `0.50` sets `needs_review=true`.

### Optional custom model

With `USE_CUSTOM_MODEL=true`, the backend loads `CUSTOM_MODEL_PATH`, normally:

```text
runs/detect/donation_items_yolov8n/weights/best.pt
```

This is the fine-grained YOLOv8 detection model at
`runs/detect/donation_items_yolov8n/weights/best.pt`. Its 21 classes are:

```text
shirt, pants, dress, shoe, bag, other_clothing, food, books,
phone, laptop, tv, other_electronics, chair, table, sofa,
other_furniture, cup, plate, bowl, bottle, other_utensils
```

`taxonomy.py` is the single normalization layer: each model class is returned
as its parent platform category plus a subcategory. Unknown classes are kept
out of database category fields and are marked for donor review. The reusable
`inference_pipeline.py` uses confidence `0.35`, IoU `0.45`, and flags
aggregate confidence below `0.50` for donor review.

## API reference

### Legacy public AI and submission APIs

These routes support the original camera-capture frontend and remain
available for compatibility.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Confirms that the API is running. |
| `GET` | `/health` | Returns health status and the active model name. |
| `POST` | `/detect` | Accepts an image and returns legacy `class` plus `class_name`, parent `category`, optional `subcategory`, quantity, confidence, and review flags. Custom-model items remain separated by fine-grained class; YOLO-World retains category aggregation. |
| `POST` | `/submissions` | Saves the reviewed legacy cart as a submitted donation. |
| `GET` | `/submissions` | Lists legacy submissions. |
| `GET` | `/submissions/{submission_id}` | Returns one legacy submission and its item lines. |

### Authentication

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Creates a donor or NGO account with its linked profile. Public admin registration is rejected. | Public |
| `POST` | `/api/auth/login` | Authenticates a user and returns a JWT access token. | Public |
| `GET` | `/api/auth/me` | Returns the current user's account and role. | Authenticated |

### Donor profile and admin donor registry

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `GET` | `/api/donors/me` | Returns the authenticated donor profile, including optional coordinates. | Donor |
| `PUT` | `/api/donors/me` | Updates donor details and coordinates; account email remains read-only. | Donor |
| `GET` | `/api/admin/donors` | Lists donor records with `limit` and `offset` pagination. | Admin |

### NGO and demand APIs

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `POST` | `/api/ngos` | Creates an unverified NGO. | Admin |
| `GET` | `/api/ngos` | Lists NGOs with city, verification, and pagination filters. | Public |
| `GET` | `/api/ngos/{ngo_id}` | Returns one NGO profile. | Public |
| `PUT` | `/api/ngos/{ngo_id}` | Updates NGO profile and location. | NGO owner/admin |
| `PATCH` | `/api/ngos/{ngo_id}/verification` | Verifies or un-verifies an NGO. | Admin |
| `DELETE` | `/api/ngos/{ngo_id}` | Deactivates an NGO and its users without deleting history. | Admin |
| `POST` | `/api/ngos/{ngo_id}/demands` | Creates a category demand with optional subcategory, quantity, priority, and expiry. | NGO owner/admin |
| `GET` | `/api/ngos/{ngo_id}/demands` | Lists demands with active/category/priority filters. | NGO owner/admin |
| `GET` | `/api/demands/{demand_id}` | Returns one demand. | NGO owner/admin |
| `PUT` | `/api/demands/{demand_id}` | Updates a demand. | NGO owner/admin |
| `DELETE` | `/api/demands/{demand_id}` | Deletes a demand. | NGO owner/admin |

### Donation APIs

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `POST` | `/api/donations` | Creates a donation with one or more categorized item lines; each line may include a taxonomy-valid subcategory. | Donor |
| `GET` | `/api/donations` | Lists donations filtered by role, status, limit, and offset. | Authenticated |
| `GET` | `/api/donations/{donation_id}` | Returns donation details, items, NGO, matches, pickup time, and history. | Owner/NGO/admin |
| `PUT` | `/api/donations/{donation_id}` | Replaces item lines while the donation is submitted. | Donor owner |
| `POST` | `/api/donations/{donation_id}/cancel` | Cancels a donation through the status rules. | Owner/NGO/admin |
| `PATCH` | `/api/donations/{donation_id}/status` | Applies an authorized audited status transition. | Owner/NGO/admin |
| `GET` | `/api/donations/{donation_id}/status-history` | Returns status audit history. | Owner/NGO/admin |

Donation lifecycle:

```text
submitted -> matched -> packaging_notified -> pickup_scheduled
           -> collected -> delivered -> acknowledged
```

### Matching APIs

Matching uses category, quantity fit, NGO demand priority, and geographic
distance when coordinates are available. A demand with a subcategory matches
that exact subcategory; a category-only demand remains compatible with all
subcategories in its category. Results include explainable score components;
semantic similarity is not used unless an embedding service is added later.

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `POST` | `/api/donations/{donation_id}/match` | Finds and stores compatible NGO matches. | Donor owner/admin |
| `GET` | `/api/donations/{donation_id}/matches` | Lists stored matches for a donation. | Owner/NGO/admin |
| `GET` | `/api/matches/{match_id}` | Returns one match and its score details. | Owner/matched NGO/admin |
| `POST` | `/api/matches/{match_id}/accept` | Accepts a match and associates the NGO. | Owner/matched NGO/admin |
| `POST` | `/api/matches/{match_id}/reject` | Rejects a match with an optional reason. | Owner/matched NGO/admin |
| `GET` | `/api/ngos/{ngo_id}/matches` | Lists incoming NGO matches with filters. | NGO owner/admin |

### Packaging and pickup APIs

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `POST` | `/api/donations/{donation_id}/packaging-notify` | Moves an accepted donation to `packaging_notified` and creates notifications. | Assigned NGO/admin |
| `GET` | `/api/donations/{donation_id}/packaging-checklist` | Returns category-specific packaging tasks. | Donor/NGO/admin |
| `GET` | `/api/donations/{donation_id}/pickup` | Returns the current pickup schedule. | Donor/NGO/admin |
| `POST` | `/api/donations/{donation_id}/pickup/schedule` | Schedules a future pickup and moves the donation to `pickup_scheduled`. | Donor/NGO/admin |
| `PUT` | `/api/donations/{donation_id}/pickup` | Reschedules an existing pickup. | Donor/NGO/admin |
| `POST` | `/api/donations/{donation_id}/pickup/reschedule` | Deprecated compatibility alias for rescheduling pickup. | Donor/NGO/admin |

Pickup timestamps must include a timezone and be in the future.

### NGO staff and operations APIs

Staff roles are `packaging`, `pickup`, and `delivery`. Staff are scoped to an
NGO and must be active and assigned to the matching task type.

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `GET` | `/api/ngos/me/staff` | Lists NGO staff with active and pagination filters. | NGO |
| `POST` | `/api/ngos/me/staff` | Creates staff and rejects duplicate email within the NGO. | NGO |
| `PUT` | `/api/ngos/me/staff/{staff_id}` | Updates staff details or active state. | NGO |
| `DELETE` | `/api/ngos/me/staff/{staff_id}` | Deactivates staff while preserving history. | NGO |
| `GET` | `/api/ngos/me/operations` | Lists NGO operations with task and status filters. | NGO |
| `GET` | `/api/ngos/me/operations/today` | Lists today's operations. | NGO |
| `POST` | `/api/donations/{donation_id}/operations` | Assigns packaging, pickup, or delivery work. | Assigned NGO/admin |
| `GET` | `/api/donations/{donation_id}/operations` | Lists operations for an accessible donation. | Donor/NGO/admin |
| `PUT` | `/api/donations/{donation_id}/operations/{assignment_id}` | Updates staff, task, schedule, notes, or operation status. | Assigned NGO/admin |

Operation statuses are `scheduled`, `in_progress`, `completed`, and
`cancelled`. The backend validates NGO ownership, staff role, active state,
legal status transitions, overlapping assignments, and exact pickup time
matching. Only one `scheduled` or `in_progress` operation may exist for a
donation and task type. Completed and cancelled records remain as history.
The validated `staff_id` is passed to the ORM exactly once. Operation
responses include nested `staff`, the stored `operation_status`, the related
`donation_status`, and the display `status`. When a donation reaches
`acknowledged`, its operation display status is reported as `completed` while
the stored operation status remains available in `operation_status`.

### Notifications and dashboards

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `GET` | `/api/notifications` | Lists the current user's notifications with unread and pagination filters. | Authenticated |
| `PATCH` | `/api/notifications/{notification_id}/read` | Marks one owned notification as read. | Authenticated |
| `PATCH` | `/api/notifications/read-all` | Marks all owned notifications as read. | Authenticated |
| `GET` | `/api/donors/me/dashboard` | Returns donor counts, active matches, pickup status, impact, and activity. | Donor |
| `GET` | `/api/ngos/me/dashboard` | Returns NGO demand, match, donation, operation, and activity metrics. | NGO |
