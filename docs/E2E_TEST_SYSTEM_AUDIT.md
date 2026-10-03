# E2E Test System Audit

## 1. Application Overview

### VERIFIED:
- **Project Title**: "AI-Driven Smart Donation Management System for Intelligent Resource Allocation and Community Support" (referenced internally as Kindred / Donation Platform API).
- **Architecture**: Decoupled multi-tier web application consisting of a React single-page frontend (SPA), a FastAPI RESTful backend service, an Ultralytics YOLOv8 object detection inference pipeline, and a PostgreSQL relational database.
- **Core Purpose**: Connects individual donors, non-governmental organizations (NGOs), and platform administrators.
  - Donors scan items via camera/upload, verify detected inventory items, create donation submissions, receive match recommendations, and schedule pickups.
  - NGOs post category/subcategory resource demands, review incoming donation matches, accept/reject matches, assign operational staff (packaging, pickup, delivery), and acknowledge completed donations.
  - Administrators monitor platform metrics, review growth and registration statistics, verify registered NGOs, and audit platform activities.

### NOT VERIFIED:
- Live external deployment URLs, cloud hosting infrastructure, or production CI/CD pipelines (no deployment configs or cloud manifests found in repository).

---

## 2. Repository Structure

### VERIFIED:
The repository is on Git branch `Tamilarasan-M` and contains the following directories and notable files:

- `donation_backend_final/`: The primary active backend application containing all authenticated APIs, models, schemas, and services.
  - `main.py`: FastAPI application entry point, CORS middleware, security headers, and AI detection/submission routes.
  - `api_v2.py`: Authenticated `/api` router covering authentication, donor profiles, NGOs, demands, staff, operations, donations, matching, packaging, pickup, notifications, and admin metrics.
  - `db.py`: SQLAlchemy database models and database session setup (`get_db`).
  - `schemas.py`: Pydantic v2 schemas for request and response validation.
  - `security.py`: PBKDF2 password hashing, JWT creation/decoding, and role authorization dependencies.
  - `config.py`: Environment configuration loading database, JWT, CORS, YOLO model, SMTP, and Twilio settings.
  - `taxonomy.py`: Central 81-class taxonomy normalization and category/subcategory mapping.
  - `status_service.py`: Donation lifecycle state machine transitions and role permission enforcement.
  - `packaging_service.py`: Deterministic category-specific packaging checklists.
  - `notification_service.py`: Multi-channel notification dispatch (in-app DB persistence, SMTP email, and Twilio SMS/WhatsApp).
  - `inference_pipeline.py`: Reusable standalone YOLOv8 inference wrapper.
  - `schema.sql`: Full DDL script for PostgreSQL database schema and indexes.
  - `migrations/`: Additive SQL migration scripts (`001_milestone6_notifications.sql` to `004_subcategory_support.sql`).
  - `tests/`: Contains `conftest.py` and `test_subcategory_integration.py`.
  - `best_81class.pt`: Custom trained YOLOv8 model weights file (~5.5 MB).
  - `yolov8s-world.pt`: Pretrained zero-shot YOLO-World model weights (~27.2 MB).
  - `weights/clip/ViT-B-32.pt`: CLIP ViT-B-32 visual model weights (~354 MB).
- `frontend/`: Active React 19 / Vite single-page application.
  - `src/api/client.js`: Centralized Fetch API client with bearer token handling and IndexedDB caching.
  - `src/cache/indexedDb.js`: IndexedDB wrapper for offline caching and sync checks.
  - `src/context/AuthContext.jsx`: Authentication context handling login, registration, logout, and token storage.
  - `src/routes/AppRoutes.jsx`: Client-side route declarations and role-based route guards.
  - `src/routes/ProtectedRoute.jsx`: Role authorization route wrapper.
  - `src/pages/`: Donor, NGO, Admin, Auth, and Home pages.
  - `src/components/`: Subdivided into `admin`, `common`, `donations`, `home`, `layout`, `matches`, and `notifications`.
  - `src/i18n/`: Internationalization setup with locales for English (`en`), Hindi (`hi`), and Bengali (`bn`).
- `backend/`: Legacy/auxiliary folder containing only `notification_triggers.py` (a helper library for programmatic notification firing).
- `frontend_old/`: Archived legacy frontend application.
- Root Files:
  - `main.py`, `db.py`, `inference_pipeline.py`, `schema.sql`: Standalone Milestone 1 legacy implementation (contains no authentication, no matching, and no NGO operations).
  - `camera_capture_and_cart.html`, `submissions_view.html`: Standalone prototype HTML files.
  - `dataset_discovery.py`, `prepare_dataset.py`, `pseudo_label.py`, `train.py`, `visualize_labels.py`, `dedupe_check.py`: Model training and dataset management scripts.
  - `dataset_unified/`, `raw_datasets/`, `label_preview/`: Dataset directories for YOLO training.

### NOT VERIFIED:
- Purpose of empty files `dir` and `findstr` in root directory (likely artifacts of terminal command redirection).
- Active usage of root `main.py` by any production component (all frontend calls route to `donation_backend_final/main.py`).

---

## 3. Frontend

