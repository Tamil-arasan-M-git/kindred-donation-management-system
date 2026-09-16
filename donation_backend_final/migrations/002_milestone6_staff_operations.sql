-- Milestone 6 additive migration for NGO staff and operational assignments.
-- Apply once to an existing database; this migration does not remove data.

CREATE TABLE IF NOT EXISTS ngo_staff (
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

CREATE TABLE IF NOT EXISTS operation_assignments (
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

CREATE INDEX IF NOT EXISTS idx_staff_ngo ON ngo_staff (ngo_id, is_active);
CREATE INDEX IF NOT EXISTS idx_operations_ngo ON operation_assignments (ngo_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_operations_donation ON operation_assignments (donation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operations_staff ON operation_assignments (staff_id, scheduled_at);
