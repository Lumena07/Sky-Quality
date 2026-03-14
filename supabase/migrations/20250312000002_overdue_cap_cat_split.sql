-- Add OVERDUE_CAP and OVERDUE_CAT KPI definitions; deactivate combined OVERDUE_CAP_CAT.
INSERT INTO "KpiDefinition" ("id", "code", "name", "area", "unit", "direction", "targetValue", "isComputed", "isActive") VALUES
('kpi_overdue_cap', 'OVERDUE_CAP', 'Corrective actions – % CAP entered after due date', 'Compliance', 'PERCENT', 'LOWER_IS_BETTER', 5, true, true),
('kpi_overdue_cat', 'OVERDUE_CAT', 'Corrective actions – % CAT entered after due date', 'Compliance', 'PERCENT', 'LOWER_IS_BETTER', 5, true, true)
ON CONFLICT ("id") DO NOTHING;

UPDATE "KpiDefinition" SET "isActive" = false, "updatedAt" = NOW() WHERE "code" = 'OVERDUE_CAP_CAT';
