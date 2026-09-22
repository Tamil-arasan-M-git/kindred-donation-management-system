ALTER TABLE item_submission_lines
    ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50);

ALTER TABLE demand_records
    ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50);
