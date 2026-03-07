-- TrainingRecord: training and qualifications for staff (Quality Dept and others). Per ICAO / Auric Air Manual.
CREATE TABLE IF NOT EXISTS "TrainingRecord" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "code"         TEXT,
  "description"  TEXT,
  "recordType"   TEXT NOT NULL DEFAULT 'TRAINING',
  "completedAt"  TIMESTAMPTZ,
  "expiryDate"   TIMESTAMPTZ,
  "documentUrl"  TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "TrainingRecord_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TrainingRecord_userId_idx" ON "TrainingRecord"("userId");
CREATE INDEX IF NOT EXISTS "TrainingRecord_expiryDate_idx" ON "TrainingRecord"("expiryDate");
CREATE INDEX IF NOT EXISTS "TrainingRecord_recordType_idx" ON "TrainingRecord"("recordType");

COMMENT ON TABLE "TrainingRecord" IS 'Training and qualifications; expiry drives TRAINING_EXPIRY notifications.';