### VERIFIED:
- **Framework & Tooling**: React 19.2.8, Vite 8.3.0, React Router DOM 7.18.3, Oxlint 1.81.0 (`frontend/package.json`).
- **Styling**: Standard CSS stylesheets scoped per component and page (`App.css`, `HomePage.css`, `DonorDashboard.css`, etc.).
- **Client Routing**: Configured in `frontend/src/routes/AppRoutes.jsx`:
  - Public routes: `/`, `/login`, `/register`.
  - Donor routes (Guarded by `allowedRoles={["donor"]}`): `/donor`, `/donor/scan`, `/donor/review`, `/donor/donations`, `/donor/donations/:id`, `/donor/donations/:id/matches`, `/donor/matches`, `/donor/pickup`, `/donor/profile`.
  - NGO routes (Guarded by `allowedRoles={["ngo"]}`): `/ngo`, `/ngo/demands`, `/ngo/matches`, `/ngo/matches/:id`, `/ngo/donations`, `/ngo/donations/:id`, `/ngo/operations`, `/ngo/staff`, `/ngo/profile`.
  - Admin routes (Guarded by `allowedRoles={["admin"]}`): `/admin`, `/admin/ngos`, `/admin/donors`, `/admin/donations`, `/admin/demands`, `/admin/matches`.
- **API Client**: `frontend/src/api/client.js` uses native `fetch`, injects `Authorization: Bearer <token>` from `localStorage.getItem("kindred_token")`, and routes to base URL specified by `VITE_API_BASE_URL` (defaulting to `http://localhost:8000`).
- **Client Cache & Offline Resilience**: `frontend/src/cache/indexedDb.js` provides client-side caching for `donations`, `demands`, `matches`, `staff`, `operations`, `ngos`, and `donors`.
- **Progressive Web App**: Configured in `frontend/public/manifest.webmanifest`, `frontend/public/sw.js`, and `frontend/src/components/common/PWAStatus.jsx`.

### NOT VERIFIED:
- Server-side rendering (SSR) or alternate bundlers (Vite SPA client-only).

---

## 4. Backend

### VERIFIED:
- **Framework**: FastAPI (>=0.115,<1.0) running on Python 3.13.15.
- **Entry Point**: `donation_backend_final/main.py` (`app = FastAPI(title="Donation Platform API", version="1.0.0")`).
- **Router Integration**: `app.include_router(milestone2_router)` mounts all endpoints from `api_v2.py` under the `/api` prefix.
- **Middleware**:
  - `CORSMiddleware`: Configured with allowed origins from `config.py` (default includes `http://localhost:3000`, `http://localhost:5173`, `http://localhost:5174`).
  - Security headers middleware: Injects `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Strict-Transport-Security` on HTTPS.
  - Request logging middleware: Records HTTP method, path, response status, and duration in ms.
- **Core Endpoints**:
  - Legacy/Public: `GET /`, `GET /health`, `POST /detect`, `POST /submissions`, `GET /submissions`, `GET /submissions/{id}`.
  - Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
  - Donors: `GET /api/donors/me`, `PUT /api/donors/me`, `GET /api/donors/me/dashboard`.
  - NGOs: `POST /api/ngos`, `GET /api/ngos`, `GET /api/ngos/{ngo_id}`, `PUT /api/ngos/{ngo_id}`, `PATCH /api/ngos/{ngo_id}/verification`, `DELETE /api/ngos/{ngo_id}`, `GET /api/ngos/me/dashboard`.
  - Demands: `POST /api/ngos/{ngo_id}/demands`, `GET /api/ngos/{ngo_id}/demands`, `GET /api/demands/{demand_id}`, `PUT /api/demands/{demand_id}`, `DELETE /api/demands/{demand_id}`.
  - Staff: `GET /api/ngos/me/staff`, `POST /api/ngos/me/staff`, `PUT /api/ngos/me/staff/{staff_id}`, `DELETE /api/ngos/me/staff/{staff_id}`.
  - Operations: `GET /api/ngos/me/operations`, `GET /api/ngos/me/operations/today`, `POST /api/donations/{donation_id}/operations`, `GET /api/donations/{donation_id}/operations`, `PUT /api/donations/{donation_id}/operations/{assignment_id}`.
  - Donations: `POST /api/donations`, `GET /api/donations`, `GET /api/donations/{donation_id}`, `PUT /api/donations/{donation_id}`, `POST /api/donations/{donation_id}/cancel`, `PATCH /api/donations/{donation_id}/status`, `GET /api/donations/{donation_id}/status-history`.
  - Matching: `POST /api/donations/{donation_id}/match`, `GET /api/donations/{donation_id}/matches`, `GET /api/matches/{match_id}`, `POST /api/matches/{match_id}/accept`, `POST /api/matches/{match_id}/reject`, `GET /api/ngos/{ngo_id}/matches`.
  - Packaging & Pickup: `POST /api/donations/{donation_id}/packaging-notify`, `GET /api/donations/{donation_id}/packaging-checklist`, `GET /api/donations/{donation_id}/pickup`, `POST /api/donations/{donation_id}/pickup/schedule`, `PUT /api/donations/{donation_id}/pickup`.
  - Notifications: `GET /api/notifications`, `PATCH /api/notifications/{notification_id}/read`, `PATCH /api/notifications/read-all`.
  - Admin: `GET /api/admin/dashboard`, `GET /api/admin/donors`.

### NOT VERIFIED:
- Endpoints called by frontend that are missing in backend:
  - `GET /api/admin/donations/{donation_id}` (frontend `AdminDonationsPage.jsx` calls `api.getAdminDonationDetail`, but backend does not define `/admin/donations/{id}`; admin can access `GET /api/donations/{id}` instead).
  - `PATCH /api/admin/donors/{donor_id}/verification` (frontend `AdminDonorsPage.jsx` calls `api.setDonorVerification`, but backend has no donor verification endpoint).
  - `DELETE /api/ngos/me/staff/{staff_id}/permanent` (frontend `NGOStaffPage.jsx` calls `api.permanentlyDeleteNgoStaff`, but backend only provides soft deactivation `DELETE /api/ngos/me/staff/{staff_id}`).

---

## 5. Database

