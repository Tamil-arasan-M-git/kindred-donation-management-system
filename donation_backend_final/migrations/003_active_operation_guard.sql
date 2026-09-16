-- Milestone 6 hotfix: one active operation per donation and task type.
-- Preserve existing records by cancelling only duplicate active records;
-- no operation rows are deleted.

WITH ranked_active_operations AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY donation_id, task_type
            ORDER BY created_at DESC, id DESC
        ) AS duplicate_rank
    FROM operation_assignments
    WHERE status IN ('scheduled', 'in_progress')
)
UPDATE operation_assignments AS operation
SET
    status = 'cancelled',
    notes = LEFT(
        COALESCE(operation.notes || ' | ', '')
        || 'Cancelled during active-operation uniqueness migration.',
        2000
    ),
    updated_at = now()
FROM ranked_active_operations AS ranked
WHERE operation.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_operation_per_donation_task
    ON operation_assignments (donation_id, task_type)
    WHERE status IN ('scheduled', 'in_progress');
