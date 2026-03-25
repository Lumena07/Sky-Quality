-- Pillar 2.3–2.6: Investigations links/team/recommendations, MoC expansion, regulatory authorities

-- ---------------------------------------------------------------------------
-- Investigations: junction + team + recommendations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_investigation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES public.sms_investigations(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.sms_reports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (investigation_id, report_id)
);

CREATE INDEX IF NOT EXISTS sms_investigation_reports_inv_idx
  ON public.sms_investigation_reports(investigation_id);
CREATE INDEX IF NOT EXISTS sms_investigation_reports_report_idx
  ON public.sms_investigation_reports(report_id);

CREATE TABLE IF NOT EXISTS public.sms_investigation_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES public.sms_investigations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (investigation_id, user_id)
);

CREATE INDEX IF NOT EXISTS sms_investigation_team_inv_idx
  ON public.sms_investigation_team(investigation_id);

CREATE TABLE IF NOT EXISTS public.sms_investigation_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES public.sms_investigations(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  capa_id UUID NULL REFERENCES public.sms_capas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sms_investigation_recommendations_inv_idx
  ON public.sms_investigation_recommendations(investigation_id);

ALTER TABLE public.sms_investigations
  ADD COLUMN IF NOT EXISTS root_cause_method TEXT,
  ADD COLUMN IF NOT EXISTS contributing_factors_structured JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS closure_signature TEXT NULL;

-- ---------------------------------------------------------------------------
-- MoC: safety assessment + hazard links + approval artifacts
-- ---------------------------------------------------------------------------
ALTER TABLE public.sms_moc
  ADD COLUMN IF NOT EXISTS safety_impact_notes TEXT,
  ADD COLUMN IF NOT EXISTS mitigations_proposed JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS initial_likelihood SMALLINT,
  ADD COLUMN IF NOT EXISTS initial_severity SMALLINT,
  ADD COLUMN IF NOT EXISTS initial_risk_index SMALLINT,
  ADD COLUMN IF NOT EXISTS initial_risk_level TEXT,
  ADD COLUMN IF NOT EXISTS dos_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dos_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS approval_conditions TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS am_approval_signature TEXT NULL,
  ADD COLUMN IF NOT EXISTS am_approved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.sms_moc_hazard_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moc_id UUID NOT NULL REFERENCES public.sms_moc(id) ON DELETE CASCADE,
  hazard_id UUID NOT NULL REFERENCES public.sms_hazards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (moc_id, hazard_id)
);

CREATE INDEX IF NOT EXISTS sms_moc_hazard_links_moc_idx ON public.sms_moc_hazard_links(moc_id);

-- ---------------------------------------------------------------------------
-- Regulatory authorities (per organisation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_regulatory_authorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sms_regulatory_authorities_org_idx
  ON public.sms_regulatory_authorities(organization_id);

ALTER TABLE public.sms_regulatory_reports
  ADD COLUMN IF NOT EXISTS regulatory_authority_id UUID NULL REFERENCES public.sms_regulatory_authorities(id) ON DELETE SET NULL;
