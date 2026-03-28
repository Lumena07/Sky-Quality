import type { SupabaseClient } from '@supabase/supabase-js'

/** Fixed codes allowed on DepartmentRoleCatalog rows (admin UI + /api/admin/department-roles). */
export const DEPARTMENT_CATALOG_ROLE_CODES = [
  'QUALITY_MANAGER',
  'ACCOUNTABLE_MANAGER',
  'AUDITOR',
  'STAFF',
  'DIRECTOR_OF_SAFETY',
  'SAFETY_OFFICER',
  'DEPARTMENT_HEAD',
  'PILOT',
  'CABIN_CREW',
  'FLIGHT_DISPATCHERS',
] as const

export type DepartmentCatalogRoleCode = (typeof DEPARTMENT_CATALOG_ROLE_CODES)[number]

export const DEPARTMENT_CATALOG_ROLE_OPTIONS: ReadonlyArray<{
  value: DepartmentCatalogRoleCode
  label: string
}> = [
  { value: 'QUALITY_MANAGER', label: 'Quality Manager' },
  { value: 'ACCOUNTABLE_MANAGER', label: 'Accountable Manager' },
  { value: 'AUDITOR', label: 'Auditor' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'DIRECTOR_OF_SAFETY', label: 'Director of Safety' },
  { value: 'SAFETY_OFFICER', label: 'Safety Officer' },
  { value: 'DEPARTMENT_HEAD', label: 'Department Head' },
  { value: 'PILOT', label: 'Pilot' },
  { value: 'CABIN_CREW', label: 'Cabin Crew' },
  { value: 'FLIGHT_DISPATCHERS', label: 'Flight Dispatchers' },
]

const CATALOG_CODE_SET = new Set<string>(DEPARTMENT_CATALOG_ROLE_CODES)

/** Assignable on users but not creatable via department role catalog. */
export const USER_PLATFORM_ROLE_CODES = ['FOCAL_PERSON', 'SYSTEM_ADMIN'] as const

export const normalizeRoleCode = (s: string): string => s.trim().toUpperCase()

export const isDepartmentCatalogRoleCode = (s: string): boolean => CATALOG_CODE_SET.has(normalizeRoleCode(s))

/** Matches DB backfill in 20260328210000_department_role_catalog_role_code.sql */
export const resolveDepartmentCatalogRoleCode = (
  roleCode: string | null | undefined,
  description: string | null | undefined
): string => {
  const trimmed = typeof roleCode === 'string' ? roleCode.trim() : ''
  if (trimmed) return normalizeRoleCode(trimmed)
  const d = typeof description === 'string' ? description : ''
  const idx = d.indexOf(' —')
  if (idx > 0) return normalizeRoleCode(d.slice(0, idx))
  return ''
}

export type RoleAssignmentOption = {
  id: string
  name: string
  roleCode: string
  departmentId: string
  departmentName: string
}

const deptName = (row: { Department?: { name?: string } | { name?: string }[] }): string => {
  const d = row.Department
  if (!d) return '—'
  const x = Array.isArray(d) ? d[0] : d
  return x?.name ?? '—'
}

/** Distinct active permission codes defined in the catalog (for validation). */
export const fetchActiveCatalogRoleCodes = async (supabase: SupabaseClient): Promise<string[]> => {
  const { data, error } = await supabase
    .from('DepartmentRoleCatalog')
    .select('roleCode, description')
    .eq('isActive', true)
  if (error || !data) return []
  const set = new Set<string>()
  for (const row of data as Array<{ roleCode?: string | null; description?: string | null }>) {
    const c = resolveDepartmentCatalogRoleCode(row.roleCode, row.description)
    if (c && isDepartmentCatalogRoleCode(c)) set.add(c)
  }
  return Array.from(set).sort()
}

/** Rows for Admin user add/edit UI (multiple selections allowed; stored values are roleCode strings). */
export const fetchRoleAssignmentOptions = async (
  supabase: SupabaseClient
): Promise<RoleAssignmentOption[]> => {
  const { data, error } = await supabase
    .from('DepartmentRoleCatalog')
    .select(
      `
      id,
      name,
      roleCode,
      description,
      departmentId,
      Department:departmentId ( name )
    `
    )
    .eq('isActive', true)
    .order('departmentId', { ascending: true })
    .order('name', { ascending: true })
  if (error || !data) return []
  const out: RoleAssignmentOption[] = []
  for (const row of data as Array<{
    id: string
    name: string
    roleCode?: string | null
    description?: string | null
    departmentId: string
    Department?: { name?: string } | { name?: string }[]
  }>) {
    const code = resolveDepartmentCatalogRoleCode(row.roleCode, row.description)
    if (!code || !isDepartmentCatalogRoleCode(code)) continue
    out.push({
      id: row.id,
      name: row.name,
      roleCode: code,
      departmentId: row.departmentId,
      departmentName: deptName(row),
    })
  }
  return out
}
