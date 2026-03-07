-- Audit schedule: opening/closing meeting date-time and notes
ALTER TABLE "Audit"
  ADD COLUMN IF NOT EXISTS "openingMeetingAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "closingMeetingAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "scheduleNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "closingMeetingNotes" TEXT;

COMMENT ON COLUMN "Audit"."openingMeetingAt" IS 'Opening meeting date and time.';
COMMENT ON COLUMN "Audit"."closingMeetingAt" IS 'Closing meeting date and time.';
COMMENT ON COLUMN "Audit"."scheduleNotes" IS 'Process steps / schedule notes from manual.';
COMMENT ON COLUMN "Audit"."closingMeetingNotes" IS 'Closing meeting discussion summary.';

-- Meeting attendance and sign-off (opening and closing)
CREATE TABLE IF NOT EXISTS "AuditMeetingAttendance" (
  "id"         TEXT PRIMARY KEY,
  "auditId"    TEXT NOT NULL,
  "meetingType" TEXT NOT NULL CHECK ("meetingType" IN ('OPENING', 'CLOSING')),
  "userId"     TEXT,
  "name"       TEXT,
  "roleOrTitle" TEXT,
  "signedAt"   TIMESTAMPTZ,
  "signatureData" TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "AuditMeetingAttendance_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE,
  CONSTRAINT "AuditMeetingAttendance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "AuditMeetingAttendance_auditId_idx"
  ON "AuditMeetingAttendance"("auditId");
CREATE INDEX IF NOT EXISTS "AuditMeetingAttendance_meetingType_idx"
  ON "AuditMeetingAttendance"("auditId", "meetingType");
CREATE INDEX IF NOT EXISTS "AuditMeetingAttendance_userId_idx"
  ON "AuditMeetingAttendance"("userId");

COMMENT ON TABLE "AuditMeetingAttendance" IS 'Attendance list and sign-off for audit opening and closing meetings.';
