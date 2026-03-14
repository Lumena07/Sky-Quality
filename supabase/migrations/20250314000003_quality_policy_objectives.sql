-- QualityPolicy: single current quality policy (PDF and/or text). Quality Manager only can edit.
CREATE TABLE IF NOT EXISTS "QualityPolicy" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "policyPdfUrl"   TEXT,
  "policyText"     TEXT,
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedById"    TEXT NOT NULL,

  CONSTRAINT "QualityPolicy_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "QualityPolicy_updatedAt_idx" ON "QualityPolicy"("updatedAt");

COMMENT ON TABLE "QualityPolicy" IS 'Current quality policy; view-only for all, edit by Quality Manager only.';

-- QualityObjectives: one row per year. Quality Manager only can add/edit/delete.
CREATE TABLE IF NOT EXISTS "QualityObjectives" (
  "id"                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "year"                INTEGER NOT NULL UNIQUE,
  "objectivesPdfUrl"    TEXT,
  "objectivesText"      TEXT,
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedById"         TEXT NOT NULL,

  CONSTRAINT "QualityObjectives_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "QualityObjectives_year_idx" ON "QualityObjectives"("year");

COMMENT ON TABLE "QualityObjectives" IS 'Quality objectives per year; view-only for all, add/edit/delete by Quality Manager only.';
