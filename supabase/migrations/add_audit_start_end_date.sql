-- Add start and end date for audits (multi-day support)
-- scheduledDate remains for backward compatibility; new logic uses startDate/endDate

ALTER TABLE "Audit"
  ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMPTZ;

-- Backfill: existing audits get startDate = endDate = scheduledDate
UPDATE "Audit"
SET "startDate" = "scheduledDate",
    "endDate" = "scheduledDate"
WHERE "startDate" IS NULL;

-- Ensure new rows have defaults from scheduledDate for any legacy inserts
ALTER TABLE "Audit"
  ALTER COLUMN "startDate" SET DEFAULT NOW(),
  ALTER COLUMN "endDate" SET DEFAULT NOW();

-- Optional: make non-null after backfill (uncomment if you want to enforce)
-- ALTER TABLE "Audit" ALTER COLUMN "startDate" SET NOT NULL;
-- ALTER TABLE "Audit" ALTER COLUMN "endDate" SET NOT NULL;