### VERIFIED:
- **Database Engine**: PostgreSQL (running PostgreSQL 18 on localhost:5432).
- **ORM**: SQLAlchemy 2.0 with sessionmaker (`donation_backend_final/db.py`).
- **Connection Configuration**: Loaded via `DATABASE_URL` in `donation_backend_final/.env` (defaulting to `postgresql://postgres:postgres123@localhost:5432/donation_platform`).
- **Database Extension**: Requires `uuid-ossp` for UUID v4 generation.
- **Tables and Relationships** (11 tables defined in `donation_backend_final/db.py`):
  1. `ngos`: NGO profiles (`id`, `name`, `contact_email`, `contact_phone`, `address`, `city`, `latitude`, `longitude`, `verified`, `created_at`).
  2. `donors`: Donor profiles (`id`, `name`, `email`, `phone`, `city`, `latitude`, `longitude`, `created_at`). Note: No `verified` column exists.
  3. `users`: Auth accounts (`id`, `email`, `password_hash`, `role`, `is_active`, `ngo_id`, `donor_id`, `created_at`, `updated_at`). Constraint: `role IN ('donor', 'ngo', 'admin')`.
  4. `item_submissions`: Donation carts (`id`, `donor_id`, `ngo_id`, `status`, `pickup_scheduled_at`, `created_at`, `updated_at`). Constraint: `status IN ('submitted', 'matched', 'packaging_notified', 'pickup_scheduled', 'collected', 'delivered', 'acknowledged', 'cancelled')`.
  5. `item_submission_lines`: Items within a donation (`id`, `submission_id`, `class_name`, `category`, `subcategory`, `quantity`, `detection_confidence`, `was_edited_by_donor`).
  6. `demand_records`: NGO requirements (`id`, `ngo_id`, `class_name`, `subcategory`, `quantity_needed`, `priority`, `expiry_date`, `created_at`). Constraint: `priority BETWEEN 1 AND 5`.
  7. `status_history`: Audit trail for donation transitions (`id`, `submission_id`, `old_status`, `new_status`, `changed_by_user_id`, `changed_at`, `notes`).
  8. `notifications`: In-app notification queue (`id`, `user_id`, `donation_id`, `type`, `title`, `message`, `channel`, `is_read`, `delivery_status`, `created_at`, `sent_at`).
  9. `ngo_staff`: NGO operational workers (`id`, `ngo_id`, `name`, `phone`, `email`, `role`, `is_active`, `created_at`, `updated_at`). Constraint: `role IN ('packaging', 'pickup', 'delivery')`, unique `(ngo_id, email)`.
  10. `operation_assignments`: Scheduled tasks assigned to staff (`id`, `donation_id`, `ngo_id`, `staff_id`, `task_type`, `scheduled_at`, `status`, `notes`, `created_at`, `updated_at`). Constraints: `task_type IN ('packaging', 'pickup', 'delivery')`, `status IN ('scheduled', 'in_progress', 'completed', 'cancelled')`. Unique partial index: only one active (`scheduled` or `in_progress`) operation per `(donation_id, task_type)`.
  11. `donation_matches`: Recommended and accepted matches (`id`, `submission_id`, `ngo_id`, `score`, `item_match_score`, `quantity_score`, `distance_score`, `priority_score`, `semantic_score`, `status`, `rejection_reason`, `created_at`, `updated_at`). Unique constraint `(submission_id, ngo_id)`.
- **Migrations**: No Alembic runner is present. Migrations are executed as plain SQL files in `donation_backend_final/migrations/`:
  - `001_milestone6_notifications.sql`: Creates `notifications` table and indexes.
  - `002_milestone6_staff_operations.sql`: Creates `ngo_staff` and `operation_assignments` tables.
  - `003_active_operation_guard.sql`: Cancels duplicate active operations and creates unique partial index `uq_active_operation_per_donation_task`.
  - `004_subcategory_support.sql`: Adds `subcategory` column to `item_submission_lines` and `demand_records`.

### NOT VERIFIED:
- Migration status of the currently running PostgreSQL database instance (requires read-only live inspection of database catalog).

---

## 6. Authentication and Authorization

