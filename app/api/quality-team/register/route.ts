import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import {
  ACCOUNTABLE_MANAGER_ROLE,
  canSeeQualityTeamRegister,
  getCurrentUserProfile,
  QUALITY_DEPARTMENT_ID,
} from '@/lib/permissions'
import { computeAuditorRequalification } from '@/lib/auditor-requalification'

type DepartmentRef = { id: string; name: string } | { id: string; name: string }[] | null

type UserRow = {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  position: string | null
  departmentId: string | null
  organizationId?: string | null
  roles?: string[] | null
  role?: string | null
  Department?: DepartmentRef
}

type TrainingRow = {
  id: string
  userId: string
  name: string
  recordType: string
  completedAt: string | null
  expiryDate: string | null
  documentUrl: string | null
}

const normalizeRoles = (u: UserRow): string[] => {
  if (Array.isArray(u.roles) && u.roles.length > 0) return u.roles
  if (u.role) return [u.role]
  return []
}

const deptName = (d: DepartmentRef): string | null => {
  if (!d) return null
  if (Array.isArray(d)) return d[0]?.name ?? null
  return d.name ?? null
}

/** GET: Quality dept members (any role) + Accountable Managers; each with training/qualification records. */
export async function GET() {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roles, organizationId: viewerOrgId } = await getCurrentUserProfile(supabase, user.id)
    if (!canSeeQualityTeamRegister(roles)) {
      return NextResponse.json(
        { error: 'You do not have permission to view the quality team register.' },
        { status: 403 }
      )
    }

    const selectUser = `
      id,
      email,
      firstName,
      lastName,
      position,
      departmentId,
      organizationId,
      roles,
      role,
      auditorRequalificationCompletedAt,
      auditorRequalificationCourseNotes,
      Department:departmentId (
        id,
        name
      )
    `

    const { data: qualityDeptUsers, error: errQuality } = await supabase
      .from('User')
      .select(selectUser)
      .eq('isActive', true)
      .eq('departmentId', QUALITY_DEPARTMENT_ID)

    const { data: amByLegacyRole, error: errAmLegacy } = await supabase
      .from('User')
      .select(selectUser)
      .eq('isActive', true)
      .eq('role', ACCOUNTABLE_MANAGER_ROLE)

    if (errQuality || errAmLegacy) {
      console.error('Quality team register user fetch:', errQuality, errAmLegacy)
      return NextResponse.json(
        { error: 'Failed to load quality team register' },
        { status: 500 }
      )
    }

    /**
     * Why not `.contains('roles', ['ACCOUNTABLE_MANAGER'])`?
     * PostgREST may send a value Postgres rejects as JSON (error 22P02 / invalid token).
     * `roles` is often jsonb; `cs` must receive a valid JSON *document*, e.g. `["ACCOUNTABLE_MANAGER"]`.
     */
    const amRolesJson = JSON.stringify([ACCOUNTABLE_MANAGER_ROLE])
    const { data: amByRolesJson, error: errAmRolesJson } = await supabase
      .from('User')
      .select(selectUser)
      .eq('isActive', true)
      .filter('roles', 'cs', amRolesJson)

    const amFromRoles: UserRow[] = []
    if (!errAmRolesJson && amByRolesJson?.length) {
      amFromRoles.push(...(amByRolesJson as UserRow[]))
    } else if (errAmRolesJson) {
      console.warn(
        'Quality team register: roles @> JSON filter failed; trying org scan if available.',
        errAmRolesJson
      )
      if (viewerOrgId?.trim()) {
        const { data: orgUsers, error: errOrg } = await supabase
          .from('User')
          .select(selectUser)
          .eq('isActive', true)
          .eq('organizationId', viewerOrgId.trim())
        if (errOrg) {
          console.error('Quality team register org user fetch:', errOrg)
        } else {
          for (const row of orgUsers ?? []) {
            const u = row as UserRow
            if (normalizeRoles(u).includes(ACCOUNTABLE_MANAGER_ROLE)) {
              amFromRoles.push(u)
            }
          }
        }
      }
    }

    const byId = new Map<string, UserRow>()
    for (const row of [
      ...(qualityDeptUsers ?? []),
      ...amFromRoles,
      ...(amByLegacyRole ?? []),
    ]) {
      const u = row as UserRow
      if (!u?.id) continue
      byId.set(u.id, u)
    }

    let merged = Array.from(byId.values())

    if (viewerOrgId && viewerOrgId.trim()) {
      merged = merged.filter((u) => {
        const oid = u.organizationId
        if (oid == null || oid === '') return true
        return oid === viewerOrgId
      })
    }

    merged.sort((a, b) => {
      const ln = (a.lastName ?? '').localeCompare(b.lastName ?? '', undefined, {
        sensitivity: 'base',
      })
      if (ln !== 0) return ln
      return (a.firstName ?? '').localeCompare(b.firstName ?? '', undefined, {
        sensitivity: 'base',
      })
    })

    const userIds = merged.map((u) => u.id)
    if (userIds.length === 0) {
      return NextResponse.json({ users: [] })
    }

    const { data: audits, error: audErr } = await supabase
      .from('Audit')
      .select(
        `
        endDate,
        scheduledDate,
        status,
        AuditAuditor ( userId )
      `
      )
      .in('status', ['COMPLETED', 'CLOSED'])
    if (audErr) {
      console.warn('Quality team register: audit fetch for requalification', audErr)
    }
    const lastAuditByUser = new Map<string, string>()
    for (const a of audits ?? []) {
      const row = a as {
        endDate?: string | null
        scheduledDate?: string | null
        AuditAuditor?: { userId?: string }[] | { userId?: string } | null
      }
      const dateStr = row.endDate ?? row.scheduledDate
      if (!dateStr) continue
      const raw = row.AuditAuditor
      const links = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : []
      for (const link of links) {
        const uid = link?.userId
        if (!uid) continue
        const prev = lastAuditByUser.get(uid)
        if (!prev || dateStr > prev) lastAuditByUser.set(uid, dateStr)
      }
    }

    const { data: trainingRows, error: trErr } = await supabase
      .from('TrainingRecord')
      .select('id, userId, name, recordType, completedAt, expiryDate, documentUrl')
      .in('userId', userIds)
      .order('expiryDate', { ascending: true, nullsFirst: false })

    if (trErr) {
      console.error('Quality team register training fetch:', trErr)
      return NextResponse.json(
        { error: 'Failed to load training records' },
        { status: 500 }
      )
    }

    const trainingByUser = new Map<string, TrainingRow[]>()
    for (const row of trainingRows ?? []) {
      const tr = row as TrainingRow
      const list = trainingByUser.get(tr.userId) ?? []
      list.push(tr)
      trainingByUser.set(tr.userId, list)
    }

    const users = merged.map((u) => {
      const roles = normalizeRoles(u)
      const lastAudit = lastAuditByUser.get(u.id) ?? null
      const uWithRequal = u as UserRow & {
        auditorRequalificationCompletedAt?: string | null
        auditorRequalificationCourseNotes?: string | null
      }
      const requal = computeAuditorRequalification({
        userRoles: roles,
        lastAuditConductedAt: lastAudit,
        auditorRequalificationCompletedAt: uWithRequal.auditorRequalificationCompletedAt ?? null,
      })
      return {
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        position: u.position,
        departmentId: u.departmentId,
        departmentName: deptName(u.Department ?? null),
        roles,
        trainingRecords: trainingByUser.get(u.id) ?? [],
        lastAuditConductedAt: requal.lastAuditConductedAt,
        requalificationRequired: requal.requalificationRequired,
        requalificationCourseCompletedAt: requal.requalificationCourseCompletedAt,
      }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('GET /api/quality-team/register:', error)
    return NextResponse.json(
      { error: 'Failed to load quality team register' },
      { status: 500 }
    )
  }
}
