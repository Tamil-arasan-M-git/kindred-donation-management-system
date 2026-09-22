-- schema.sql
--
-- Multi-tenant database for the donation platform.
-- "Multi-tenant" here means: each NGO is a tenant, and every donation-
-- related row (item submissions, demand records) is scoped to a
-- tenant_id (ngo_id) so NGOs only ever see their own data, even though
-- they all share the same database and tables.
--
-- Run with: psql -U your_user -d your_database -f schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- gives us uuid_generate_v4()

-- ---------------------------------------------------------------------
-- TENANTS: one row per NGO. Every other table references this so data
-- stays isolated per NGO.
-- ---------------------------------------------------------------------
CREATE TABLE ngos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    contact_email   VARCHAR(255) NOT NULL UNIQUE,
    contact_phone   VARCHAR(50),
    address         TEXT,
    city            VARCHAR(100),
    latitude        DOUBLE PRECISION,   -- used for geographic proximity matching
    longitude       DOUBLE PRECISION,
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- DONORS: people submitting items. Not tenant-scoped themselves (a donor
-- can donate to multiple NGOs), but every submission they make IS scoped
-- to the NGO it was matched to.
-- ---------------------------------------------------------------------
CREATE TABLE donors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255),
    email           VARCHAR(255) UNIQUE,
    phone           VARCHAR(50),
    city            VARCHAR(100),
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- ITEM SUBMISSIONS: one row per donor's scanned/submitted cart. This is
-- what the camera capture + cart UI writes to via POST /submissions.
-- ---------------------------------------------------------------------
CREATE TABLE item_submissions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id            UUID REFERENCES donors(id) ON DELETE SET NULL,
    ngo_id              UUID REFERENCES ngos(id) ON DELETE SET NULL,  -- tenant scope; set once matched
    status              VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'matched', 'packaging_notified', 'pickup_scheduled', 'collected', 'delivered', 'acknowledged', 'cancelled')),
        -- expected values: submitted, matched, packaging_notified,
        -- pickup_scheduled, collected, delivered, acknowledged
    pickup_scheduled_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each individual detected/edited item within a submission's cart.
-- Kept as its own table (not a JSON blob) so quantities and classes can
-- be queried/matched against NGO demand efficiently.
CREATE TABLE item_submission_lines (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id       UUID NOT NULL REFERENCES item_submissions(id) ON DELETE CASCADE,
    class_name          VARCHAR(50) NOT NULL CHECK (class_name IN ('clothing', 'food', 'books', 'electronics', 'furniture', 'utensils')),   -- one of: clothing, food, books, electronics, furniture, utensils
    subcategory         VARCHAR(50),
    quantity            INTEGER NOT NULL CHECK (quantity >= 1),
    detection_confidence NUMERIC(4,3) CHECK (detection_confidence IS NULL OR (detection_confidence >= 0 AND detection_confidence <= 1)),
    was_edited_by_donor BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---------------------------------------------------------------------
-- DEMAND RECORDS: what each NGO (tenant) currently needs. This is what
-- the matching engine (future week) compares submissions against.
-- ---------------------------------------------------------------------
CREATE TABLE demand_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ngo_id          UUID NOT NULL REFERENCES ngos(id) ON DELETE CASCADE,  -- tenant scope
    class_name      VARCHAR(50) NOT NULL,
    subcategory     VARCHAR(50),
    quantity_needed INTEGER NOT NULL CHECK (quantity_needed >= 1),
    priority        SMALLINT NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
    expiry_date     DATE,                          -- demand no longer valid after this date
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Indexes for the lookups this app will actually run often:
-- "show me all submissions for NGO X", "what does NGO X still need",
-- "find submissions matching this class".
-- ---------------------------------------------------------------------
CREATE INDEX idx_submissions_ngo        ON item_submissions (ngo_id);
CREATE INDEX idx_submissions_status     ON item_submissions (status);
CREATE INDEX idx_submissions_donor      ON item_submissions (donor_id);
CREATE INDEX idx_submission_lines_class ON item_submission_lines (class_name);
CREATE INDEX idx_submission_lines_submission ON item_submission_lines (submission_id);
CREATE INDEX idx_demand_ngo             ON demand_records (ngo_id);
CREATE INDEX idx_demand_class           ON demand_records (class_name);
CREATE INDEX idx_demand_expiry          ON demand_records (expiry_date);
CREATE INDEX idx_ngos_verified          ON ngos (verified);
CREATE INDEX idx_ngos_city              ON ngos (city);

-- Milestone 2 account, audit, and matching tables. These statements are
-- additive so existing Milestone 1 data remains intact.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('donor', 'ngo', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ngo_id UUID REFERENCES ngos(id) ON DELETE SET NULL,
    donor_id UUID REFERENCES donors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email            ON users (email);
CREATE INDEX idx_users_role             ON users (role);
CREATE INDEX idx_users_donor_id         ON users (donor_id);
CREATE INDEX idx_users_ngo_id           ON users (ngo_id);

CREATE TABLE status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES item_submissions(id) ON DELETE CASCADE,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL CHECK (new_status IN ('submitted', 'matched', 'packaging_notified', 'pickup_scheduled', 'collected', 'delivered', 'acknowledged', 'cancelled')),
    changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes VARCHAR(1000)
);

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    donation_id     UUID REFERENCES item_submissions(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    message         VARCHAR(2000) NOT NULL,
    channel         VARCHAR(20) NOT NULL DEFAULT 'in_app',
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ
);

CREATE TABLE ngo_staff (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ngo_id      UUID NOT NULL REFERENCES ngos(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    phone       VARCHAR(50) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('packaging', 'pickup', 'delivery')),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ngo_id, email)
);

CREATE TABLE operation_assignments (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id  UUID NOT NULL REFERENCES item_submissions(id) ON DELETE CASCADE,
    ngo_id       UUID NOT NULL REFERENCES ngos(id) ON DELETE CASCADE,
    staff_id     UUID NOT NULL REFERENCES ngo_staff(id) ON DELETE RESTRICT,
    task_type    VARCHAR(20) NOT NULL CHECK (task_type IN ('packaging', 'pickup', 'delivery')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    notes        VARCHAR(2000),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE donation_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES item_submissions(id) ON DELETE CASCADE,
    ngo_id UUID NOT NULL REFERENCES ngos(id) ON DELETE CASCADE,
    score NUMERIC(5,4) NOT NULL,
    item_match_score NUMERIC(5,4) NOT NULL,
    quantity_score NUMERIC(5,4) NOT NULL,
    distance_score NUMERIC(5,4) NOT NULL,
    priority_score NUMERIC(5,4) NOT NULL,
    semantic_score NUMERIC(5,4),
    status VARCHAR(20) NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'recommended', 'accepted', 'rejected', 'expired')),
    rejection_reason VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (submission_id, ngo_id)
);

CREATE INDEX idx_status_history_submission ON status_history (submission_id, changed_at);
CREATE INDEX idx_matches_submission ON donation_matches (submission_id, score DESC);
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_donation ON notifications (donation_id);
CREATE INDEX idx_staff_ngo ON ngo_staff (ngo_id, is_active);
CREATE INDEX idx_operations_ngo ON operation_assignments (ngo_id, status, scheduled_at);
CREATE INDEX idx_operations_donation ON operation_assignments (donation_id, created_at);
CREATE INDEX idx_operations_staff ON operation_assignments (staff_id, scheduled_at);
CREATE UNIQUE INDEX uq_active_operation_per_donation_task
    ON operation_assignments (donation_id, task_type)
    WHERE status IN ('scheduled', 'in_progress');
