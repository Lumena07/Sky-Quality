-- Pillar 1: policy workflow, objectives, document publish, personnel regulatory log, ERP structure

ALTER TABLE public.sms_safety_policy
  ADD COLUMN IF NOT EXISTS submitted_for_signature_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sms_safety_policy.policy_text IS 'Safety policy body; may contain HTML from rich-text editor.';

CREATE TABLE IF NOT EXISTS public.sms_safety_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version_id UUID NULL REFERENCES public.sms_safety_policy(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'ON_TRACK',
  linked_spi_id UUID NULL REFERENCES public.sms_spis(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sms_safety_objectives_policy_idx ON public.sms_safety_objectives(policy_version_id);
CREATE INDEX IF NOT EXISTS sms_safety_objectives_spi_idx ON public.sms_safety_objectives(linked_spi_id);

CREATE TABLE IF NOT EXISTS public.sms_cron_milestone_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_job TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  milestone_key TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cron_job, entity_type, entity_id, milestone_key, user_id)
);

CREATE INDEX IF NOT EXISTS sms_cron_milestone_sent_lookup_idx
  ON public.sms_cron_milestone_sent(cron_job, entity_type, entity_id);

ALTER TABLE public.sms_documents
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.sms_personnel_regulatory_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES public.sms_personnel(id) ON DELETE CASCADE,
  notified_at DATE NOT NULL,
  authority_name TEXT NOT NULL,
  method TEXT,
  reference_number TEXT,
  notified_by_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sms_personnel_reg_notif_personnel_idx
  ON public.sms_personnel_regulatory_notifications(personnel_id);

ALTER TABLE public.sms_erp
  ADD COLUMN IF NOT EXISTS sections_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.sms_erp_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_id UUID NOT NULL REFERENCES public.sms_erp(id) ON DELETE CASCADE,
  planned_date DATE,
  drill_type TEXT,
  participants TEXT,
  actual_date DATE,
  outcome TEXT,
  deficiencies TEXT,
  corrective_actions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sms_erp_drills_erp_idx ON public.sms_erp_drills(erp_id);

CREATE TABLE IF NOT EXISTS public.sms_erp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_id UUID NOT NULL REFERENCES public.sms_erp(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  primary_phone TEXT,
  secondary_phone TEXT,
  available_24_7 BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sms_erp_contacts_erp_idx ON public.sms_erp_contacts(erp_id);