### VERIFIED:
- **Authentication Mechanism**: OAuth2 password-bearer scheme with PyJWT (`donation_backend_final/security.py`).
- **Token Generation**: Generated on `POST /api/auth/login` with claims:
  - `sub`: `str(user.id)`
  - `role`: `user.role`
  - `exp`: current UTC time + `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60 minutes).
- **Password Hashing**: PBKDF2-HMAC-SHA256 with 310,000 iterations and a 16-byte random salt. Format: `pbkdf2_sha256$310000$<salt_hex>$<digest_hex>`.
- **Registration**:
  - `POST /api/auth/register` creates a user and auto-creates the linked profile:
    - If `role == "donor"`, creates a `Donor` record (requiring `name`, `phone`, `city`) and links `user.donor_id`.
    - If `role == "ngo"`, creates an `NGO` record (requiring `organization_name`, `contact_phone`, `address`, `city`) and links `user.ngo_id`. NGO `verified` flag is set to `False` by default.
    - If `role == "admin"`, registration via public API is blocked with HTTP 403 ("Admin registration is not allowed through this endpoint").
- **Authorization Enforcement**:
  - `get_current_user`: Decodes JWT, validates expiration, checks user existence and `is_active`.
  - `require_roles(*roles)`: Verifies caller has matching role.
  - `require_owner(user, ngo_id, donor_id)`: Verifies resource ownership; automatically bypasses checks if caller is `admin`.
  - `require_ngo_or_admin`: Restricts NGO operations to tenant owner or admin.
  - `require_match_action_permission`: Restricts match accept/reject to assigned NGO or admin.
- **Frontend Storage**: JWT token stored in `localStorage.getItem("kindred_token")`; serialized user stored in `localStorage.getItem("kindred_user")`.

### NOT VERIFIED:
- Refresh token mechanism or token revocation blacklist (tokens remain valid until expiration unless `user.is_active` is set to `False`).

---

## 7. User Roles

### VERIFIED:
Three distinct user roles exist in the database and API:

1. **`donor`**:
   - Linked to a single `Donor` record (`user.donor_id`).
   - Permissions: Scans items, creates donations (`POST /api/donations`), updates submitted donations (`PUT /api/donations/{id}`), cancels donations, views own donations and match recommendations, triggers match computation, schedules/reschedules pickups, manages donor profile (`GET/PUT /api/donors/me`).
   - Restrictions: Cannot change status to operational stages (`packaging_notified`, `collected`, `delivered`, `acknowledged`), cannot accept/reject matches on behalf of an NGO.
2. **`ngo`**:
   - Linked to an `NGO` record (`user.ngo_id`).
   - Permissions: Creates, updates, and deletes demands (`/api/ngos/{ngo_id}/demands`); reviews incoming matches; accepts or rejects matches; triggers packaging notification (`POST /donations/{id}/packaging-notify`); schedules/reschedules pickups; updates operational statuses (`collected`, `delivered`, `acknowledged`); creates and assigns staff members to operational tasks.
   - Restrictions: Unverified NGOs are excluded from matching engine queries; cannot modify donor profiles or another NGO's staff/operations.
3. **`admin`**:
   - Has no linked `donor_id` or `ngo_id`.
   - Permissions: Full administrative access to `GET /api/admin/dashboard`, `GET /api/admin/donors`, `PATCH /api/ngos/{ngo_id}/verification`, `POST /api/ngos`, `DELETE /api/ngos/{ngo_id}`; bypasses `require_owner` on donations, matches, and operations.
- **Staff Distinction**:
  - Operational staff (`packaging`, `pickup`, `delivery`) are tracked in `ngo_staff` for assignment in `operation_assignments`.
  - Staff members do not have individual login credentials or accounts in the `users` table.

### NOT VERIFIED:
- Granular permission hierarchies (e.g. sub-admin, read-only auditor, or direct staff portal login).

---

## 8. Donation Workflow

### VERIFIED:
- **Donation Lifecycle State Machine** (defined in `status_service.py`):
  ```
  submitted -> matched -> packaging_notified -> pickup_scheduled -> collected -> delivered -> acknowledged
      |           |              |                   |
      +-----------+--------------+-------------------+------> cancelled
  ```
- **Terminal States**: `acknowledged` and `cancelled` (no further transitions permitted).
- **Creation**:
  - Donor submits items via `POST /api/donations`.
  - Backend creates `ItemSubmission` (status: `submitted`), creates `ItemSubmissionLine` entries, and records `StatusHistory` ("Donation created").
- **Update**:
  - Donor updates submitted items via `PUT /api/donations/{donation_id}`.
  - Allowed ONLY when status is `submitted`. Clears existing lines and re-inserts updated items.
- **Cancellation**:
  - Donor, assigned NGO, or Admin can cancel via `POST /api/donations/{donation_id}/cancel` or `PATCH /api/donations/{donation_id}/status` with `status: "cancelled"`.
- **Operational Status Updates**:
  - Performed via `PATCH /api/donations/{donation_id}/status` with `notes`.
  - Allowed transitions strictly validated by `validate_transition` and `validate_status_action`:
    - `donor` may only cancel.
    - `ngo` can transition to `packaging_notified`, `collected`, `delivered`, `acknowledged`, or `cancelled`.
    - `admin` can perform any valid transition.
  - Every transition writes an entry to `status_history`.
- **Packaging Checklist**:
  - Category-aware checklist retrieved via `GET /api/donations/{donation_id}/packaging-checklist`.
  - NGO triggers packaging notification via `POST /api/donations/{donation_id}/packaging-notify` (transitions status to `packaging_notified`).
- **Pickup Scheduling**:
  - Scheduled via `POST /api/donations/{donation_id}/pickup/schedule` with ISO-8601 UTC timestamp.
  - Validation requires `donation.status == "packaging_notified"`, timestamp must include timezone, and timestamp must be strictly in the future.
  - Status automatically transitions from `packaging_notified` to `pickup_scheduled`.
  - Rescheduling available via `PUT /api/donations/{donation_id}/pickup`.

### NOT VERIFIED:
- Hard deletion of donation records (no endpoint exists to delete an `ItemSubmission`; records are retained permanently for auditing).

---

## 9. AI/YOLO Workflow

### VERIFIED:
- **Detection Endpoint**: `POST /detect` in `donation_backend_final/main.py`.
- **Input Validation**:
  - Rejects missing content-type or non-image content (HTTP 400).
  - Allowed file extensions: `.png`, `.jpg`, `.jpeg`, `.bmp`, `.webp`.
  - Maximum upload size: `MAX_UPLOAD_BYTES` (default 10 MB / 10,485,760 bytes). Rejects oversized files with HTTP 413.
- **Inference Execution**:
  - Converts image bytes to RGB via PIL.
  - Runs `model.predict(source=image, conf=0.25, iou=0.45, verbose=False)`.
- **Aggregation & Quantity Estimation**:
  - Detections are grouped by class/category.
  - Quantity is estimated as the count of bounding boxes detected for that class.
  - Average confidence is calculated across all boxes of that class.
  - If average confidence is below `0.50` or the detected class is unknown, `needs_review=True` is flagged.
- **Active Model Configuration**:
  - Controlled by environment variables in `config.py`:
    - `USE_CUSTOM_MODEL` (default: `True`)
    - `CUSTOM_MODEL_PATH` (configured in `.env` as `best_81class.pt`)
  - When `USE_CUSTOM_MODEL=True`: Loads fine-tuned YOLO model via `ultralytics.YOLO`. Maps detected class names through `taxonomy.py`.
  - When `USE_CUSTOM_MODEL=False`: Loads `ultralytics.YOLOWorld("yolov8s-world.pt")` and applies 21 zero-shot text classes (`DETECTION_CLASSES`) and `CATEGORY_MAP`.
- **Standalone Pipeline**:
  - `inference_pipeline.py` implements `ItemDetector` with `conf=0.35, iou=0.45, min_quantity_conf=0.50` for reusable or batch inference.

### NOT VERIFIED:
- Live GPU acceleration / CUDA runtime on host (runs on CPU unless CUDA device is initialized by PyTorch).

---

## 10. Category and Subcategory Mapping

### VERIFIED:
- **Six Canonical Parent Categories** (enforced by DB check constraint in `schema.sql` and `db.py`):
  `clothing`, `food`, `books`, `electronics`, `furniture`, `utensils`.
- **81-Class Custom Model Integration**:
  - In `donation_backend_final/taxonomy.py`, `MODEL_CLASS_TO_TAXONOMY` maps exactly 81 fine-grained classes into the 6 parent categories and subcategories:
    - **Books (1)**: `book`.
    - **Clothing (10)**: `sunglass`, `hat`, `jacket`, `shirt`, `pants`, `shorts`, `skirt`, `dress`, `bag`, `shoe`.
    - **Food (10)**: `apple`, `banana`, `carrot`, `cucumber`, `lemon`, `onion`, `orange`, `pepper`, `potato`, `tomato`.
    - **Electronics (3)**: `air conditioner`, `computer`, `monitor`.
    - **Furniture (16)**: `bed`, `cabinet`, `carpet`, `ceiling fan`, `chair`, `closet`, `cupboard`, `dining table`, `drawer`, `frame`, `lamp`, `shelf`, `sofa`, `stool`, `table`, `wardrobe`.
    - **Footwear (6)** (mapped under parent category `clothing`): `Boots`, `Heels`, `Sandals`, `Shoes`, `Slipers`, `Sneakers`.
    - **Utensils (35)**: `can-opener`, `chopping-board`, `circular-food-container`, `cooking-pot`, `cooking-strainer`, `dish-cover`, `drinking-glass`, `eggbeater`, `electric-kettle`, `food-bowl`, `food-jar`, `food-picker`, `food-tray`, `frying-pan`, `grater`, `kettle`, `kitchen-knife`, `kitchen-turner`, `ladle`, `metal-fork`, `metal-spoon`, `mini plate`, `mug`, `pitcher`, `plastic-fork`, `plastic-spoon`, `plate`, `potholder`, `rectangular-food-container`, `scissor`, `serving-plate`, `shot-glass`, `tea-cup`, `two-tooth-fork`, `wine-glass`.
- **Normalization Functions** (`taxonomy.py`):
  - `normalize_model_class(class_name)`: Returns `{category, subcategory}` or `None`.
  - `normalize_item(category, subcategory)`: Validates donor/NGO item input pair.
  - `taxonomy_for_class(class_name)`: Fallback-safe taxonomy resolution for AI detections.
  - `subcategories_compatible(donation_subcategory, demand_subcategory)`: Demand subcategory `None` matches any donation subcategory in that category; non-null demand subcategory requires exact match.

### NOT VERIFIED:
- Dynamic database-driven category additions (categories are hardcoded in schema constraints and backend taxonomy).

---

## 11. NGO Demand Workflow

### VERIFIED:
- **Demand Endpoints**:
  - `POST /api/ngos/{ngo_id}/demands`: Creates demand with `class_name` (parent category), optional `subcategory`, `quantity_needed` (>=1), `priority` (1 to 5), and optional `expiry_date`.
  - `GET /api/ngos/{ngo_id}/demands`: Lists demands for an NGO with active/category/priority filtering.
  - `GET /api/demands/{demand_id}`: Retrieves single demand record.
  - `PUT /api/demands/{demand_id}`: Updates existing demand.
  - `DELETE /api/demands/{demand_id}`: Hard-deletes demand record (HTTP 204).
- **Validation**:
  - Validated by `DemandCreate` schema in `schemas.py`: normalizes category and subcategory via `normalize_item`.
  - Expiry date: Demands with `expiry_date < date.today()` are filtered out during matching.
- **Permissions**:
  - Only the authenticated NGO owner (`user.ngo_id == ngo_id`) or an `admin` can create, modify, or delete demands.

### NOT VERIFIED:
- Automated recurring demand renewal (demands expire once the date passes unless updated).

---

## 12. Matching Workflow

### VERIFIED:
- **Trigger**: `POST /api/donations/{donation_id}/match`. Can be invoked by the donor owner or an admin.
- **Eligibility**: Donation must be in `submitted` status.
- **Filtering Logic**:
  - Joins `demand_records` and `ngos`.
  - Requires `NGO.verified == True`.
  - Requires `DemandRecord.quantity_needed > 0`.
  - Requires `DemandRecord.expiry_date >= date.today()` or `expiry_date IS NULL`.
  - Requires `DemandRecord.class_name == donation_line.category`.
  - Requires `subcategories_compatible(donation_line.subcategory, demand.subcategory)`.
- **Scoring Formula** (`donation_backend_final/api_v2.py`):
  $$\text{Score} = 0.40 + (0.25 \times \text{quantity\_score}) + (0.20 \times \text{distance\_score}) + (0.15 \times \text{priority\_score})$$
  - Item base match: `0.40` (with `item_match_score = 1.0`).
  - `quantity_score`: $\min(\frac{\text{donation quantity}}{\text{quantity needed}}, 1.0)$.
  - `distance_score`: $\frac{1}{1 + \frac{\text{haversine distance (km)}}{10}}$ if both donor and NGO coordinates are present; defaults to `0.50` if coordinates are unavailable.
  - `priority_score`: $\frac{\text{demand priority}}{5.0}$.
- **Match Acceptance**:
  - `POST /api/matches/{match_id}/accept` can ONLY be called by the matched NGO or Admin (`require_match_action_permission`).
  - Sets accepted match `status = "accepted"`.
  - Rejects competing candidate/recommended matches for the same donation.
  - Assigns donation `ngo_id = match.ngo_id`.
  - Transitions donation status to `matched` and writes to `status_history`.
  - Triggers `notify_donation_users(..., "MATCH_ACCEPTED")`.
- **Match Rejection**:
  - `POST /api/matches/{match_id}/reject` by NGO or Admin with optional reason. Sets match `status = "rejected"`.

### NOT VERIFIED:
- Semantic CLIP embedding similarity scoring during matching (in code, `semantic_score` is explicitly hardcoded to `None`, with explanation noting rule-based matching).

---

## 13. Notification Workflow

### VERIFIED:
- **Notification Engine**: Implemented in `donation_backend_final/notification_service.py`.
- **Channels**:
  1. **In-App**: Persisted in `notifications` table for target `user_id`. Queryable via `GET /api/notifications` (supports `unread_only=true` filter) and marked read via `PATCH /api/notifications/{id}/read` or `PATCH /api/notifications/read-all`.
  2. **Email (SMTP)**: Dispatched via standard library `smtplib` using `EMAIL_HOST`, `EMAIL_PORT` (587), `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM`.
  3. **SMS**: Dispatched via Twilio REST API (`https://api.twilio.com/2010-04-01/Accounts/...`) using `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_NUMBER`.
  4. **WhatsApp**: Dispatched via Twilio WhatsApp API using `TWILIO_WHATSAPP_NUMBER` and `TWILIO_WHATSAPP_CONTENT_SID`.
