-- Pillar 3: Assurance — SPI keys, audit team, finding status, meeting extensions, default SPIs

ALTER TABLE public.sms_spis
  ADD COLUMN IF NOT EXISTS calculation_key TEXT NULL,
  ADD COLUMN IF NOT EXISTS is_system_spi BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sms_spis.calculation_key IS 'App-defined key for auto-computed SPIs; NULL = manual/custom';
COMMENT ON COLUMN public.sms_spis.is_system_spi IS 'True for seeded default SPIs (DoS may edit targets but not delete arbitrarily — enforced in app)';

ALTER TABLE public.sms_audits
  ADD COLUMN IF NOT EXISTS audit_team_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.sms_audit_findings
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'OPEN';

ALTER TABLE public.sms_meetings
  ADD COLUMN IF NOT EXISTS attendee_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS agenda_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS decisions TEXT NULL,
  ADD COLUMN IF NOT EXISTS minutes_html TEXT NULL,
  ADD COLUMN IF NOT EXISTS minutes_published_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS actual_held_at TIMESTAMPTZ NULL;

-- Default Safety Performance Indicators (idempotent)
INSERT INTO public.sms_spis (
  spi_code,
  name,
  description,
  measurement_method,
  data_source,
  reporting_frequency,
  target_value,
  alert_level,
  calculation_key,
  is_system_spi
)
VALUES
  (
    'SPI-HAZ-REPORTS',
    'Hazard reports submitted',
    'Count of hazards registered in the SMS hazard register per period (operational area scoped for filtered roles).',
    'Count of sms_hazards rows created in calendar month',
    'AUTO',
    'MONTHLY',
    NULL,
    NULL,
    'HAZARD_REPORTS_TOTAL',
    true
  ),
  (
    'SPI-OCC-COUNT',
    'Occurrence reports (volume)',
    'Count of safety occurrence reports (sms_reports) per month; severity/type breakdown available in dashboard detail.',
    'Count of sms_reports created in calendar month',
    'AUTO',
    'MONTHLY',
    NULL,
    NULL,
    'OCCURRENCES_MONTHLY_COUNT',
    true
  ),
  (
    'SPI-INV-SLA',
    'Investigations closed within target timeframe',
    'Percentage of closed investigations where closure was on or before COALESCE(target_completion_date, opened_at + 30 days).',
    'Closed investigations meeting SLA / closed investigations in period',
    'AUTO',
    'MONTHLY',
    95,
    80,
    'INVESTIGATIONS_SLA_PCT',
    true
  ),
  (
    'SPI-CAPA-OPEN',
    'Open CAPAs',
    'Count of CAPAs in OPEN or IN_PROGRESS status.',
    'Row count on sms_capas',
    'AUTO',
    'MONTHLY',
    5,
    10,
    'OPEN_CAPAS_COUNT',
    true
  ),
  (
    'SPI-CAPA-OD',
    'Overdue CAPAs',
    'CAPAs past target_completion_date and not in a terminal status.',
    'Row count where target_completion_date < today and status not terminal',
    'AUTO',
    'MONTHLY',
    0,
    3,
    'OVERDUE_CAPAS_COUNT',
    true
  ),
  (
    'SPI-TRAIN-PCT',
    'Safety training compliance',
    'Percentage of active users with at least one valid sms_training_staff record (completed, not expired).',
    'Eligible users with valid training / active users',
    'AUTO',
    'QUARTERLY',
    95,
    85,
    'TRAINING_COMPLIANCE_PCT',
    true
  ),
  (
    'SPI-HAZ-REV-OD',
    'Overdue hazard register reviews',
    'Open hazards whose review_date is before today.',
    'Row count on sms_hazards',
    'AUTO',
    'MONTHLY',
    0,
    5,
    'OVERDUE_HAZARD_REVIEWS_COUNT',
    true
  ),
  (
    'SPI-AUD-FIND-OPEN',
    'Safety audit findings (open)',
    'Count of SMS audit findings with status OPEN.',
    'Row count on sms_audit_findings',
    'AUTO',
    'QUARTERLY',
    5,
    10,
    'AUDIT_FINDINGS_OPEN_COUNT',
    true
  ),
  (
    'SPI-INV-AVG-DAYS',
    'Time to close investigations (average days)',
    'Mean calendar days from opened_at to closure_signed_at for closed investigations.',
    'Average(closure_signed_at - opened_at) for status CLOSED',
    'AUTO',
    'QUARTERLY',
    21,
    45,
    'AVG_INVESTIGATION_CLOSE_DAYS',
    true
  )
ON CONFLICT (spi_code) DO NOTHING;
