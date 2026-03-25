import {
  canApproveSmsPolicy,
  canManageSmsPersonnel,
  canManageSmsPolicy,
  canViewSmsProtectedData,
  isAccountableManager,
  isDirectorOfSafety,
  isSafetyOfficer,
} from '@/lib/permissions'

export type OperationalArea =
  | 'airline_ops'
  | 'mro_maintenance'
  | 'airport_ground_ops'
  | 'all'
  | 'other'

export const canReadSmsDashboard = (roles: string[]): boolean =>
  isDirectorOfSafety(roles) || isAccountableManager(roles) || roles.includes('DEPARTMENT_HEAD')

export const canManageSmsSpis = (roles: string[]): boolean => isDirectorOfSafety(roles)

export const canSignOffSmsAuditClosure = (roles: string[]): boolean => isDirectorOfSafety(roles)

/** Scope for assurance KPIs: org-wide vs single operational area */
export type AssuranceOperationalScope =
  | { mode: 'all' }
  | { mode: 'area'; area: string }

export const getAssuranceOperationalScope = (
  roles: string[],
  safetyOperationalArea: string | null
): AssuranceOperationalScope => {
  if (isDirectorOfSafety(roles) || isAccountableManager(roles)) return { mode: 'all' }
  const oa = safetyOperationalArea?.trim()
  if (oa && oa !== 'all') {
    if (roles.includes('DEPARTMENT_HEAD')) return { mode: 'area', area: oa }
    if (isSafetyOfficer(roles)) return { mode: 'area', area: oa }
  }
  return { mode: 'all' }
}

export const canSubmitSmsReport = (roles: string[]): boolean =>
  isDirectorOfSafety(roles) ||
  isSafetyOfficer(roles) ||
  roles.includes('DEPARTMENT_HEAD') ||
  roles.includes('STAFF') ||
  isAccountableManager(roles)

export const canManageSmsReport = (
  roles: string[],
  userArea: OperationalArea | null,
  reportArea: OperationalArea
): boolean =>
  isDirectorOfSafety(roles) ||
  (isSafetyOfficer(roles) && Boolean(userArea) && (userArea === reportArea || userArea === 'all'))

export const canViewSmsPersonnel = (
  roles: string[],
  viewerUserId: string,
  recordUserId: string
): boolean => canManageSmsPersonnel(roles) || (isAccountableManager(roles) && viewerUserId === recordUserId)

export const canManageSmsApproval = (roles: string[], riskLevel: string): boolean => {
  if (riskLevel === 'UNACCEPTABLE') return isAccountableManager(roles)
  return isDirectorOfSafety(roles)
}

/** My Safety portal: these roles see all staff training rows; others see only their own. */
export const canViewAllSmsTrainingInMySafetyPortal = (roles: string[]): boolean =>
  isDirectorOfSafety(roles) || isSafetyOfficer(roles) || isAccountableManager(roles)

/** Director of Safety, Safety Officers, and Accountable Manager see all SMS occurrence reports. */
export const canViewAllSmsReports = (roles: string[]): boolean =>
  isDirectorOfSafety(roles) || isSafetyOfficer(roles) || isAccountableManager(roles)

export const canViewDepartmentSmsReports = (roles: string[]): boolean =>
  roles.includes('DEPARTMENT_HEAD')

/** Hazard register: DoS, SO, AM only (per product decision). */
export const canViewSmsHazardRegister = (roles: string[]): boolean =>
  isDirectorOfSafety(roles) || isSafetyOfficer(roles) || isAccountableManager(roles)

export const canManageSmsHazard = (
  roles: string[],
  userArea: OperationalArea | null,
  hazardArea: OperationalArea
): boolean =>
  isDirectorOfSafety(roles) ||
  isAccountableManager(roles) ||
  (isSafetyOfficer(roles) && Boolean(userArea) && (userArea === hazardArea || userArea === 'all'))

export type SmsReportRow = {
  reporter_id: string | null
  reporter_department_id: string | null
  is_anonymous: boolean
  operational_area: string
}

export const canReadSmsReport = (
  roles: string[],
  userId: string,
  departmentId: string | null,
  report: SmsReportRow
): boolean => {
  if (canViewAllSmsReports(roles)) return true
  if (canViewDepartmentSmsReports(roles) && departmentId && report.reporter_department_id === departmentId) {
    return true
  }
  if (report.reporter_id && report.reporter_id === userId) return true
  return false
}

/** Full SMS safety workflow: investigations, MoC, CAPA management (not regulatory-only). */
export const canManageSmsSafetyWorkflow = (
  roles: string[],
  userArea: OperationalArea | null,
  recordArea: OperationalArea
): boolean =>
  isDirectorOfSafety(roles) ||
  (isSafetyOfficer(roles) && Boolean(userArea) && (userArea === recordArea || userArea === 'all'))

export const canManageSmsInvestigation = canManageSmsSafetyWorkflow

export const canReadSmsInvestigation = (
  roles: string[],
  userId: string,
  userArea: OperationalArea | null,
  inv: { lead_id: string | null; operational_area: string; teamUserIds: string[] }
): boolean => {
  if (canManageSmsInvestigation(roles, userArea, inv.operational_area as OperationalArea)) return true
  if (inv.lead_id === userId) return true
  if (inv.teamUserIds.includes(userId)) return true
  return false
}

export const canCloseInvestigation = (roles: string[]): boolean => isDirectorOfSafety(roles)

export const canViewSmsMoc = (roles: string[]): boolean =>
  isDirectorOfSafety(roles) || isSafetyOfficer(roles) || isAccountableManager(roles)

export const canManageSmsMoc = (
  roles: string[],
  userArea: OperationalArea | null,
  mocArea: OperationalArea
): boolean => canManageSmsSafetyWorkflow(roles, userArea, mocArea)

export const canProposeSmsMoc = (roles: string[]): boolean =>
  roles.includes('STAFF') ||
  roles.includes('DEPARTMENT_HEAD') ||
  isDirectorOfSafety(roles) ||
  isSafetyOfficer(roles) ||
  isAccountableManager(roles)

/** Regulatory: DoS (and SO) manage; AM view-only. */
export const canManageSmsRegulatory = (roles: string[]): boolean =>
  isDirectorOfSafety(roles) || isSafetyOfficer(roles)

export const canViewSmsRegulatory = (roles: string[]): boolean =>
  canManageSmsRegulatory(roles) || isAccountableManager(roles)

export const canVerifySmsCapaEffectiveness = (roles: string[]): boolean =>
  isDirectorOfSafety(roles) || isSafetyOfficer(roles)

export {
  canApproveSmsPolicy,
  canManageSmsPersonnel,
  canManageSmsPolicy,
  canViewSmsProtectedData,
}
