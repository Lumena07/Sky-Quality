-- Pillar 2: hazard mitigations, ICAO categories array, AM signature for risk acceptance

CREATE TABLE IF NOT EXISTS public.sms_hazard_mitigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_id UUID NOT NULL REFERENCES public.sms_hazards(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  control_type TEXT NOT NULL,
  owner_id TEXT NULL REFERENCES public."User"(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (control_type IN (
    'ELIMINATE', 'SUBSTITUTE', 'ENGINEERING', 'ADMINISTRATIVE', 'TRAINING', 'PPE'
  )),
  CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETE', 'VERIFIED'))
);

CREATE INDEX IF NOT EXISTS sms_hazard_mitigations_hazard_id_idx
  ON public.sms_hazard_mitigations(hazard_id);

ALTER TABLE public.sms_hazards
  ADD COLUMN IF NOT EXISTS icao_high_risk_categories TEXT[] NOT NULL DEFAULT '{}'::text[];

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sms_hazards' AND column_name = 'icao_high_risk_category'
  ) THEN
    UPDATE public.sms_hazards h
    SET icao_high_risk_categories = ARRAY[h.icao_high_risk_category]::text[]
    WHERE h.icao_high_risk_category IS NOT NULL
      AND h.icao_high_risk_category <> ''
      AND cardinality(COALESCE(h.icao_high_risk_categories, '{}')) = 0;
  END IF;
END $$;

ALTER TABLE public.sms_hazards
  DROP COLUMN IF EXISTS icao_high_risk_category;

ALTER TABLE public.sms_hazards
  ADD COLUMN IF NOT EXISTS risk_acceptance_signature TEXT NULL;