- **Supported Event Types**:
  `MATCH_ACCEPTED`, `MATCH_REJECTED`, `PACKAGING_REQUIRED`, `PICKUP_SCHEDULED`, `PICKUP_REMINDER`, `DONATION_COLLECTED`, `DONATION_DELIVERED`, `DONATION_ACKNOWLEDGED`, `PACKAGING_SCHEDULED`, `PACKAGING_COMPLETED`, `DELIVERY_SCHEDULED`, `PICKUP_COMPLETED`, `DELIVERY_COMPLETED`.
- **Fault Tolerance**:
  - External SMTP and Twilio delivery errors are caught and logged without raising exceptions.
  - A failure on external delivery does not abort or roll back database transactions.
  - Notification audit rows in DB record `delivery_status="delivered"` or `delivery_status="failed"`.

### NOT VERIFIED:
- Delivery guarantees or webhook receipt confirmations from Twilio/SMTP (outbound calls are fire-and-forget).

---

## 14. Admin Workflow

### VERIFIED:
- **Admin Dashboard**: `GET /api/admin/dashboard` provides:
  - Platform summary: `total_ngos`, `total_donors`, `total_donations`, `total_demands`, `total_matches`.
  - Historical 6-month growth series for NGOs, donors, and donations.
  - Verification statistics for NGOs and Donors.
  - Recent 5 NGOs, Donors, and Donations.
  - Attention metrics: `unverified_ngos`, `open_demands`, `pending_matches`.
