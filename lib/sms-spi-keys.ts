/** Keys stored in sms_spis.calculation_key for auto-computed SPIs */
export const SMS_SPI_CALCULATION_KEYS = [
  'HAZARD_REPORTS_TOTAL',
  'OCCURRENCES_MONTHLY_COUNT',
  'INVESTIGATIONS_SLA_PCT',
  'OPEN_CAPAS_COUNT',
  'OVERDUE_CAPAS_COUNT',
  'TRAINING_COMPLIANCE_PCT',
  'OVERDUE_HAZARD_REVIEWS_COUNT',
  'AUDIT_FINDINGS_OPEN_COUNT',
  'AVG_INVESTIGATION_CLOSE_DAYS',
] as const

export type SmsSpiCalculationKey = (typeof SMS_SPI_CALCULATION_KEYS)[number]

export const isSmsSpiCalculationKey = (v: string | null | undefined): v is SmsSpiCalculationKey =>
  Boolean(v && (SMS_SPI_CALCULATION_KEYS as readonly string[]).includes(v))
