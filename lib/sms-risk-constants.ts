/** Shared labels and DB values for SMS Pillar 2 reporting & hazard register. */

export const SMS_REPORT_TYPES = [
  { value: 'HAZARD', label: 'Hazard' },
  { value: 'INCIDENT', label: 'Incident' },
  { value: 'SERIOUS_INCIDENT', label: 'Serious Incident' },
  { value: 'ACCIDENT', label: 'Accident' },
] as const

export const SMS_REPORT_STATUSES = [
  { value: 'NEW', label: 'New' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'PROMOTED', label: 'Promoted to Hazard Register' },
  { value: 'CLOSED', label: 'Closed' },
] as const

export type SmsReportStatus = (typeof SMS_REPORT_STATUSES)[number]['value']

export const LOCATION_AREA_OPTIONS = [
  { value: 'airline_ops', label: 'Airline Ops' },
  { value: 'mro_maintenance', label: 'MRO-Maintenance' },
  { value: 'airport_ground_ops', label: 'Airport-Ground Ops' },
  { value: 'other', label: 'Other' },
] as const

export const OPERATIONAL_AREA_OPTIONS = [
  { value: 'airline_ops', label: 'Airline Ops' },
  { value: 'mro_maintenance', label: 'MRO-Maintenance' },
  { value: 'airport_ground_ops', label: 'Airport-Ground Ops' },
  { value: 'all', label: 'All' },
  { value: 'other', label: 'Other' },
] as const

export const CONTRIBUTING_FACTORS = [
  { value: 'WEATHER', label: 'Weather' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'PROCEDURES', label: 'Procedures' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'FATIGUE', label: 'Fatigue' },
  { value: 'ENVIRONMENT', label: 'Environment' },
  { value: 'HUMAN_FACTORS', label: 'Human Factors' },
  { value: 'OTHER', label: 'Other' },
] as const

export const ICAO_HIGH_RISK_CATEGORIES = [
  { value: 'CFIT', label: 'CFIT' },
  { value: 'LOC-I', label: 'LOC-I' },
  { value: 'RUNWAY_EXCURSION', label: 'Runway Excursion' },
  { value: 'RUNWAY_INCURSION', label: 'Runway Incursion' },
  { value: 'MID_AIR_COLLISION', label: 'Mid-Air Collision' },
  { value: 'NONE', label: 'None' },
  { value: 'UNKNOWN', label: 'Unknown' },
] as const

export const HAZARD_SOURCE_TYPES = [
  { value: 'LINKED_REPORT', label: 'Linked safety report' },
  { value: 'MANUAL_AUDIT', label: 'Audit' },
  { value: 'MANUAL_INSPECTION', label: 'Inspection' },
  { value: 'MANUAL_INVESTIGATION', label: 'Investigation' },
  { value: 'MANUAL_INDUSTRY_ALERT', label: 'Industry alert' },
  { value: 'MANUAL_REGULATOR', label: 'Regulator' },
  { value: 'MANUAL_INTERNAL_REVIEW', label: 'Internal review' },
  { value: 'MANUAL', label: 'Manually identified' },
] as const

export const HAZARD_CATEGORIES = [
  { value: 'AIRSPACE', label: 'Airspace' },
  { value: 'AIRCRAFT', label: 'Aircraft' },
  { value: 'PERSONNEL', label: 'Personnel' },
  { value: 'GROUND_EQUIPMENT', label: 'Ground Equipment' },
  { value: 'INFRASTRUCTURE', label: 'Infrastructure' },
  { value: 'PROCEDURES', label: 'Procedures' },
  { value: 'WEATHER', label: 'Weather' },
  { value: 'ORGANISATIONAL', label: 'Organisational' },
  { value: 'OTHER', label: 'Other' },
] as const

export const HAZARD_STATUSES = [
  { value: 'PENDING_ASSESSMENT', label: 'Pending Assessment' },
  { value: 'OPEN', label: 'Open' },
  { value: 'MITIGATED', label: 'Mitigated' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'TRANSFERRED_CAPA', label: 'Transferred to CAPA' },
  { value: 'TRANSFERRED_INVESTIGATION', label: 'Transferred to Investigation' },
] as const

export const MITIGATION_CONTROL_TYPES = [
  { value: 'ELIMINATE', label: 'Eliminate' },
  { value: 'SUBSTITUTE', label: 'Substitute' },
  { value: 'ENGINEERING', label: 'Engineering' },
  { value: 'ADMINISTRATIVE', label: 'Administrative' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'PPE', label: 'PPE' },
] as const

export const MITIGATION_STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETE', label: 'Complete' },
  { value: 'VERIFIED', label: 'Verified' },
] as const

export const LIKELIHOOD_LABELS: Record<number, string> = {
  1: 'Improbable',
  2: 'Remote',
  3: 'Occasional',
  4: 'Probable',
  5: 'Frequent',
}

export const SEVERITY_LABELS: Record<number, string> = {
  1: 'Negligible',
  2: 'Minor',
  3: 'Major',
  4: 'Hazardous',
  5: 'Catastrophic',
}

export const riskIndexToLevel = (index: number): 'ACCEPTABLE' | 'ALARP' | 'UNACCEPTABLE' => {
  if (index <= 4) return 'ACCEPTABLE'
  if (index <= 9) return 'ALARP'
  return 'UNACCEPTABLE'
}

export const riskLevelBand = (level: string): 'green' | 'amber' | 'red' => {
  if (level === 'ACCEPTABLE') return 'green'
  if (level === 'ALARP') return 'amber'
  return 'red'
}

/** Risk index ranges per 5×5 cell for matrix band filtering */
export const riskBandForIndex = (index: number): '1-4' | '5-9' | '10-25' => {
  if (index <= 4) return '1-4'
  if (index <= 9) return '5-9'
  return '10-25'
}

export type HazardLike = {
  residual_likelihood?: number | null
  residual_severity?: number | null
  initial_likelihood?: number | null
  initial_severity?: number | null
}

/**
 * Matrix position: initial cell = (initial L, initial S).
 * After controls, only likelihood is reassessed; consequence (severity) stays equal to initial severity.
 * Stored residual_severity may mirror initial for legacy rows — plotting always uses initial severity as S.
 */
export const hazardPlotCoords = (h: HazardLike) => {
  const initialL = Math.min(5, Math.max(1, Number(h.initial_likelihood ?? 1)))
  const initialS = Math.min(5, Math.max(1, Number(h.initial_severity ?? 1)))
  const hasResidualL = h.residual_likelihood != null && Number(h.residual_likelihood) > 0
  const L = hasResidualL ? Math.min(5, Math.max(1, Number(h.residual_likelihood))) : initialL
  const S = initialS
  const index = L * S
  return { L, S, index, level: riskIndexToLevel(index), band: riskBandForIndex(index) }
}
