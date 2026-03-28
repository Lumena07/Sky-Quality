-- QMS: settings, TCAA audit reports, document custodian roles, manual copies,
-- regulatory library, SLAs, training compliance, auditor programme / requalification

-- ---------------------------------------------------------------------------
-- QmsSettings (single row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "QmsSettings" (
  "id"                 TEXT PRIMARY KEY DEFAULT 'singleton',
  "operatorLegalName"  TEXT,
  "aocNumber"          TEXT,
  "reportFooterText"   TEXT,
  "updatedAt"          TIMESTAMPTZ,
  "updatedById"        TEXT,
  CONSTRAINT "QmsSettings_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL
);

INSERT INTO "QmsSettings" ("id", "operatorLegalName", "aocNumber", "reportFooterText", "updatedAt", "updatedById")
VALUES ('singleton', NULL, NULL, NULL, NULL, NULL)
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- TCAA / QMS audit report generation log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TcaaAuditReportLog" (
  "id"                  TEXT PRIMARY KEY,
  "reportType"          TEXT NOT NULL,
  "periodLabel"         TEXT NOT NULL,
  "periodStart"         TIMESTAMPTZ NOT NULL,
  "periodEnd"           TIMESTAMPTZ NOT NULL,
  "executiveSummaryText" TEXT,
  "pdfFileUrl"          TEXT,
  "generatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "generatedById"       TEXT NOT NULL,
  CONSTRAINT "TcaaAuditReportLog_generatedById_fkey"
    FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TcaaAuditReportLog_generatedAt_idx"
  ON "TcaaAuditReportLog"("generatedAt" DESC);

-- ---------------------------------------------------------------------------
-- Document: manual custodian roles (JSON array of role codes)
-- ---------------------------------------------------------------------------
ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "manualCustodianRoles" JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN "Document"."manualCustodianRoles" IS 'Role codes (e.g. QUALITY_MANAGER) that may custodian this manual; OR legacy manualHolderIds for user IDs.';

-- ---------------------------------------------------------------------------
-- Document manual copies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "DocumentManualCopy" (
  "id"                 TEXT PRIMARY KEY,
  "documentId"         TEXT NOT NULL,
  "copyNumber"         TEXT NOT NULL,
  "assignedToUserId"   TEXT,
  "notes"              TEXT,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById"        TEXT NOT NULL,
  CONSTRAINT "DocumentManualCopy_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE,
  CONSTRAINT "DocumentManualCopy_assignedToUserId_fkey"
    FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "DocumentManualCopy_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentManualCopy_documentId_copyNumber_key"
  ON "DocumentManualCopy"("documentId", "copyNumber");

CREATE INDEX IF NOT EXISTS "DocumentManualCopy_documentId_idx"
  ON "DocumentManualCopy"("documentId");

-- ---------------------------------------------------------------------------
-- Regulatory library (technical guidance + advisory circulars)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "RegulatoryLibraryDocument" (
  "id"           TEXT PRIMARY KEY,
  "kind"         TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "category"     TEXT,
  "version"      TEXT,
  "acNumber"     TEXT,
  "subject"      TEXT,
  "fileUrl"      TEXT NOT NULL,
  "fileType"     TEXT NOT NULL,
  "fileSize"     INTEGER NOT NULL,
  "uploadedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "uploadedById" TEXT NOT NULL,
  CONSTRAINT "RegulatoryLibraryDocument_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "RegulatoryLibraryDocument_kind_idx"
  ON "RegulatoryLibraryDocument"("kind");
CREATE INDEX IF NOT EXISTS "RegulatoryLibraryDocument_uploadedAt_idx"
  ON "RegulatoryLibraryDocument"("uploadedAt" DESC);

-- ---------------------------------------------------------------------------
-- Service level agreements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ServiceLevelAgreement" (
  "id"            TEXT PRIMARY KEY,
  "companyName"   TEXT NOT NULL,
  "slaType"       TEXT NOT NULL,
  "location"      TEXT,
  "contractDate"  DATE NOT NULL,
  "expiryDate"    DATE NOT NULL,
  "pdfFileUrl"    TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById"   TEXT NOT NULL,
  CONSTRAINT "ServiceLevelAgreement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ServiceLevelAgreement_expiryDate_idx"
  ON "ServiceLevelAgreement"("expiryDate");

CREATE TABLE IF NOT EXISTS "SlaExpiryNotificationSent" (
  "id"             TEXT PRIMARY KEY,
  "slaId"          TEXT NOT NULL,
  "thresholdDays"  INTEGER NOT NULL,
  "sentAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "SlaExpiryNotificationSent_slaId_fkey"
    FOREIGN KEY ("slaId") REFERENCES "ServiceLevelAgreement"("id") ON DELETE CASCADE,
  CONSTRAINT "SlaExpiryNotificationSent_sla_threshold_unique" UNIQUE ("slaId", "thresholdDays")
);

-- ---------------------------------------------------------------------------
-- Training compliance (dept_training_001 + QM)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ComplianceTrainingType" (
  "id"               TEXT PRIMARY KEY,
  "name"             TEXT NOT NULL,
  "intervalMonths"   INTEGER NOT NULL CHECK ("intervalMonths" > 0),
  "mandatoryForAll"  BOOLEAN NOT NULL DEFAULT false,
  "applicableRoles"  JSONB,
  "applicableUserIds" JSONB,
  "isSystemSeeded"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ComplianceTrainingCompletion" (
  "id"               TEXT PRIMARY KEY,
  "trainingTypeId"   TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "lastCompletedAt"  TIMESTAMPTZ,
  "nextDueAt"        TIMESTAMPTZ,
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ComplianceTrainingCompletion_trainingTypeId_fkey"
    FOREIGN KEY ("trainingTypeId") REFERENCES "ComplianceTrainingType"("id") ON DELETE CASCADE,
  CONSTRAINT "ComplianceTrainingCompletion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "ComplianceTrainingCompletion_type_user_unique" UNIQUE ("trainingTypeId", "userId")
);

CREATE INDEX IF NOT EXISTS "ComplianceTrainingCompletion_userId_idx"
  ON "ComplianceTrainingCompletion"("userId");

CREATE TABLE IF NOT EXISTS "UserComplianceDocument" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL,
  "documentKind" TEXT NOT NULL,
  "expiryDate"   DATE,
  "pdfFileUrl"   TEXT,
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedById"  TEXT,
  CONSTRAINT "UserComplianceDocument_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserComplianceDocument_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "UserComplianceDocument_user_kind_unique" UNIQUE ("userId", "documentKind")
);

CREATE INDEX IF NOT EXISTS "UserComplianceDocument_userId_idx"
  ON "UserComplianceDocument"("userId");

-- Seeded mandatory SMS training (24 months, all staff)
INSERT INTO "ComplianceTrainingType" (
  "id", "name", "intervalMonths", "mandatoryForAll", "applicableRoles", "applicableUserIds", "isSystemSeeded", "createdAt"
)
VALUES (
  'compliance_training_sms_seed',
  'SMS (Safety Management System)',
  24,
  true,
  NULL,
  NULL,
  true,
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- QMS personnel: auditor training programme
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AuditorTrainingCourse" (
  "id"          TEXT PRIMARY KEY,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "AuditorTrainingAssignment" (
  "id"          TEXT PRIMARY KEY,
  "courseId"    TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "completedAt" TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById" TEXT NOT NULL,
  CONSTRAINT "AuditorTrainingAssignment_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "AuditorTrainingCourse"("id") ON DELETE CASCADE,
  CONSTRAINT "AuditorTrainingAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "AuditorTrainingAssignment_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "AuditorTrainingAssignment_course_user_unique" UNIQUE ("courseId", "userId")
);

CREATE INDEX IF NOT EXISTS "AuditorTrainingAssignment_userId_idx"
  ON "AuditorTrainingAssignment"("userId");

-- ---------------------------------------------------------------------------
-- User: auditor requalification
-- ---------------------------------------------------------------------------
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "auditorRequalificationCompletedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "auditorRequalificationCourseNotes" TEXT;

COMMENT ON COLUMN "User"."auditorRequalificationCompletedAt" IS 'When auditor requalification course was completed; clears 12-month audit gap flag for 12 months.';
