-- FindingClassification: aviation taxonomy for findings (Domain + Classification).
-- Used for repeat-finding analytics and KPI computation.
CREATE TABLE IF NOT EXISTS "FindingClassification" (
  "id"         TEXT PRIMARY KEY,
  "group"      TEXT NOT NULL,
  "code"       TEXT NOT NULL UNIQUE,
  "name"       TEXT NOT NULL,
  "description" TEXT,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "FindingClassification_group_idx" ON "FindingClassification"("group");
CREATE INDEX IF NOT EXISTS "FindingClassification_isActive_idx" ON "FindingClassification"("isActive");

COMMENT ON TABLE "FindingClassification" IS 'Aviation finding taxonomy by domain; used for classification picker and repeat-finding KPI.';

-- Add classificationId to Finding (nullable for existing rows).
ALTER TABLE "Finding" ADD COLUMN IF NOT EXISTS "classificationId" TEXT;
ALTER TABLE "Finding" DROP CONSTRAINT IF EXISTS "Finding_classificationId_fkey";
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_classificationId_fkey"
  FOREIGN KEY ("classificationId") REFERENCES "FindingClassification"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Finding_classificationId_idx" ON "Finding"("classificationId");

-- Seed: Flight Crew
INSERT INTO "FindingClassification" ("id", "group", "code", "name", "description") VALUES
('fc_1', 'Flight Crew', 'flight_crew_expired_competency', 'Personnel performing operational duties with expired competency checks', NULL),
('fc_2', 'Flight Crew', 'flight_crew_expired_recurrent', 'Personnel performing operational duties with expired recurrent training', NULL),
('fc_3', 'Flight Crew', 'flight_crew_expired_license', 'Personnel performing operational duties with expired license', NULL),
('fc_4', 'Flight Crew', 'flight_crew_expired_medical', 'Personnel performing operational duties with expired medical certificate', NULL),
('fc_5', 'Flight Crew', 'flight_crew_no_type_rating', 'Personnel performing operational duties without required type rating', NULL),
('fc_6', 'Flight Crew', 'flight_crew_no_route_qual', 'Personnel performing operational duties without required route qualification', NULL),
('fc_7', 'Flight Crew', 'flight_crew_no_auth', 'Flight crew operating aircraft without required authorization', NULL),
('fc_8', 'Flight Crew', 'flight_crew_outside_limits', 'Flight crew operating aircraft outside approved limitations', NULL),
('fc_9', 'Flight Crew', 'flight_crew_training_interval', 'Required flight crew training not conducted within interval', NULL),
('fc_10', 'Flight Crew', 'flight_crew_records_incomplete', 'Flight crew training records incomplete', NULL),
('fc_11', 'Flight Crew', 'flight_crew_briefing', 'Flight crew briefing procedures not conducted', NULL),
('fc_12', 'Flight Crew', 'flight_crew_checklist', 'Flight crew checklist procedures not followed', NULL),
('fc_13', 'Flight Crew', 'flight_crew_sops', 'Flight crew SOPs not followed', NULL),
('fc_14', 'Flight Crew', 'flight_crew_docs_incomplete', 'Flight crew operational documentation incomplete', NULL),
('fc_15', 'Flight Crew', 'flight_crew_oper_records', 'Flight crew operational records incomplete', NULL),
('fc_16', 'Flight Crew', 'flight_crew_duty_time', 'Flight crew duty time limitations exceeded', NULL),
('fc_17', 'Flight Crew', 'flight_crew_rest', 'Minimum rest requirements not provided', NULL),
('fc_18', 'Flight Crew', 'flight_crew_fatigue', 'Flight crew fatigue reporting procedures not followed', NULL),
('fc_19', 'Flight Crew', 'flight_crew_monitoring', 'Flight crew operational monitoring not conducted', NULL)
ON CONFLICT ("id") DO NOTHING;

-- Cabin Crew
INSERT INTO "FindingClassification" ("id", "group", "code", "name", "description") VALUES
('cc_1', 'Cabin Crew', 'cabin_crew_expired_competency', 'Cabin crew performing duties with expired competency checks', NULL),
('cc_2', 'Cabin Crew', 'cabin_crew_expired_training', 'Cabin crew performing duties with expired recurrent training', NULL),
('cc_3', 'Cabin Crew', 'cabin_crew_no_qualification', 'Cabin crew performing duties without required qualification', NULL),
('cc_4', 'Cabin Crew', 'cabin_crew_records_incomplete', 'Cabin crew training records incomplete', NULL),
('cc_5', 'Cabin Crew', 'cabin_crew_safety_training', 'Cabin crew safety training not conducted within interval', NULL),
('cc_6', 'Cabin Crew', 'cabin_crew_emergency_training', 'Cabin crew emergency procedures training not conducted', NULL),
('cc_7', 'Cabin Crew', 'cabin_crew_safety_procedures', 'Cabin crew safety procedures not followed', NULL),
('cc_8', 'Cabin Crew', 'cabin_crew_briefing', 'Passenger safety briefing procedures not conducted', NULL),
('cc_9', 'Cabin Crew', 'cabin_crew_equipment_checks', 'Cabin safety equipment checks not conducted', NULL),
('cc_10', 'Cabin Crew', 'cabin_crew_certification', 'Cabin crew operating without required certification', NULL),
('cc_11', 'Cabin Crew', 'cabin_crew_equipment_knowledge', 'Cabin crew emergency equipment knowledge inadequate', NULL),
('cc_12', 'Cabin Crew', 'cabin_crew_reporting', 'Cabin crew safety reporting procedures not followed', NULL)
ON CONFLICT ("id") DO NOTHING;

-- Maintenance
INSERT INTO "FindingClassification" ("id", "group", "code", "name", "description") VALUES
('mnt_1', 'Maintenance', 'mnt_expired_license', 'Maintenance personnel performing duties with expired license', NULL),
('mnt_2', 'Maintenance', 'mnt_no_authorization', 'Maintenance personnel performing duties without authorization', NULL),
('mnt_3', 'Maintenance', 'mnt_interval', 'Maintenance tasks not performed within required interval', NULL),
('mnt_4', 'Maintenance', 'mnt_records', 'Maintenance records incomplete or inaccurate', NULL),
('mnt_5', 'Maintenance', 'mnt_release_cert', 'Aircraft released to service without authorized certification', NULL),
('mnt_6', 'Maintenance', 'mnt_programme', 'Aircraft maintenance programme not followed', NULL),
('mnt_7', 'Maintenance', 'mnt_ad', 'Airworthiness directives not complied with', NULL),
('mnt_8', 'Maintenance', 'mnt_sb', 'Mandatory service bulletins not implemented', NULL),
('mnt_9', 'Maintenance', 'mnt_traceability', 'Component traceability not maintained', NULL),
('mnt_10', 'Maintenance', 'mnt_status', 'Aircraft maintenance status not monitored', NULL),
('mnt_11', 'Maintenance', 'mnt_planning', 'Maintenance planning records incomplete', NULL),
('mnt_12', 'Maintenance', 'mnt_calibration', 'Maintenance tools calibration overdue', NULL),
('mnt_13', 'Maintenance', 'mnt_procedures', 'Maintenance procedures not followed', NULL),
('mnt_14', 'Maintenance', 'mnt_tech_log', 'Aircraft technical log incomplete', NULL),
('mnt_15', 'Maintenance', 'mnt_defect_doc', 'Defect rectification not properly documented', NULL),
('mnt_16', 'Maintenance', 'mnt_training', 'Maintenance training not conducted', NULL),
('mnt_17', 'Maintenance', 'mnt_inspection', 'Maintenance inspection procedures not followed', NULL),
('mnt_18', 'Maintenance', 'mnt_quality', 'Maintenance quality inspections not conducted', NULL),
('mnt_19', 'Maintenance', 'mnt_qual_records', 'Maintenance personnel qualification records incomplete', NULL)
ON CONFLICT ("id") DO NOTHING;

-- Dispatch / Operational Control
INSERT INTO "FindingClassification" ("id", "group", "code", "name", "description") VALUES
('disp_1', 'Dispatch', 'dispatch_expired_training', 'Dispatch personnel performing duties with expired training', NULL),
('disp_2', 'Dispatch', 'dispatch_no_qualification', 'Dispatch personnel performing duties without qualification', NULL),
('disp_3', 'Dispatch', 'dispatch_no_auth', 'Flight dispatch conducted without proper authorization', NULL),
('disp_4', 'Dispatch', 'dispatch_control', 'Operational control procedures not implemented', NULL),
('disp_5', 'Dispatch', 'dispatch_release', 'Flight release procedures not followed', NULL),
('disp_6', 'Dispatch', 'dispatch_weather', 'Weather information not verified before flight release', NULL),
('disp_7', 'Dispatch', 'dispatch_planning', 'Flight planning procedures not followed', NULL),
('disp_8', 'Dispatch', 'dispatch_alternate', 'Required alternate aerodrome not included', NULL),
('disp_9', 'Dispatch', 'dispatch_fuel_planning', 'Fuel planning procedures not followed', NULL),
('disp_10', 'Dispatch', 'dispatch_records', 'Dispatch records incomplete', NULL),
('disp_11', 'Dispatch', 'dispatch_briefing', 'Operational briefing not conducted', NULL),
('disp_12', 'Dispatch', 'dispatch_training_records', 'Dispatch training records incomplete', NULL),
('disp_13', 'Dispatch', 'dispatch_monitoring', 'Dispatch operational monitoring not conducted', NULL)
ON CONFLICT ("id") DO NOTHING;

-- Ground Handling
INSERT INTO "FindingClassification" ("id", "group", "code", "name", "description") VALUES
('gh_1', 'Ground Handling', 'ground_no_training', 'Ground personnel performing duties without required training', NULL),
('gh_2', 'Ground Handling', 'ground_no_auth', 'Ground personnel performing duties without authorization', NULL),
('gh_3', 'Ground Handling', 'ground_loading', 'Aircraft loading procedures not followed', NULL),
('gh_4', 'Ground Handling', 'ground_wb', 'Weight and balance documentation incomplete', NULL),
('gh_5', 'Ground Handling', 'ground_loading_limits', 'Aircraft loading conducted outside approved limits', NULL),
('gh_6', 'Ground Handling', 'ground_ramp_safety', 'Ramp safety procedures not implemented', NULL),
('gh_7', 'Ground Handling', 'ground_safety', 'Ground safety procedures not followed', NULL),
('gh_8', 'Ground Handling', 'ground_passenger', 'Passenger handling procedures not followed', NULL),
('gh_9', 'Ground Handling', 'ground_dg', 'Dangerous goods handling procedures not followed', NULL),
('gh_10', 'Ground Handling', 'ground_equipment', 'Ground equipment inspection not conducted', NULL),
('gh_11', 'Ground Handling', 'ground_records', 'Ground handling records incomplete', NULL),
('gh_12', 'Ground Handling', 'ground_safety_training', 'Ground personnel safety training not conducted', NULL),
('gh_13', 'Ground Handling', 'ground_marshalling', 'Aircraft marshalling procedures not followed', NULL),
('gh_14', 'Ground Handling', 'ground_towing', 'Aircraft towing procedures not followed', NULL)
ON CONFLICT ("id") DO NOTHING;

-- SMS
INSERT INTO "FindingClassification" ("id", "group", "code", "name", "description") VALUES
('sms_1', 'SMS', 'sms_hazard_reporting', 'Hazard reporting system not implemented', NULL),
('sms_2', 'SMS', 'sms_investigation', 'Safety reports not investigated', NULL),
('sms_3', 'SMS', 'sms_risk_assessment', 'Risk assessments not conducted', NULL),
('sms_4', 'SMS', 'sms_promotion', 'Safety promotion activities not conducted', NULL),
('sms_5', 'SMS', 'sms_indicators', 'Safety performance indicators not monitored', NULL),
('sms_6', 'SMS', 'sms_meetings', 'Safety review meetings not conducted', NULL),
('sms_7', 'SMS', 'sms_reporting', 'Safety occurrence reporting procedures not followed', NULL),
('sms_8', 'SMS', 'sms_investigations', 'Safety investigations not conducted', NULL),
('sms_9', 'SMS', 'sms_risk_doc', 'Safety risk assessments not documented', NULL),
('sms_10', 'SMS', 'sms_analysis', 'Safety data analysis not performed', NULL),
('sms_11', 'SMS', 'sms_corrective', 'Safety corrective actions not implemented', NULL)
ON CONFLICT ("id") DO NOTHING;

-- Compliance Monitoring / Quality
INSERT INTO "FindingClassification" ("id", "group", "code", "name", "description") VALUES
('cm_1', 'Compliance Monitoring', 'cm_audit_programme', 'Audit programme not implemented', NULL),
('cm_2', 'Compliance Monitoring', 'cm_audits_not_done', 'Planned audits not conducted', NULL),
('cm_3', 'Compliance Monitoring', 'cm_corrective_timeframe', 'Corrective actions not implemented within timeframe', NULL),
('cm_4', 'Compliance Monitoring', 'cm_root_cause', 'Root cause analysis inadequate', NULL),
('cm_5', 'Compliance Monitoring', 'cm_previous_findings', 'Previous audit findings not effectively closed', NULL),
('cm_6', 'Compliance Monitoring', 'cm_external_providers', 'External providers not audited', NULL),
('cm_7', 'Compliance Monitoring', 'cm_procedures', 'Compliance monitoring procedures not followed', NULL),
('cm_8', 'Compliance Monitoring', 'cm_records', 'Audit records incomplete', NULL),
('cm_9', 'Compliance Monitoring', 'cm_independence', 'Compliance monitoring independence not maintained', NULL)
ON CONFLICT ("id") DO NOTHING;

-- Document Control
INSERT INTO "FindingClassification" ("id", "group", "code", "name", "description") VALUES
('doc_1', 'Document Control', 'doc_obsolete', 'Personnel using obsolete documents', NULL),
('doc_2', 'Document Control', 'doc_revision', 'Document revision control not implemented', NULL),
('doc_3', 'Document Control', 'doc_distribution', 'Controlled documents not distributed', NULL),
('doc_4', 'Document Control', 'doc_approval', 'Document approval procedures not followed', NULL),
('doc_5', 'Document Control', 'doc_retention', 'Records retention requirements not followed', NULL),
('doc_6', 'Document Control', 'doc_access', 'Document access control not implemented', NULL),
('doc_7', 'Document Control', 'doc_version', 'Document version control not maintained', NULL),
('doc_8', 'Document Control', 'doc_external', 'Documentation from external sources not controlled', NULL)
ON CONFLICT ("id") DO NOTHING;

-- Dangerous Goods
INSERT INTO "FindingClassification" ("id", "group", "code", "name", "description") VALUES
('dg_1', 'Dangerous Goods', 'dg_training', 'Personnel handling dangerous goods without required training', NULL),
('dg_2', 'Dangerous Goods', 'dg_acceptance', 'Dangerous goods acceptance procedures not followed', NULL),
('dg_3', 'Dangerous Goods', 'dg_documentation', 'Dangerous goods documentation incomplete', NULL),
('dg_4', 'Dangerous Goods', 'dg_storage', 'Dangerous goods storage procedures not followed', NULL),
('dg_5', 'Dangerous Goods', 'dg_emergency', 'Dangerous goods emergency procedures not implemented', NULL),
('dg_6', 'Dangerous Goods', 'dg_segregation', 'Dangerous goods segregation procedures not followed', NULL),
('dg_7', 'Dangerous Goods', 'dg_inspection', 'Dangerous goods inspection procedures not followed', NULL)
ON CONFLICT ("id") DO NOTHING;

-- Aviation Security (AVSEC)
INSERT INTO "FindingClassification" ("id", "group", "code", "name", "description") VALUES
('sec_1', 'Security', 'security_training', 'Aviation security training not conducted', NULL),
('sec_2', 'Security', 'security_access', 'Access control procedures not implemented', NULL),
('sec_3', 'Security', 'security_screening', 'Security screening procedures not followed', NULL),
('sec_4', 'Security', 'security_incidents', 'Security incidents not reported', NULL),
('sec_5', 'Security', 'security_procedures', 'Security procedures not implemented', NULL),
('sec_6', 'Security', 'security_equipment', 'Security equipment inspections not conducted', NULL),
('sec_7', 'Security', 'security_restricted', 'Restricted area access not controlled', NULL)
ON CONFLICT ("id") DO NOTHING;

-- Fuel Management
INSERT INTO "FindingClassification" ("id", "group", "code", "name", "description") VALUES
('fuel_1', 'Fuel', 'fuel_planning', 'Fuel planning procedures not followed', NULL),
('fuel_2', 'Fuel', 'fuel_records', 'Fuel records not maintained', NULL),
('fuel_3', 'Fuel', 'fuel_supplier', 'Fuel supplier approval not documented', NULL),
('fuel_4', 'Fuel', 'fuel_uplift', 'Fuel uplift documentation incomplete', NULL),
('fuel_5', 'Fuel', 'fuel_quality', 'Fuel quality checks not conducted', NULL),
('fuel_6', 'Fuel', 'fuel_contamination', 'Fuel contamination checks not performed', NULL)
ON CONFLICT ("id") DO NOTHING;

-- Emergency Response
INSERT INTO "FindingClassification" ("id", "group", "code", "name", "description") VALUES
('er_1', 'Emergency Response', 'er_plan', 'Emergency response plan not implemented', NULL),
('er_2', 'Emergency Response', 'er_training', 'Emergency response training not conducted', NULL),
('er_3', 'Emergency Response', 'er_exercises', 'Emergency response exercises not conducted', NULL),
('er_4', 'Emergency Response', 'er_contacts', 'Emergency contact procedures not established', NULL),
('er_5', 'Emergency Response', 'er_equipment', 'Emergency equipment inspections not conducted', NULL)
ON CONFLICT ("id") DO NOTHING;
