/**
 * Who must complete a given ComplianceTrainingType row.
 *
 * Users with role FOCAL_PERSON are excluded from all company training and personal compliance (external stakeholders).
 *
 * Rules:
 * - mandatoryForAll → every active user matches (other audience fields ignored).
 * - Else AND across non-empty rule dimensions: departmentIds, applicableRoles, applicableRoleMetadata.
 * - applicableUserIds: if non-empty, user matches if id is listed OR (when any rule dimension is set) rules also pass;
 *   if only user ids are set (no dept/roles/metadata), match iff listed.
 * - If no mandatoryForAll and no user list and all rule dimensions empty → match everyone (legacy types).
 */

import { normalizeAppUserRoles } from '@/lib/permissions'
import { rolesFromUserRow } from '@/lib/role-metadata'
import type { UserRoleMetadata } from '@/lib/role-metadata'

export type ComplianceTrainingTypeAudience = {
  mandatoryForAll?: boolean
  applicableRoles?: unknown
  applicableUserIds?: unknown
  applicableDepartmentIds?: unknown
  applicableRoleMetadata?: unknown
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export const parseStringIdArray = (v: unknown): string[] => {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of v) {
    if (typeof x !== 'string') continue
    const s = x.trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

export const parseRoleCodes = (v: unknown): string[] => {
  const raw = parseStringIdArray(v)
  return raw.map((s) => s.toUpperCase())
}

/** External focal persons are not company staff; exclude from all training / personal compliance applicability. */
export const COMPLIANCE_EXCLUDED_AUDIENCE_ROLE_CODES = new Set<string>(['FOCAL_PERSON'])

export const stripExcludedRolesFromComplianceAudience = (codes: string[]): string[] =>
  codes.filter((c) => !COMPLIANCE_EXCLUDED_AUDIENCE_ROLE_CODES.has(c))

export const userExcludedFromCompanyTrainingCompliance = (user: {
  roles?: unknown
  role?: string | null
}): boolean =>
  normalizeAppUserRoles(rolesFromUserRow(user)).some((r) =>
    COMPLIANCE_EXCLUDED_AUDIENCE_ROLE_CODES.has(r)
  )

const userRoleSet = (user: { roles?: unknown; role?: string | null }): Set<string> =>
  new Set(normalizeAppUserRoles(rolesFromUserRow(user)))

const parseUserRoleMetadata = (v: unknown): UserRoleMetadata | null => {
  if (!isPlainObject(v)) return null
  return v as UserRoleMetadata
}

const normType = (s: string): string => s.trim().toUpperCase()

const pilotCriteriaMatches = (
  userPilot: UserRoleMetadata['PILOT'],
  crit: Record<string, unknown>
): boolean => {
  if (!userPilot) return false
  if (typeof crit.pilotSeat === 'string' && crit.pilotSeat.trim()) {
    if (userPilot.pilotSeat !== crit.pilotSeat.trim().toUpperCase()) return false
  }
  const codes = crit.aircraftTypeCodes
  if (Array.isArray(codes) && codes.length > 0) {
    const userTypes = new Set((userPilot.aircraftTypeCodes ?? []).map(normType))
    for (const c of codes) {
      if (typeof c !== 'string' || !c.trim()) return false
      if (!userTypes.has(normType(c))) return false
    }
  }
  return true
}

const dispatcherCriteriaMatches = (
  userD: UserRoleMetadata['FLIGHT_DISPATCHERS'],
  crit: Record<string, unknown>
): boolean => {
  if (!userD) return false
  const codes = crit.aircraftTypeCodes
  if (!Array.isArray(codes) || codes.length === 0) return true
  const userTypes = new Set((userD.aircraftTypeCodes ?? []).map(normType))
  for (const c of codes) {
    if (typeof c !== 'string' || !c.trim()) return false
    if (!userTypes.has(normType(c))) return false
  }
  return true
}

export const roleMetadataCriteriaMatches = (
  userMeta: UserRoleMetadata | null,
  criteria: Record<string, unknown>
): boolean => {
  const keys = Object.keys(criteria).filter((k) => isPlainObject((criteria as Record<string, unknown>)[k]))
  if (keys.length === 0) {
    return Object.keys(criteria).length === 0
  }
  const um = userMeta ?? {}
  for (const key of keys) {
    const roleKey = normType(key)
    const block = (criteria as Record<string, unknown>)[key]
    if (!isPlainObject(block)) return false
    if (roleKey === 'PILOT') {
      if (!pilotCriteriaMatches(um.PILOT, block)) return false
      continue
    }
    if (roleKey === 'FLIGHT_DISPATCHERS') {
      if (!dispatcherCriteriaMatches(um.FLIGHT_DISPATCHERS, block)) return false
      continue
    }
  }
  return true
}

/** AND across non-empty dept / roles / metadata filters. */
export const matchesAudienceRules = (
  user: { departmentId?: string | null; roles?: unknown; role?: string | null; roleMetadata?: unknown },
  type: ComplianceTrainingTypeAudience
): boolean => {
  const deptIds = parseStringIdArray(type.applicableDepartmentIds)
  if (deptIds.length > 0) {
    const uid = user.departmentId ?? null
    if (!uid || !deptIds.includes(uid)) return false
  }

  const roleCodes = parseRoleCodes(type.applicableRoles)
  if (roleCodes.length > 0) {
    const set = userRoleSet(user)
    const hit = roleCodes.some((r) => set.has(r))
    if (!hit) return false
  }

  const metaCrit = type.applicableRoleMetadata
  if (isPlainObject(metaCrit) && Object.keys(metaCrit).length > 0) {
    const userMeta = parseUserRoleMetadata(user.roleMetadata)
    const set = userRoleSet(user)
    for (const key of Object.keys(metaCrit)) {
      const roleKey = normType(key)
      if (!set.has(roleKey)) return false
    }
    if (!roleMetadataCriteriaMatches(userMeta, metaCrit)) return false
  }

  return true
}

/** Personal document kind: empty/null applicableRoles → applies to all staff; else user must have one listed role. */
export const userMatchesPersonalDocumentKind = (
  user: { roles?: unknown; role?: string | null },
  kind: { applicableRoles?: unknown }
): boolean => {
  if (userExcludedFromCompanyTrainingCompliance(user)) return false
  const roleCodes = parseRoleCodes(kind.applicableRoles)
  if (roleCodes.length === 0) return true
  const set = userRoleSet(user)
  return roleCodes.some((r) => set.has(r))
}

export const userMatchesTrainingType = (
  user: { id: string; departmentId?: string | null; roles?: unknown; role?: string | null; roleMetadata?: unknown },
  type: ComplianceTrainingTypeAudience
): boolean => {
  if (userExcludedFromCompanyTrainingCompliance(user)) return false
  if (type.mandatoryForAll === true) return true

  const userIds = parseStringIdArray(type.applicableUserIds)
  const deptIds = parseStringIdArray(type.applicableDepartmentIds)
  const roleCodes = parseRoleCodes(type.applicableRoles)
  const hasMeta =
    isPlainObject(type.applicableRoleMetadata) && Object.keys(type.applicableRoleMetadata).length > 0

  const hasRules = deptIds.length > 0 || roleCodes.length > 0 || hasMeta

  if (userIds.length > 0 && !hasRules) {
    return userIds.includes(user.id)
  }

  if (userIds.length > 0 && hasRules) {
    return userIds.includes(user.id) || matchesAudienceRules(user, type)
  }

  if (!hasRules) return true

  return matchesAudienceRules(user, type)
}

/** Normalize API body fields for insert/update (null = clear / unrestricted). */
export const sanitizeComplianceTypeAudienceFields = (body: Record<string, unknown>): {
  applicableRoles: string[] | null
  applicableUserIds: string[] | null
  applicableDepartmentIds: string[] | null
  applicableRoleMetadata: Record<string, unknown> | null
} => {
  const roles = Array.isArray(body.applicableRoles)
    ? stripExcludedRolesFromComplianceAudience(parseRoleCodes(body.applicableRoles))
    : null
  const users = Array.isArray(body.applicableUserIds)
    ? parseStringIdArray(body.applicableUserIds)
    : null
  const depts = Array.isArray(body.applicableDepartmentIds)
    ? parseStringIdArray(body.applicableDepartmentIds)
    : null
  const meta =
    isPlainObject(body.applicableRoleMetadata) && Object.keys(body.applicableRoleMetadata).length > 0
      ? (body.applicableRoleMetadata as Record<string, unknown>)
      : null
  return {
    applicableRoles: roles && roles.length > 0 ? roles : null,
    applicableUserIds: users && users.length > 0 ? users : null,
    applicableDepartmentIds: depts && depts.length > 0 ? depts : null,
    applicableRoleMetadata: meta,
  }
}