- **NGO Verification**: `PATCH /api/ngos/{ngo_id}/verification` sets `NGO.verified = True/False`. Unverified NGOs are excluded from matching.
- **Donor Registry**: `GET /api/admin/donors` with pagination (`limit`, `offset`).
- **Discrepancies & Broken Admin Calls Identified in Frontend**:
  - `AdminDonationsPage.jsx` calls `api.getAdminDonationDetail(donationId)` which requests `/api/admin/donations/{id}`. This endpoint DOES NOT EXIST in the backend. (The backend endpoint is `GET /api/donations/{donation_id}`, which admin can access).
  - `AdminDonorsPage.jsx` calls `api.setDonorVerification(donor.id, !donor.verified)` which requests `PATCH /api/admin/donors/{id}/verification`. This endpoint DOES NOT EXIST in the backend, and the `donors` table has no `verified` column.

### NOT VERIFIED:
- Admin password reset or user impersonation capabilities.

---

## 15. Language and Accessibility

### VERIFIED:
- **Localization (i18n)**:
  - Implemented using `i18next` and `react-i18next` (`frontend/src/i18n/index.js`).
  - Supported languages:
    - English (`en`): `locales/en/translation.json` (~39.6 KB)
    - Hindi (`hi`): `locales/hi/translation.json` (~65.7 KB)
    - Bengali (`bn`): `locales/bn/translation.json` (~65.7 KB)
  - Persisted in `localStorage` under `kindred_language`.
  - Dynamically updates `<html lang="...">` tag on language change.
  - UI language switcher component: `frontend/src/components/common/LanguageSelector.jsx`.
- **Accessibility (a11y)**:
  - Semantic ARIA attributes used across components:
    - Modals & Dialogs: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `role="presentation"` backdrop (`CameraCapture.jsx`).
    - Error panels: `role="alert"` (`ErrorMessage.jsx`, `CameraCapture.jsx`).
    - Loaders: `role="status"`, `aria-busy="true"`, `aria-label` (`LoadingState.jsx`).
    - Dropdowns: `role="listbox"`, `role="option"`, `aria-expanded`, `aria-haspopup`, `aria-selected` (`LanguageSelector.jsx`).
    - Live regions: `aria-live="polite"` (`PWAStatus.jsx`).
    - Decorative elements: `aria-hidden="true"` (`Skeleton.jsx`, `KindredLogo.jsx`, icons).
    - Form buttons & icons: `aria-label` tags for screen readers.

