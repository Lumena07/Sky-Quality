-- Catalog of personal compliance document types (role applicability + custom types)
CREATE TABLE IF NOT EXISTS "CompliancePersonalDocumentKind" (
  "id"          TEXT PRIMARY KEY,
  "code"        TEXT NOT NULL UNIQUE,
  "label"       TEXT NOT NULL,
  "applicableRoles" JSONB,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "isSystem"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "CompliancePersonalDocumentKind_sortOrder_idx"
  ON "CompliancePersonalDocumentKind" ("sortOrder", "label");

INSERT INTO "CompliancePersonalDocumentKind" ("id", "code", "label", "applicableRoles", "sortOrder", "isSystem", "createdAt")
VALUES
  ('pjdk_medical', 'MEDICAL', 'Medical Certificate', NULL, 10, true, NOW()),
  ('pjdk_licence', 'LICENCE', 'Pilot/Engineer/Cabin Crew Licence', NULL, 20, true, NOW()),
  ('pjdk_elp', 'ELP', 'English Language Proficiency', NULL, 30, true, NOW()),
  ('pjdk_ir', 'IR', 'Instrument Rating', NULL, 40, true, NOW())
ON CONFLICT ("code") DO NOTHING;
