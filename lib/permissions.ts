/** Roles that can review findings (root cause, CAP, CAT) and have full access to findings/documents. */
export const REVIEWER_ROLES = new Set([
  'SYSTEM_ADMIN',
  'QUALITY_MANAGER',
  'AUDITOR',
])

/** Only these roles see Admin and have full permissions. */
export const ADMIN_OR_QM = new Set(['SYSTEM_ADMIN', 'QUALITY_MANAGER'])

export const hasReviewerRole = (roles: string[]): boolean =>
  roles.some((r) => REVIEWER_ROLES.has(r))

export const isAdminOrQM = (roles: string[]): boolean =>
  roles.some((r) => ADMIN_OR_QM.has(r))

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

/** User can approve/reject root cause, CAP, CAT. */
export const canReviewFinding = (roles: string[]): boolean =>
  hasReviewerRole(roles)

/** User can create findings (assign, etc.). */
export const canCreateFinding = (roles: string[]): boolean =>
  hasReviewerRole(roles)

/** User can open/edit document: not (review/draft) OR manual holder OR reviewer role. */
export const canEditDocument = (
  isReviewOrDraft: boolean,
  isManualHolder: boolean,
  roles: string[]
): boolean => !isReviewOrDraft || isManualHolder || hasReviewerRole(roles)

type SupabaseClientLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => { single: () => Promise<{ data: unknown }> }
    }
  }
}

/** Fetch current user's roles from User table (for API use). */
export async function getCurrentUserRoles(
  supabase: SupabaseClientLike,
  authUserId: string
): Promise<string[]> {
  const profile = await getCurrentUserProfile(supabase, authUserId)
  return profile.roles
}

/** Fetch current user's roles and departmentId from User table (for API use). */
export async function getCurrentUserProfile(
  supabase: SupabaseClientLike,
  authUserId: string
): Promise<{ roles: string[]; departmentId: string | null }> {
  const { data } = await supabase
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