### NOT VERIFIED:
- Automated WCAG 2.1 AA audit scores (e.g. axe-core or Lighthouse report scores).

---

## 16. Existing Tests

### VERIFIED:
- **Backend Tests**:
  - Located in `donation_backend_final/tests/`:
    - `conftest.py`: Injects project root into `sys.path`.
    - `test_subcategory_integration.py`: Contains 5 test functions:
      1. `test_all_verified_model_classes_have_expected_taxonomy`: **CRITICAL DRIFT**: Asserts `len(MODEL_CLASS_TO_TAXONOMY) == 21`, but `taxonomy.py` has been updated to 81 classes!
      2. `test_unknown_class_is_safe_and_requires_review`
      3. `test_aggregation_keeps_subcategories_separate_and_counts_same_class`
      4. `test_request_validation_accepts_category_only_and_valid_pair`
      5. `test_matching_subcategory_rules`
- **Frontend Tests**:
  - NO frontend test files exist (`src` has zero `.test.jsx`, `.test.js`, `.spec.jsx`, or `.spec.js` files).
  - NO test script configured in `frontend/package.json` (scripts: `dev`, `build`, `lint`, `preview`).
  - NO testing framework installed in `frontend` (no Vitest, Jest, Cypress, or Playwright).

### NOT VERIFIED:
- Coverage metrics or test pass/fail status in CI (no test runs executed during this read-only audit).

---

## 17. Application Startup Requirements

### VERIFIED:
- **Prerequisites**:
  - Python 3.13.x installed.
  - Node.js v24.x and npm v11.x installed.
  - PostgreSQL 18 service running on `localhost:5432`.
- **Database Setup**:
  1. Create database: `CREATE DATABASE donation_platform;`
  2. Enable extension: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
  3. Execute DDL: `psql -U postgres -d donation_platform -f donation_backend_final/schema.sql`
  4. Apply migrations: Execute scripts in `donation_backend_final/migrations/` (001, 002, 003, 004).
- **Backend Startup**:
  - Working directory MUST be `donation_backend_final/` (to ensure `best_81class.pt` and `.env` resolve correctly).
  - Command: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload` (or `python main.py`).
  - API base URL: `http://localhost:8000`. OpenAPI interactive docs at `http://localhost:8000/docs`.
- **Frontend Startup**:
  - Working directory MUST be `frontend/`.
  - Install dependencies: `npm install` (already populated in `node_modules`).
  - Command: `npm run dev`.
  - UI base URL: `http://localhost:5173`.

### NOT VERIFIED:
- Docker containerization startup (no Dockerfile or docker-compose.yml present).

---

## 18. External Dependencies

### VERIFIED:
- **Python Backend Packages** (`donation_backend_final/requirements.txt`):
  - `fastapi>=0.115,<1.0`, `uvicorn[standard]>=0.30,<1.0`, `python-multipart>=0.0.9,<1.0`
  - `ultralytics>=8.3,<9.0` (YOLOv8 & YOLO-World)
  - `opencv-python-headless>=4.9,<5.0`, `pillow>=10.0,<11.0`, `numpy>=1.26,<3.0`
  - `pydantic>=2.9,<3.0`, `email-validator>=2.1,<3.0`
  - `SQLAlchemy>=2.0,<3.0`, `psycopg2-binary>=2.9,<3.0`
  - `python-dotenv>=1.0,<2.0`, `PyJWT>=2.8,<3.0`, `ImageHash>=4.3,<5.0`
- **Frontend Dependencies** (`frontend/package.json`):
  - `react@^19.2.8`, `react-dom@^19.2.8`, `react-router-dom@^7.18.3`
  - `i18next@^26.4.2`, `react-i18next@^17.0.15`
  - `vite@^8.3.0`, `@vitejs/plugin-react@^6.1.1`, `oxlint@^1.81.0`
- **External Services Configured**:
  - SMTP Email Service (`smtp.gmail.com:587`)
  - Twilio Cloud API (`api.twilio.com`) for SMS and WhatsApp
  - PostgreSQL 18 Database Engine

### NOT VERIFIED:
- Availability of live Twilio account balance or active SMTP mail relay during testing.

---

## 19. Potential E2E Testing Risks

### VERIFIED:
1. **Directory Disambiguation Risk**:
   - There are two `main.py` files: root `main.py` (legacy Milestone 1 with no `/api` routes) and `donation_backend_final/main.py`.
   - Running tests against root `main.py` will cause all `/api` endpoints to return HTTP 404.
2. **Model Path Working Directory Sensitivity**:
   - `best_81class.pt` exists inside `donation_backend_final/`.
   - In `donation_backend_final/main.py`, relative resolution falls back to repo root if path resolution fails. Starting the backend from outside `donation_backend_final/` will cause startup failure with `RuntimeError: USE_CUSTOM_MODEL=true but CUSTOM_MODEL_PATH is not a regular file`.
3. **Unit Test Bit-Rot**:
   - `test_subcategory_integration.py` expects 21 classes; `taxonomy.py` has 81 classes. Running existing tests without modification will fail on `assert len(MODEL_CLASS_TO_TAXONOMY) == 21`.
4. **Missing Backend Endpoints Called by Frontend**:
   - `AdminDonationsPage.jsx` calls `api.getAdminDonationDetail(donationId)` (`/api/admin/donations/{id}`), which returns HTTP 404.
   - `AdminDonorsPage.jsx` calls `api.setDonorVerification(donorId)` (`/api/admin/donors/{id}/verification`), which returns HTTP 404.
   - `NGOStaffPage.jsx` calls `api.permanentlyDeleteNgoStaff(staffId)` (`/api/ngos/me/staff/{id}/permanent`), which returns HTTP 404.
