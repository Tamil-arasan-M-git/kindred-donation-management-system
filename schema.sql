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
    status              VARCHAR(30) NOT NULL DEFAULT 'submitted',
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
    class_name          VARCHAR(50) NOT NULL,   -- one of: clothing, food, books, electronics, furniture, utensils
    quantity            INTEGER NOT NULL CHECK (quantity >= 0),
    detection_confidence NUMERIC(4,3),          -- e.g. 0.812; NULL if manually added by donor
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
    quantity_needed INTEGER NOT NULL CHECK (quantity_needed >= 0),
    priority        SMALLINT NOT NULL DEFAULT 1,  -- e.g. 1=low, 2=medium, 3=high
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
CREATE INDEX idx_submission_lines_class ON item_submission_lines (class_name);
CREATE INDEX idx_demand_ngo             ON demand_records (ngo_id);
CREATE INDEX idx_demand_class           ON demand_records (class_name);
