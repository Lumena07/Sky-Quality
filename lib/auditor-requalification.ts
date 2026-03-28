/** Months without a completed/closed audit before requalification is required. */
export const REQUALIFICATION_AUDIT_WINDOW_MONTHS = 12

/** After completing requalification course, treat as current for this many months. */
export const REQUALIFICATION_COURSE_VALID_MONTHS = 12

export type RequalificationComputed = {
  lastAuditConductedAt: string | null
  requalificationRequired: boolean
  requalificationCourseCompletedAt: string | null
}

const addMonths = (d: Date, months: number): Date => {
  const x = new Date(d.getTime())
  x.setMonth(x.getMonth() + months)
  return x
}

export const computeAuditorRequalification = (params: {
  userRoles: string[]
  lastAuditConductedAt: string | null
  auditorRequalificationCompletedAt: string | null
  now?: Date
}): RequalificationComputed => {
  const now = params.now ?? new Date()
  const roles = params.userRoles ?? []
  const isAuditor = roles.includes('AUDITOR')
  const lastAudit = params.lastAuditConductedAt
  const requalDone = params.auditorRequalificationCompletedAt

  if (!isAuditor) {
    return {
      lastAuditConductedAt: lastAudit,
      requalificationRequired: false,
      requalificationCourseCompletedAt: requalDone,
    }
  }

  const auditOk =
    lastAudit != null &&
    !Number.isNaN(new Date(lastAudit).getTime()) &&
    addMonths(new Date(lastAudit), REQUALIFICATION_AUDIT_WINDOW_MONTHS) >= now

  const requalOk =
    requalDone != null &&
    !Number.isNaN(new Date(requalDone).getTime()) &&
    addMonths(new Date(requalDone), REQUALIFICATION_COURSE_VALID_MONTHS) >= now

  const requalificationRequired = !auditOk && !requalOk

  return {
    lastAuditConductedAt: lastAudit,
    requalificationRequired,
    requalificationCourseCompletedAt: requalDone,
  }
}