5. **Schema vs ORM Field Disparity on Donation Update**:
   - `ItemSubmissionLine` in `db.py` defines `category = Column(String(50), nullable=False)`.
   - `update_donation` in `api_v2.py` creates `ItemSubmissionLine` without specifying `category`. If the column is strictly enforced in PostgreSQL, `PUT /api/donations/{id}` will trigger a database IntegrityError.
6. **Strict Donation State Machine**:
   - Pickup scheduling requires the donation to be strictly in `packaging_notified` status.
   - Packaging notification requires the donation to be strictly in `matched` status.
   - Any test attempting to skip states will receive HTTP 409 Conflict.
7. **Future Pickup Timestamp Constraint**:
   - `PickupScheduleRequest` enforces that `scheduled_at` must have a timezone offset and must be in the future. Static or naive ISO strings will fail validation with HTTP 422.
8. **Browser Camera / WebRTC Permissions in Headless E2E**:
   - `DonorScanPage` and `CameraCapture.jsx` invoke `navigator.mediaDevices.getUserMedia`. In headless E2E browsers (Playwright/Puppeteer), camera capture will fail unless fake media stream arguments or direct file upload inputs are used.
9. **Live Third-Party API Dependence**:
   - In automated E2E tests, network calls to Twilio or SMTP can cause test latency or timeouts. Tests should verify in-app notification records in the database rather than relying on real SMS/email transmission.

### NOT VERIFIED:
- Performance limits of YOLOv8 inference under concurrent multi-user load.

---

## 20. Recommended E2E Test Scenarios

### VERIFIED:
Based strictly on the verified application capabilities and user journeys in the codebase, the following 10 real end-to-end test scenarios are recommended:

1. **User Authentication & Role-Based Access Control**:
   - Register a new Donor profile via `/register` -> confirm redirect to `/donor`.
   - Register a new NGO profile via `/register` -> confirm redirect to `/ngo` (unverified state).
   - Verify that Donors are blocked from accessing `/ngo/*` and `/admin/*`.
   - Verify that NGOs are blocked from accessing `/donor/*` and `/admin/*`.
   - Verify login with invalid credentials returns proper error messages.
2. **AI Image Detection to Donation Cart Creation**:
   - Upload sample test image (e.g., shirt, book, or utensil) to `/donor/scan`.
   - Verify bounding box detection and class aggregation via `POST /detect`.
   - Navigate to `/donor/review` -> adjust quantities and subcategories.
   - Submit donation via `POST /api/donations` -> verify redirection to `/donor/donations/:id` with status `submitted`.
3. **NGO Resource Demand Management**:
   - Log in as verified NGO -> navigate to `/ngo/demands`.
   - Create a resource demand (Category: `clothing`, Subcategory: `shirt`, Quantity: 10, Priority: 4, future expiry date).
   - Update demand quantity and verify update in list.
   - Delete demand and confirm HTTP 204 removal.
4. **Intelligent Matching & Scoring Engine**:
   - With an active NGO demand in place, submit a matching donor donation.
   - Trigger match computation (`POST /api/donations/{id}/match`).
   - Verify generated `DonationMatch` has score computed from item match, quantity ratio, distance, and priority.
   - Verify subcategory compatibility (demand for `shirt` matches donation of `shirt`; demand for category-only `clothing` matches donation of `shirt`).
5. **Match Acceptance & Mutual Exclusion**:
   - Log in as the matched NGO -> view match under `/ngo/matches`.
   - Accept the match (`POST /api/matches/{id}/accept`).
   - Verify donation status updates to `matched`.
   - Verify competing matches from other NGOs are marked `rejected`.
6. **Packaging Notification & Checklist Generation**:
   - From `/ngo/donations/:id`, NGO triggers packaging notification (`POST /api/donations/{id}/packaging-notify`).
   - Verify donation status transitions to `packaging_notified`.
   - Verify donor receives category-specific packaging checklist (`GET /api/donations/{id}/packaging-checklist`).
7. **Future Pickup Scheduling & Status Progression**:
   - Schedule pickup with future UTC datetime (`POST /api/donations/{id}/pickup/schedule`).
   - Verify donation status transitions to `pickup_scheduled`.
   - Test rescheduling pickup (`PUT /api/donations/{id}/pickup`).
   - Progress status: NGO updates to `collected`, then `delivered`, then `acknowledged`.
   - Confirm donation reaches terminal state `acknowledged`.
8. **NGO Staff Operations & Task Assignments**:
   - NGO creates staff member under `/ngo/staff` (Role: `pickup`, active: true).
   - Assign staff member to a scheduled pickup operation on an active donation.
   - Confirm unique active operation constraint (cannot create second active pickup operation for same donation).
   - Update operation status from `scheduled` to `in_progress` to `completed`.
9. **In-App Notification Dispatch & Read Management**:
   - Verify notification generated in `/api/notifications` upon match acceptance and pickup scheduling.
   - Verify notification count badge in `NotificationBell.jsx`.
   - Mark single notification as read (`PATCH /api/notifications/{id}/read`).
   - Mark all notifications as read (`PATCH /api/notifications/read-all`).
10. **Localization & Accessibility Compliance**:
    - Toggle language between English, Hindi, and Bengali via `LanguageSelector.jsx`.
    - Verify UI text updates according to translation dictionary and `<html lang="...">` updates.
    - Audit ARIA dialog attributes on `CameraCapture` and alert roles on `ErrorMessage`.

### NOT VERIFIED:
- End-to-end scenarios for unverified NGO match acceptance (prevented by design since unverified NGOs are excluded from matching).
