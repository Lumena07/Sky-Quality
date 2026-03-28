/** Roles that can review findings (root cause, CAP, CAT) and have full access to findings/documents. */
export const REVIEWER_ROLES = new Set(['QUALITY_MANAGER', 'AUDITOR'])

/** Only these roles see Admin and have full permissions (Quality Manager). */
export const ADMIN_OR_QM = new Set(['QUALITY_MANAGER'])

/** Accountable Manager: sees AM dashboard and escalations; oversight role per ICAO / internal manual. */
export const ACCOUNTABLE_MANAGER_ROLE = 'ACCOUNTABLE_MANAGER'
export const DIRECTOR_OF_SAFETY_ROLE = 'DIRECTOR_OF_SAFETY'
export const SAFETY_OFFICER_ROLE = 'SAFETY_OFFICER'

/** Roles that see full dashboard, AM dashboard, and oversight data (QM + AM). */
export const ADMIN_OR_QM_OR_AM = new Set([
  'QUALITY_MANAGER',
  ACCOUNTABLE_MANAGER_ROLE,
])

export const hasReviewerRole = (roles: string[]): boolean =>
  roles.some((r) => REVIEWER_ROLES.has(r))

export const isAdminOrQM = (roles: string[]): boolean =>
  roles.some((r) => ADMIN_OR_QM.has(r))

/** Quality Manager role (full edit access to audits, findings, etc.). */
export const isQualityManager = (roles: string[]): boolean =>
  roles.some((r) => r === 'QUALITY_MANAGER')

export const isAccountableManager = (roles: string[]): boolean =>
  roles.some((r) => r === ACCOUNTABLE_MANAGER_ROLE)

/** Can approve or reject audit reschedule requests (Accountable Manager only). */
export const canApproveAuditReschedule = (roles: string[]): boolean =>
  isAccountableManager(roles)

/** Can see AM dashboard and escalation data (AM only). */
export const canSeeAmDashboard = (roles: string[]): boolean =>
  isAccountableManager(roles)

export const isDirectorOfSafety = (roles: string[]): boolean =>
  roles.some((r) => r === DIRECTOR_OF_SAFETY_ROLE)

/**
 * Normalizes role strings from User.roles / User.role so permission checks match
 * (handles "Director of Safety", lowercase, hyphenated variants, etc.).
 */
export const normalizeAppUserRoles = (roles: string[]): string[] => {
  const alias: Record<string, string> = {
    director_of_safety: DIRECTOR_OF_SAFETY_ROLE,
    safety_officer: SAFETY_OFFICER_ROLE,
    quality_manager: 'QUALITY_MANAGER',
    accountable_manager: ACCOUNTABLE_MANAGER_ROLE,
    system_admin: 'SYSTEM_ADMIN',
    department_head: 'DEPARTMENT_HEAD',
    focal_person: 'FOCAL_PERSON',
    auditor: 'AUDITOR',
    staff: 'STAFF',
    pilot: 'PILOT',
    cabin_crew: 'CABIN_CREW',
    flight_dispatchers: 'FLIGHT_DISPATCHERS',
  }
  return roles.map((r) => {
    if (typeof r !== 'string') return String(r)
    const trimmed = r.trim()
    if (!trimmed) return trimmed
    const key = trimmed.toLowerCase().replace(/[-\s]+/g, '_')
    return alias[key] ?? trimmed
  })
}

export const isSafetyOfficer = (roles: string[]): boolean =>
  roles.some((r) => r === SAFETY_OFFICER_ROLE)

export const canAccessSmsModule = (roles: string[]): boolean =>
  isDirectorOfSafety(roles) ||
  isSafetyOfficer(roles) ||
  isAccountableManager(roles) ||
  roles.some((r) =>
    ['DEPARTMENT_HEAD', 'STAFF', 'QUALITY_MANAGER', 'AUDITOR', 'PILOT', 'CABIN_CREW', 'FLIGHT_DISPATCHERS'].includes(
      r
    )
  )

/** Roles that may open the Quality (eQMS) module from the module chooser. */
const QUALITY_MODULE_ENTRY_ROLES = new Set<string>([
  'QUALITY_MANAGER',
  'AUDITOR',
  ACCOUNTABLE_MANAGER_ROLE,
  DIRECTOR_OF_SAFETY_ROLE,
  SAFETY_OFFICER_ROLE,
  'DEPARTMENT_HEAD',
  'STAFF',
  'FOCAL_PERSON',
  'PILOT',
  'CABIN_CREW',
  'FLIGHT_DISPATCHERS',
])

/** Whether the user may enter the Quality module (dashboard and related routes). */
export const canAccessQualityModule = (roles: string[]): boolean =>
  roles.some((r) => QUALITY_MODULE_ENTRY_ROLES.has(r))

export const canManageSmsRoles = (roles: string[]): boolean =>
  isDirectorOfSafety(roles) || isAdminOrQM(roles)

export const canManageSmsPolicy = (roles: string[]): boolean =>
  isDirectorOfSafety(roles) ||
  isSafetyOfficer(roles) ||
  roles.some((r) => r === 'SYSTEM_ADMIN')

