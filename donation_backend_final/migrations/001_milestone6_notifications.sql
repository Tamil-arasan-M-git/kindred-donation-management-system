-- Milestone 6 additive migration.
-- Apply once to an existing database; this migration does not remove data.

CREATE TABLE IF NOT EXISTS notifications (
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

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_donation
    ON notifications (donation_id);
