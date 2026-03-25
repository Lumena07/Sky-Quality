-- eSMS core foundation: roles, enums, tables, and constraints

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'DIRECTOR_OF_SAFETY'
  ) THEN
    ALTER TYPE public."UserRole" ADD VALUE 'DIRECTOR_OF_SAFETY';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'SAFETY_OFFICER'
  ) THEN
    ALTER TYPE public."UserRole" ADD VALUE 'SAFETY_OFFICER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operational_area') THEN
    CREATE TYPE public.operational_area AS ENUM (
      'airline_ops',
      'mro_maintenance',
      'airport_ground_ops',
      'all',
      'other'
    );
  END IF;
END $$;

ALTER TABLE public."User"
  ADD COLUMN IF NOT EXISTS "safetyOperationalArea" public.operational_area;

CREATE TABLE IF NOT EXISTS public.sms_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number TEXT UNIQUE NOT NULL,
  report_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW',
  occurred_at TIMESTAMPTZ NOT NULL,
  location_area public.operational_area NOT NULL DEFAULT 'other',
  location_text TEXT,
  operational_area public.operational_area NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  what_happened TEXT,
  immediate_actions TEXT,
  affected_party TEXT,
  contributing_factors TEXT[] NOT NULL DEFAULT '{}',
  icao_high_risk_categories TEXT[] NOT NULL DEFAULT '{}',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  reporter_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  reporter_department_id TEXT NULL REFERENCES public."Department"(id) ON DELETE SET NULL,
  source_qms_finding_id TEXT NULL REFERENCES public."Finding"(id) ON DELETE SET NULL,
  safety_protected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (char_length(description) >= 50),
  CHECK (NOT is_anonymous OR reporter_id IS NULL)
);

CREATE TABLE IF NOT EXISTS public.sms_hazards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL,
  report_id UUID NULL REFERENCES public.sms_reports(id) ON DELETE SET NULL,
  operational_area public.operational_area NOT NULL DEFAULT 'all',
  hazard_category TEXT,
  icao_high_risk_category TEXT,
  identified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  identified_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  initial_likelihood SMALLINT,
  initial_severity SMALLINT,
  initial_risk_index SMALLINT,
  initial_risk_level TEXT,
  residual_likelihood SMALLINT,
  residual_severity SMALLINT,
  residual_risk_index SMALLINT,
  residual_risk_level TEXT,
  risk_acceptance_status TEXT,
  risk_accepted_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  risk_accepted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'OPEN',
  review_date DATE,
  safety_protected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_id UUID NULL REFERENCES public.sms_hazards(id) ON DELETE CASCADE,
  moc_id UUID NULL,
  assessment_type TEXT NOT NULL DEFAULT 'INITIAL',
  likelihood SMALLINT NOT NULL,
  severity SMALLINT NOT NULL,
  risk_index SMALLINT NOT NULL,
  risk_level TEXT NOT NULL,
  assessed_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (likelihood BETWEEN 1 AND 5),
  CHECK (severity BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS public.sms_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_number TEXT UNIQUE NOT NULL,
  lead_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_completion_date DATE,
  status TEXT NOT NULL DEFAULT 'OPEN',
  event_description TEXT,
  immediate_causes TEXT,
  contributing_factors TEXT,
  root_cause_analysis TEXT,
  safety_deficiencies TEXT,
  recommendations TEXT,
  report_file_url TEXT,
  closure_signed_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  closure_signed_at TIMESTAMPTZ,
  requires_regulatory_notification BOOLEAN NOT NULL DEFAULT false,
  regulatory_notification_date TIMESTAMPTZ,
  regulatory_reference TEXT,
  operational_area public.operational_area NOT NULL DEFAULT 'all',
  safety_protected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_capas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_number TEXT UNIQUE NOT NULL,
  capa_type TEXT NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  assigned_owner_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  target_completion_date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'OPEN',
  completion_evidence TEXT,
  completion_attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  effectiveness_verified_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  effectiveness_verified_at TIMESTAMPTZ,
  effectiveness_outcome TEXT,
  operational_area public.operational_area NOT NULL DEFAULT 'all',
  safety_protected BOOLEAN NOT NULL DEFAULT true,
  qms_corrective_action_id TEXT NULL REFERENCES public."CorrectiveAction"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_moc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  change_type TEXT NOT NULL,
  operational_area public.operational_area NOT NULL DEFAULT 'all',
  proposed_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  implementation_date DATE,
  introduces_new_hazards TEXT NOT NULL DEFAULT 'UNKNOWN',
  review_by_dos_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  approved_by_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  post_review_date DATE,
  post_review_outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_regulatory_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number TEXT UNIQUE NOT NULL,
  sms_report_id UUID NULL REFERENCES public.sms_reports(id) ON DELETE SET NULL,
  sms_investigation_id UUID NULL REFERENCES public.sms_investigations(id) ON DELETE SET NULL,
  regulatory_authority TEXT NOT NULL,
  report_type TEXT NOT NULL,
  submission_date TIMESTAMPTZ,
  submission_method TEXT,
  authority_reference_number TEXT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  initial_deadline_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_safety_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number TEXT NOT NULL,
  policy_text TEXT,
  file_url TEXT,
  effective_date DATE NOT NULL,
  review_due_date DATE,
  am_signed_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  am_signed_name TEXT,
  am_signed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number TEXT NOT NULL,
  revision_number TEXT NOT NULL,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  owner_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  effective_date DATE,
  review_date DATE,
  file_url TEXT,
  visible_to_all_staff BOOLEAN NOT NULL DEFAULT false,
  is_superseded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_number, revision_number)
);

