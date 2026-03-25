import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import {
  ACCOUNTABLE_MANAGER_ROLE,
  canSeeSmsSafetyRegister,
  getCurrentUserProfile,
  isAccountableManager,
  isDirectorOfSafety,
  isSafetyOfficer,
  SAFETY_DEPARTMENT_ID,
} from '@/lib/permissions'
import { collectPersonnelExpiryDates, computeCurrencyFromExpiries } from '@/lib/sms-pillar1'

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

type PersonnelRow = {
  id: string
  user_id: string
  post_holder_type: string
  operational_area: string | null
  appointment_letter_url: string | null
  appointment_date: string | null
  created_at?: string
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

const inferPostHolderType = (roles: string[]): string => {
  if (roles.includes('ACCOUNTABLE_MANAGER')) return 'ACCOUNTABLE_MANAGER'
  if (roles.includes('DIRECTOR_OF_SAFETY')) return 'DIRECTOR_OF_SAFETY'
  return 'SAFETY_OFFICER'
}

const amOnlyRegisterView = (roles: string[]): boolean =>
  isAccountableManager(roles) && !isDirectorOfSafety(roles) && !isSafetyOfficer(roles)

const pickPersonnelForUser = (rows: PersonnelRow[], roles: string[]): PersonnelRow | null => {
  if (rows.length === 0) return null
  const preferred = inferPostHolderType(roles)
  const match = rows.find((r) => r.post_holder_type === preferred)
  if (match) return match
  const sorted = [...rows].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })
  return sorted[0] ?? null
}

/**
 * GET: Safety department users + Accountable Managers, with sms_personnel and related rows.
 * Dev data: assign `User.departmentId` = SAFETY_DEPARTMENT_ID (`dept_safety_001`) and/or AM role
 * so the merged roster is non-empty in local environments.
 */
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

    const { roles: viewerRoles, organizationId: viewerOrgId } = await getCurrentUserProfile(
      supabase,
      user.id
    )
    if (!canSeeSmsSafetyRegister(viewerRoles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
      Department:departmentId (
        id,
        name
      )
    `

    const { data: safetyDeptUsers, error: errSafety } = await supabase
      .from('User')
      .select(selectUser)
      .eq('isActive', true)
      .eq('departmentId', SAFETY_DEPARTMENT_ID)

    const { data: amByLegacyRole, error: errAmLegacy } = await supabase
      .from('User')
      .select(selectUser)
      .eq('isActive', true)
      .eq('role', ACCOUNTABLE_MANAGER_ROLE)

    if (errSafety || errAmLegacy) {
      console.error('SMS personnel register user fetch:', errSafety, errAmLegacy)
      return NextResponse.json({ error: 'Failed to load safety register users' }, { status: 500 })
    }

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
      console.warn('SMS personnel register: roles cs filter failed; trying org scan.', errAmRolesJson)
      if (viewerOrgId?.trim()) {
        const { data: orgUsers, error: errOrg } = await supabase
          .from('User')
          .select(selectUser)
          .eq('isActive', true)
          .eq('organizationId', viewerOrgId.trim())
        if (errOrg) {
          console.error('SMS personnel register org user fetch:', errOrg)
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
    for (const row of [...(safetyDeptUsers ?? []), ...amFromRoles, ...(amByLegacyRole ?? [])]) {
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

    if (amOnlyRegisterView(viewerRoles)) {
      merged = merged.filter((u) => u.id === user.id)
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

    const { data: personnelRows, error: pErr } = await supabase
      .from('sms_personnel')
      .select('*')
      .in('user_id', userIds)

    if (pErr) {
      console.error('SMS personnel register personnel fetch:', pErr)
      return NextResponse.json({ error: 'Failed to load personnel records' }, { status: 500 })
    }

    const personnelByUser = new Map<string, PersonnelRow[]>()
    for (const row of personnelRows ?? []) {
      const pr = row as PersonnelRow
      const uid = String(pr.user_id)
      const list = personnelByUser.get(uid) ?? []
      list.push(pr)
      personnelByUser.set(uid, list)
    }

    const chosenIds: string[] = []
    const chosenByUser = new Map<string, PersonnelRow | null>()
    for (const u of merged) {
      const rows = personnelByUser.get(u.id) ?? []
      const roles = normalizeRoles(u)
      const chosen = pickPersonnelForUser(rows, roles)
      chosenByUser.set(u.id, chosen)
      if (chosen) chosenIds.push(chosen.id)
    }

    const uniquePid = Array.from(new Set(chosenIds))

    const [qualsRes, trainRes, regRes] = await Promise.all([
      uniquePid.length
        ? supabase.from('sms_qualifications').select('*').in('personnel_id', uniquePid)
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
      uniquePid.length
        ? supabase.from('sms_training_personnel').select('*').in('personnel_id', uniquePid)
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
      uniquePid.length
        ? supabase
            .from('sms_personnel_regulatory_notifications')
            .select('*')
            .in('personnel_id', uniquePid)
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    ])

    if (qualsRes.error || trainRes.error || regRes.error) {
      console.error(
        'SMS personnel register related fetch:',
        qualsRes.error,
        trainRes.error,
        regRes.error
      )
      return NextResponse.json({ error: 'Failed to load personnel details' }, { status: 500 })
    }

    const qualsByPid = new Map<string, Record<string, unknown>[]>()
    for (const q of qualsRes.data ?? []) {
      const pid = String((q as { personnel_id: string }).personnel_id)
      const list = qualsByPid.get(pid) ?? []
      list.push(q as Record<string, unknown>)
      qualsByPid.set(pid, list)
    }
    const trainByPid = new Map<string, Record<string, unknown>[]>()
    for (const t of trainRes.data ?? []) {
      const pid = String((t as { personnel_id: string }).personnel_id)
      const list = trainByPid.get(pid) ?? []
      list.push(t as Record<string, unknown>)
      trainByPid.set(pid, list)
    }
    const regByPid = new Map<string, Record<string, unknown>[]>()
    for (const r of regRes.data ?? []) {
      const pid = String((r as { personnel_id: string }).personnel_id)
      const list = regByPid.get(pid) ?? []
      list.push(r as Record<string, unknown>)
      regByPid.set(pid, list)
    }

    const users = merged.map((u) => {
      const roles = normalizeRoles(u)
      const personnel = chosenByUser.get(u.id) ?? null
      const pid = personnel?.id
      const qualifications = pid ? qualsByPid.get(pid) ?? [] : []
      const training = pid ? trainByPid.get(pid) ?? [] : []
      const regulatoryNotifications = pid ? regByPid.get(pid) ?? [] : []

      const dates = collectPersonnelExpiryDates(
        qualifications as { expiry_date?: string | null }[],
        training as { expiry_date?: string | null }[]
      )
      const _computed_currency = computeCurrencyFromExpiries(dates)

      return {
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        position: u.position,
        departmentId: u.departmentId,
        departmentName: deptName(u.Department ?? null),
        roles,
        personnel,
        qualifications,
        training,
        regulatoryNotifications,
        _computed_currency,
      }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('GET /api/sms/personnel/register:', error)
    return NextResponse.json({ error: 'Failed to load safety personnel register' }, { status: 500 })
  }
}
