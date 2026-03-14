-- Audit timetable: items with day reference and time (e.g. Opening meeting Day 1 09:00)
CREATE TABLE IF NOT EXISTS "AuditScheduleItem" (
  "id"         TEXT PRIMARY KEY,
  "auditId"    TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "dayRef"     TEXT NOT NULL CHECK ("dayRef" IN ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'last')),
  "time"       TEXT NOT NULL,  -- HH:mm
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "AuditScheduleItem_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuditScheduleItem_auditId_idx"
  ON "AuditScheduleItem"("auditId");

COMMENT ON TABLE "AuditScheduleItem" IS 'Audit timetable: item label, day (1..10 or last), time (HH:mm). Used to derive openingMeetingAt/closingMeetingAt.';

-- Backfill from existing openingMeetingAt / closingMeetingAt
-- For each audit with openingMeetingAt: insert item "Opening meeting", dayRef from date vs start/end, time from timestamp
-- For each audit with closingMeetingAt: insert item "Closing meeting", dayRef "last" or computed, time from timestamp
INSERT INTO "AuditScheduleItem" ("id", "auditId", "label", "dayRef", "time", "sortOrder", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  a.id,
  'Opening meeting',
  CASE
    WHEN a."startDate"::date = (a."openingMeetingAt"::timestamptz)::date THEN '1'
    WHEN a."endDate"::date = (a."openingMeetingAt"::timestamptz)::date THEN 'last'
    ELSE '1'
  END,
  to_char(a."openingMeetingAt"::timestamptz AT TIME ZONE 'UTC', 'HH24:MI'),
  0,
  NOW(),
  NOW()
FROM "Audit" a
WHERE a."openingMeetingAt" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "AuditScheduleItem" asi WHERE asi."auditId" = a.id AND asi."label" = 'Opening meeting');

INSERT INTO "AuditScheduleItem" ("id", "auditId", "label", "dayRef", "time", "sortOrder", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  a.id,
  'Closing meeting',
  CASE
    WHEN a."endDate"::date = (a."closingMeetingAt"::timestamptz)::date THEN 'last'
    WHEN a."startDate"::date = (a."closingMeetingAt"::timestamptz)::date THEN '1'
    ELSE 'last'
  END,
  to_char(a."closingMeetingAt"::timestamptz AT TIME ZONE 'UTC', 'HH24:MI'),
  1,
  NOW(),
  NOW()
FROM "Audit" a
WHERE a."closingMeetingAt" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "AuditScheduleItem" asi WHERE asi."auditId" = a.id AND asi."label" = 'Closing meeting');
