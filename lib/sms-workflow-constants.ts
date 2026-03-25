/** Investigations, MoC, CAPA, regulatory — DB values and UI labels */

export const INVESTIGATION_STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'CLOSED', label: 'Closed' },
] as const

export const ROOT_CAUSE_METHODS = [
  { value: 'FISHBONE', label: 'ICAO fishbone' },
  { value: 'FIVE_WHYS', label: '5-Whys' },
  { value: 'OTHER', label: 'Other / free text' },
] as const

export const MOC_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'UNDER_ASSESSMENT', label: 'Under Assessment' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'APPROVED_WITH_CONDITIONS', label: 'Approved with Conditions' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'IMPLEMENTED', label: 'Implemented' },
] as const

export const MOC_CHANGE_TYPES = [
  { value: 'OPERATIONAL', label: 'Operational' },
  { value: 'ORGANISATIONAL', label: 'Organisational' },
  { value: 'INFRASTRUCTURE', label: 'Infrastructure' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'PROCEDURE', label: 'Procedure' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'REGULATORY', label: 'Regulatory' },
] as const

export const CAPA_TYPES = [
  { value: 'CORRECTIVE', label: 'Corrective' },
  { value: 'PREVENTIVE', label: 'Preventive' },
] as const

export const CAPA_PRIORITIES = [
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
] as const

/** Stored statuses; OVERDUE derived in API when past due + open */
export const CAPA_STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'VERIFIED_EFFECTIVE', label: 'Verified Effective' },
  { value: 'CLOSED', label: 'Closed' },
] as const

export const CAPA_SOURCE_TYPES = [
  { value: 'investigation', label: 'Investigation' },
  { value: 'hazard', label: 'Hazard' },
  { value: 'audit', label: 'Audit finding' },
  { value: 'meeting', label: 'Safety meeting action' },
  { value: 'manual', label: 'Other' },
] as const

export const EFFECTIVENESS_OUTCOMES = [
  { value: 'EFFECTIVE', label: 'Effective' },
  { value: 'PARTIALLY_EFFECTIVE', label: 'Partially Effective' },
  { value: 'INEFFECTIVE', label: 'Ineffective' },
] as const

export const REGULATORY_REPORT_TYPES = [
  { value: 'INITIAL', label: 'Initial' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'FINAL', label: 'Final' },
] as const

export const REGULATORY_STATUSES = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'UNDER_REVIEW_AUTHORITY', label: 'Under Review by Authority' },
  { value: 'CLOSED', label: 'Closed' },
] as const

export const INTRODUCES_HAZARDS = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'UNKNOWN', label: 'Unknown' },
] as const