export const canApproveSmsPolicy = (roles: string[]): boolean =>
  isAccountableManager(roles)

export const canViewSmsProtectedData = (roles: string[]): boolean =>
  isDirectorOfSafety(roles) || isSafetyOfficer(roles)

export const canManageSmsPersonnel = (roles: string[]): boolean =>
  isDirectorOfSafety(roles)

/** Quality department ID; users in this dept or AM can see the Training tab. */
export const QUALITY_DEPARTMENT_ID = 'dept_quality_001'
export const SAFETY_DEPARTMENT_ID = 'dept_safety_001'

/** Training compliance department; excluded from QMS personnel training unless AM or Quality Manager role. */
export const TRAINING_COMPLIANCE_DEPARTMENT_ID = 'dept_training_001'

/** Training compliance matrix and types: Quality Manager or Training Compliance department. */
export const canManageTrainingCompliance = (
  roles: string[],
  departmentId: string | null
): boolean =>
  isQualityManager(roles) || departmentId === TRAINING_COMPLIANCE_DEPARTMENT_ID

/** Training Compliance page (read matrix for dashboard): managers, training dept, or Accountable Manager (dashboard-only UI). */
export const canAccessTrainingCompliancePage = (
  roles: string[],
  departmentId: string | null
): boolean =>
  canManageTrainingCompliance(roles, departmentId) || isAccountableManager(roles)

/** Regulatory library (read): same entry pattern as Quality module. */
export const canSeeRegulatoryLibrary = (roles: string[]): boolean =>
  canAccessQualityModule(roles)

/** External service providers / SLA register: Accountable Manager, Quality Manager, or Quality department members only. */
export const canSeeExternalServiceProviders = (
  roles: string[],
  departmentId: string | null
): boolean =>
  isAccountableManager(roles) ||
  isQualityManager(roles) ||
  departmentId === QUALITY_DEPARTMENT_ID

/** TCAA mandatory notification register and QMS audit report generation (Quality Manager only). */
export const canSeeTcaaMandatoryNotification = (roles: string[]): boolean =>
  isQualityManager(roles)

/** Parse JSON array of strings from DB (manual holders / custodian roles). */
export const parseJsonStringArray = (raw: unknown): string[] => {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      }
    } catch {
      return []
    }
  }
  return []
}

/**
 * Manual custodian: user's id is in manualHolderIds (legacy) OR any normalized role intersects manualCustodianRoles.
 */
export const isDocumentCustodian = (
  userId: string,
  userRoles: string[],
  doc: { manualCustodianRoles?: unknown; manualHolderIds?: unknown }
): boolean => {
  const holderIds = parseJsonStringArray(doc.manualHolderIds)
  if (holderIds.includes(userId)) return true
  const custodianRoles = parseJsonStringArray(doc.manualCustodianRoles)
  if (custodianRoles.length === 0) return false
  const norm = normalizeAppUserRoles(userRoles)
  return norm.some((r) => custodianRoles.includes(r))
}

/**
 * Can see Training tab and QMS personnel training APIs: Quality department or Quality Manager.
 * Training-compliance-only department: QM only. Accountable Manager alone does not use this module.
 */
export const canSeeTraining = (
  roles: string[],
  departmentId: string | null
): boolean => {
  if (departmentId === TRAINING_COMPLIANCE_DEPARTMENT_ID && !isQualityManager(roles)) {
    return false
  }
  const amOnly =
    isAccountableManager(roles) && !hasReviewerRole(roles) && !isQualityManager(roles)
  if (amOnly) {
    return false
  }
  return departmentId === QUALITY_DEPARTMENT_ID || isQualityManager(roles)
}

/**
 * Quality team register: QM, AM, or Auditor — consolidated roster of Quality dept + AMs (see API filter).
 * Auditors outside Quality can open this even when they cannot open the full Training tab.
 */
export const canSeeQualityTeamRegister = (roles: string[]): boolean =>
  hasReviewerRole(roles) || isAccountableManager(roles)

/** SMS safety personnel register visibility. DoS manages; AM/SO can view with API-level row filtering. */
export const canSeeSmsSafetyRegister = (roles: string[]): boolean =>
  isDirectorOfSafety(roles) || isAccountableManager(roles) || isSafetyOfficer(roles)

/** Can add, update, or delete training/qualification records: Quality Manager or Auditor only. */
export const canAddTraining = (roles: string[]): boolean =>
  hasReviewerRole(roles)

/** Can schedule (create) a new audit: Quality Manager or Auditor only. Accountable Manager cannot schedule audits. */
export const canScheduleAudit = (roles: string[]): boolean =>
  isQualityManager(roles) || isAuditorOnly(roles)

/** Can view the Quality Programme tab and list: Quality Manager, Auditor, or Accountable Manager. */
export const canViewAuditPlan = (roles: string[]): boolean =>
  isQualityManager(roles) || isAuditorOnly(roles) || isAccountableManager(roles)

