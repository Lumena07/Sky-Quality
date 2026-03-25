/** Stored in sms_audits.audit_type; must match internal SMS audit compliance filter */
export const SMS_INTERNAL_AUDIT_TYPE = 'INTERNAL_SMS_AUDIT' as const

export const SMS_AUDIT_TYPE_OPTIONS = [
  { value: SMS_INTERNAL_AUDIT_TYPE, label: 'Internal SMS Audit' },
  { value: 'DEPARTMENT_SAFETY_SURVEY', label: 'Department Safety Survey' },
  { value: 'REGULATORY_COMPLIANCE_AUDIT', label: 'Regulatory Compliance Audit' },
  { value: 'RAMP_INSPECTION', label: 'Ramp Inspection' },
  { value: 'MAINTENANCE_SAFETY_AUDIT', label: 'Maintenance Safety Audit' },
] as const

export type SmsAuditTypeOption = (typeof SMS_AUDIT_TYPE_OPTIONS)[number]['value']

export type ChecklistItem = { id: string; label: string; done: boolean; notes: string }

const mk = (label: string, idx: number): ChecklistItem => ({
  id: `item-${idx}`,
  label,
  done: false,
  notes: '',
})

/** Default checklist lines per audit type (editable per audit in UI). */
export const getDefaultSmsAuditChecklist = (auditType: string): ChecklistItem[] => {
  const templates: Record<string, string[]> = {
    [SMS_INTERNAL_AUDIT_TYPE]: [
      'SMS policy and accountability documented and communicated',
      'Hazard reporting and risk register processes active',
      'Investigation and CAPA workflow followed for sample cases',
      'Safety assurance meetings and SPI review evidence',
      'Emergency response plan accessibility and awareness',
    ],
    DEPARTMENT_SAFETY_SURVEY: [
      'Department hazard awareness briefing completed',
      'Local risk controls and mitigations reviewed',
      'Staff feedback on safety concerns collected',
      'Training records for department roles sampled',
    ],
    REGULATORY_COMPLIANCE_AUDIT: [
      'Applicable regulations and amendments identified',
      'Evidence of compliance for sampled obligations',
      'Regulatory correspondence and submissions current',
      'Findings from authority audits addressed',
    ],
    RAMP_INSPECTION: [
      'Aircraft movement area FOD check',
      'Ground equipment condition and stowage',
      ' Marshalling / wing-walker procedures observed',
      'Fuel and dangerous goods handling points',
    ],
    MAINTENANCE_SAFETY_AUDIT: [
      'Hangar and workshop housekeeping',
      'Tool control and critical task signage',
      'PPE and human factors controls',
      'Maintenance error reporting culture',
    ],
  }
  const lines = templates[auditType] ?? templates[SMS_INTERNAL_AUDIT_TYPE]
  return lines.map((label, i) => mk(label, i))
}
