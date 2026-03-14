/** Roles that can review findings (root cause, CAP, CAT) and have full access to findings/documents. */
export const REVIEWER_ROLES = new Set(['QUALITY_MANAGER', 'AUDITOR'])

/** Only these roles see Admin and have full permissions (Quality Manager). */
export const ADMIN_OR_QM = new Set(['QUALITY_MANAGER'])

/** Accountable Manager: sees AM dashboard and escalations; oversight role per ICAO / internal manual. */
export const ACCOUNTABLE_MANAGER_ROLE = 'ACCOUNTABLE_MANAGER'

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

/** Quality department ID; users in this dept or AM can see the Training tab. */
export const QUALITY_DEPARTMENT_ID = 'dept_quality_001'

/** Can see Training tab and access training APIs: Quality department or Accountable Manager. */
export const canSeeTraining = (
  roles: string[],
  departmentId: string | null
): boolean =>
  departmentId === QUALITY_DEPARTMENT_ID || isAccountableManager(roles)

/** Can add, update, or delete training/qualification records: Quality Manager or Auditor only. */
export const canAddTraining = (roles: string[]): boolean =>
  hasReviewerRole(roles)

/** Can schedule (create) a new audit: Quality Manager or Auditor only. Accountable Manager cannot schedule audits. */
export const canScheduleAudit = (roles: string[]): boolean =>
  isQualityManager(roles) || isAuditorOnly(roles)

/** Can view the Audit Plan tab and list: Quality Manager, Auditor, or Accountable Manager. */
export const canViewAuditPlan = (roles: string[]): boolean =>
  isQualityManager(roles) || isAuditorOnly(roles) || isAccountableManager(roles)

/** Can add, edit, or delete audit plans: Quality Manager only. Auditors and AM have view-only. */
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

/** Fetch current user's roles and departmentId from User table (for API use). */
export async function getCurrentUserProfile(
  supabase: unknown,
  authUserId: string
): Promise<{ roles: string[]; departmentId: string | null }> {
  const client = supabase as SupabaseClientLike
  const { data } = await client
    .from('User')
    .select('roles, role, departmentId')
    .eq('id', authUserId)
    .single()
  if (!data || typeof data !== 'object') {
    return { roles: [], departmentId: null }
  }
  const d = data as { roles?: string[]; role?: string; departmentId?: string | null }
  const roles = Array.isArray(d.roles) && d.roles.length > 0 ? d.roles : d.role ? [d.role] : []
  return { roles, departmentId: d.departmentId ?? null }
}