/** Can add, edit, or delete quality programme entries: Quality Manager only. Auditors and AM have view-only. */
export const canManageAuditPlan = (roles: string[]): boolean =>
  isQualityManager(roles)

/** Can add, edit, or delete Quality Policy and Quality Objectives: Quality Manager only. */
export const canManageQualityPolicy = (roles: string[]): boolean =>
  isQualityManager(roles)

/** Can create or edit checklist templates: Quality Manager or Auditor only. Accountable Manager cannot. */
export const canCreateOrEditChecklist = (roles: string[]): boolean =>
  hasReviewerRole(roles)

/** Can edit an audit: QM always, or auditor only if assigned to that audit. */
export const canEditAudit = (
  roles: string[],
  userId: string,
  auditorUserIds: string[],
  _auditeeUserIds: string[]
): boolean =>
  isQualityManager(roles) ||
  (isAuditorOnly(roles) && auditorUserIds.includes(userId))

/** Can view the full activity log (system behaviour). Quality Manager only. */
export const canViewActivityLog = (roles: string[]): boolean =>
  isQualityManager(roles)

export const isAuditorOnly = (roles: string[]): boolean =>
  roles.some((r) => r === 'AUDITOR') && !isAdminOrQM(roles)

/** Normal user: STAFF, DEPARTMENT_HEAD, FOCAL_PERSON, or no reviewer role - only assigned findings, view approved docs for their dept. */
export const isNormalUser = (roles: string[]): boolean =>
  !hasReviewerRole(roles)

/** Focal person from external org: only sees Findings (assigned to them). No Audits, Admin, Documents, etc. */
export const isFocalPersonOnly = (roles: string[]): boolean =>
  roles.some((r) => r === 'FOCAL_PERSON') && !hasReviewerRole(roles)

/** User can write root cause, CAP, CAT and upload evidence only if they are assigned to the finding. */
export const canEditFindingContent = (
  userId: string | null,
  assignedToId: string | null | undefined,
  _roles: string[]
): boolean => Boolean(userId && assignedToId && userId === assignedToId)

/** User can approve/reject root cause, CAP, CAT (role-only; use canReviewFindingForAudit for audit-scoped check). */
export const canReviewFinding = (roles: string[]): boolean =>
  hasReviewerRole(roles)

/**
 * User can approve/reject CAP/CAT for a specific audit: Quality Manager always, or auditor assigned to that audit.
 * Use this in cap-review, cat-review, and extension-request APIs.
 */
export async function canReviewFindingForAudit(
  supabase: unknown,
  userId: string,
  auditId: string,
  roles: string[]
): Promise<boolean> {
  if (isAdminOrQM(roles)) return true
  if (!hasReviewerRole(roles)) return false
  const client = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (col: string, val: string) => { eq: (col2: string, val2: string) => { maybeSingle: () => Promise<{ data: unknown }> } }
      }
    }
  }
  const { data } = await client
    .from('AuditAuditor')
    .select('userId')
    .eq('auditId', auditId)
    .eq('userId', userId)
    .maybeSingle()
  return data != null
}

/** User can create findings (assign, etc.). */
export const canCreateFinding = (roles: string[]): boolean =>
  hasReviewerRole(roles)

/** User can open/edit document: not (review/draft) OR manual holder OR reviewer role. */
export const canEditDocument = (
  isReviewOrDraft: boolean,
  isManualHolder: boolean,
  roles: string[]
): boolean => !isReviewOrDraft || isManualHolder || hasReviewerRole(roles)

/** Narrow type for permission helpers; cast internally to avoid deep Supabase client instantiation. */
type SupabaseClientLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => { single: () => Promise<{ data: unknown }> }
    }
  }
}

/** Fetch current user's roles from User table (for API use). */
export async function getCurrentUserRoles(
  supabase: unknown,
  authUserId: string
): Promise<string[]> {
  const profile = await getCurrentUserProfile(supabase, authUserId)
  return profile.roles
}

/** Fetch current user's roles, departmentId, and organizationId from User table (for API use). */
export async function getCurrentUserProfile(
  supabase: unknown,
  authUserId: string
): Promise<{
  roles: string[]
  departmentId: string | null
  organizationId: string | null
  safetyOperationalArea: string | null
}> {
  const client = supabase as SupabaseClientLike
  const { data } = await client
    .from('User')
    .select('roles, role, departmentId, organizationId, safetyOperationalArea')
    .eq('id', authUserId)
    .single()
  if (!data || typeof data !== 'object') {
    return { roles: [], departmentId: null, organizationId: null, safetyOperationalArea: null }
  }
  const d = data as {
    roles?: string[]
    role?: string
    departmentId?: string | null
    organizationId?: string | null
    safetyOperationalArea?: string | null
  }
  const raw = Array.isArray(d.roles) && d.roles.length > 0 ? d.roles : d.role ? [d.role] : []
  const roles = normalizeAppUserRoles(raw.filter((x): x is string => typeof x === 'string'))
  return {
    roles,
    departmentId: d.departmentId ?? null,
    organizationId: d.organizationId ?? null,
    safetyOperationalArea: d.safetyOperationalArea ?? null,
  }
}
