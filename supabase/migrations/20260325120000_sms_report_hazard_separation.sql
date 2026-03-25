-- SMS report/hazard workflow correction:
-- - reports are intake records
-- - hazards are separate promoted records linked by source_report_id
-- - promoted hazards start in PENDING_ASSESSMENT

ALTER TABLE public.sms_hazards
  ADD COLUMN IF NOT EXISTS source_report_id UUID NULL REFERENCES public.sms_reports(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sms_hazards'
      AND column_name = 'report_id'
  ) THEN
    UPDATE public.sms_hazards
    SET source_report_id = report_id
    WHERE source_report_id IS NULL
      AND report_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sms_hazards_source_report_id_idx
  ON public.sms_hazards(source_report_id);

ALTER TABLE public.sms_hazards
  ALTER COLUMN initial_likelihood DROP NOT NULL,
  ALTER COLUMN initial_severity DROP NOT NULL,
  ALTER COLUMN initial_risk_index DROP NOT NULL,
  ALTER COLUMN initial_risk_level DROP NOT NULL;

ALTER TABLE public.sms_hazards
  ALTER COLUMN status SET DEFAULT 'PENDING_ASSESSMENT';

UPDATE public.sms_hazards
SET status = 'PENDING_ASSESSMENT'
WHERE status IS NULL
   OR status = 'OPEN';