CREATE TABLE IF NOT EXISTS public.sms_personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  post_holder_type TEXT NOT NULL,
  appointment_letter_url TEXT,
  appointment_date DATE,
  appointed_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  regulatory_notification_date DATE,
  regulatory_reference_number TEXT,
  operational_area public.operational_area,
  currency_status TEXT NOT NULL DEFAULT 'CURRENT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_holder_type)
);

CREATE TABLE IF NOT EXISTS public.sms_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES public.sms_personnel(id) ON DELETE CASCADE,
  qualification_name TEXT NOT NULL,
  awarding_body TEXT,
  date_obtained DATE,
  expiry_date DATE,
  certificate_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_training_personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES public.sms_personnel(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  provider TEXT,
  delivery_method TEXT,
  completed_at DATE,
  expiry_date DATE,
  certificate_url TEXT,
  training_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_erp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number TEXT NOT NULL,
  erp_text TEXT,
  file_url TEXT,
  review_cycle_months INTEGER NOT NULL DEFAULT 12,
  next_review_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_training_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  training_type TEXT NOT NULL,
  delivery_method TEXT,
  completed_at DATE,
  expiry_date DATE,
  certificate_url TEXT,
  recorded_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT UNIQUE NOT NULL,
  communication_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_audience TEXT[] NOT NULL DEFAULT '{}',
  requires_acknowledgement BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  expiry_date DATE,
  created_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES public.sms_communications(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (communication_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.sms_lessons_learned (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  operational_areas public.operational_area[] NOT NULL DEFAULT '{}'::public.operational_area[],
  details TEXT,
  key_learning_points TEXT[] NOT NULL DEFAULT '{}',
  recommended_actions TEXT,
  related_report_ids UUID[] NOT NULL DEFAULT '{}',
  published_at TIMESTAMPTZ,
  author_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  theme TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  target_audience TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  responsible_officer_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  created_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.sms_surveys(id) ON DELETE CASCADE,
  response_token_hash TEXT,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_spis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spi_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  measurement_method TEXT,
  data_source TEXT NOT NULL,
  reporting_frequency TEXT NOT NULL,
  target_value NUMERIC,
  alert_level NUMERIC,
  created_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_spi_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spi_id UUID NOT NULL REFERENCES public.sms_spis(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  value NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (spi_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS public.sms_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_number TEXT UNIQUE NOT NULL,
  meeting_type TEXT NOT NULL,
  title TEXT NOT NULL,
  chaired_by_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  minutes TEXT,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_meeting_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.sms_meetings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  owner_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  audit_type TEXT NOT NULL,
  operational_area public.operational_area NOT NULL DEFAULT 'all',
  lead_auditor_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  planned_date DATE,
  actual_date DATE,
  scope TEXT,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  report_url TEXT,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  dos_signoff_by TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  dos_signoff_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.sms_audits(id) ON DELETE CASCADE,
  finding_number TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  linked_sms_element TEXT,
  risk_level TEXT,
  linked_capa_id UUID NULL REFERENCES public.sms_capas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (audit_id, finding_number)
);

CREATE TABLE IF NOT EXISTS public.sms_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB
);

CREATE TABLE IF NOT EXISTS public.sms_identifiers (
  key TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sms_reports_status_idx ON public.sms_reports(status);
CREATE INDEX IF NOT EXISTS sms_reports_operational_area_idx ON public.sms_reports(operational_area);
CREATE INDEX IF NOT EXISTS sms_hazards_status_idx ON public.sms_hazards(status);
CREATE INDEX IF NOT EXISTS sms_capas_status_idx ON public.sms_capas(status);
CREATE INDEX IF NOT EXISTS sms_audit_log_module_idx ON public.sms_audit_log(module);
CREATE INDEX IF NOT EXISTS sms_audit_log_record_idx ON public.sms_audit_log(record_id);
