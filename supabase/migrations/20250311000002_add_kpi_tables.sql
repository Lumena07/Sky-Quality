-- KpiDefinition: KPI/KPT library (computed defaults + admin-created). Targets editable by System Admin.
CREATE TABLE IF NOT EXISTS "KpiDefinition" (
  "id"              TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  "code"            TEXT UNIQUE,
  "name"            TEXT NOT NULL,
  "area"            TEXT,
  "unit"            TEXT NOT NULL,
  "direction"        TEXT NOT NULL,
  "targetValue"     NUMERIC,
  "isComputed"      BOOLEAN NOT NULL DEFAULT false,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "KpiDefinition_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "KpiDefinition_isActive_idx" ON "KpiDefinition"("isActive");
CREATE INDEX IF NOT EXISTS "KpiDefinition_isComputed_idx" ON "KpiDefinition"("isComputed");

COMMENT ON TABLE "KpiDefinition" IS 'KPI/KPT definitions; computed values from system data or manual monthly entry.';

-- KpiMonthlyValue: manual monthly values for admin-created (non-computed) KPIs.
CREATE TABLE IF NOT EXISTS "KpiMonthlyValue" (
  "id"              TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  "kpiDefinitionId" TEXT NOT NULL,
  "month"           DATE NOT NULL,
  "value"           NUMERIC NOT NULL,
  "note"            TEXT,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "KpiMonthlyValue_kpiDefinitionId_fkey" FOREIGN KEY ("kpiDefinitionId") REFERENCES "KpiDefinition"("id") ON DELETE CASCADE,
  CONSTRAINT "KpiMonthlyValue_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "KpiMonthlyValue_kpi_month_unique" UNIQUE ("kpiDefinitionId", "month")
);

CREATE INDEX IF NOT EXISTS "KpiMonthlyValue_month_idx" ON "KpiMonthlyValue"("month");
CREATE INDEX IF NOT EXISTS "KpiMonthlyValue_kpiDefinitionId_idx" ON "KpiMonthlyValue"("kpiDefinitionId");

-- Seed default aviation compliance KPIs (computed; targets from plan).
INSERT INTO "KpiDefinition" ("id", "code", "name", "area", "unit", "direction", "targetValue", "isComputed", "isActive") VALUES
('kpi_findings_closed_ontime', 'FINDINGS_CLOSED_ONTIME', 'Audit findings – % closed within due date', 'Compliance', 'PERCENT', 'HIGHER_IS_BETTER', 90, true, true),
('kpi_overdue_cap_cat', 'OVERDUE_CAP_CAT', 'Corrective actions – % overdue CAP/CAT', 'Compliance', 'PERCENT', 'LOWER_IS_BETTER', 5, true, true),
('kpi_audit_programme', 'AUDIT_PROGRAMME', 'Audit programme – % planned audits completed', 'Compliance', 'PERCENT', 'HIGHER_IS_BETTER', 100, true, true),
('kpi_repeat_findings', 'REPEAT_FINDINGS', 'Repeat findings – % repeat findings in audits', 'Compliance', 'PERCENT', 'LOWER_IS_BETTER', 10, true, true),
('kpi_regulatory_violations', 'REGULATORY_VIOLATIONS', 'Regulatory compliance – number of regulatory violations', 'Compliance', 'COUNT', 'LOWER_IS_BETTER', 0, true, true),
('kpi_cap_first_submission', 'CAP_FIRST_SUBMISSION', 'Root cause analysis – % CAP accepted on first submission', 'Compliance', 'PERCENT', 'HIGHER_IS_BETTER', 85, true, true),
('kpi_external_major', 'EXTERNAL_MAJOR', 'External audit results – major findings from authority/external', 'Compliance', 'COUNT', 'LOWER_IS_BETTER', 0, true, true),
('kpi_audit_response_days', 'AUDIT_RESPONSE_DAYS', 'Audit response time – avg days to submit CAP after finding', 'Compliance', 'DAYS', 'LOWER_IS_BETTER', 14, true, true),
('kpi_finding_closure_days', 'FINDING_CLOSURE_DAYS', 'Finding closure time – avg days to close findings', 'Compliance', 'DAYS', 'LOWER_IS_BETTER', 30, true, true)
ON CONFLICT ("id") DO NOTHING;
