import { randomUUID } from 'crypto'
import type { createSupabaseServerClient } from '@/lib/supabaseServer'
import { userMatchesTrainingType } from '@/lib/training-compliance-applicability'

type ServerClient = ReturnType<typeof createSupabaseServerClient>

type TrainingTypeRow = {
  id: string
  mandatoryForAll?: boolean
  applicableRoles?: unknown
  applicableUserIds?: unknown
  applicableDepartmentIds?: unknown
  applicableRoleMetadata?: unknown
}

type UserRow = {
  id: string
  departmentId?: string | null
  roles?: unknown
  role?: string | null
  roleMetadata?: unknown
}

/**
 * Ensures a ComplianceTrainingCompletion row exists for each applicable active user × training type.
 */
export const ensureComplianceTrainingCompletionRows = async (
  supabase: ServerClient
): Promise<number> => {
  const { data: types, error: typesErr } = await supabase
    .from('ComplianceTrainingType')
    .select(
      'id, mandatoryForAll, applicableRoles, applicableUserIds, applicableDepartmentIds, applicableRoleMetadata'
    )
  if (typesErr) {
    console.error('ensureComplianceTrainingCompletionRows types', typesErr)
    return 0
  }
  const typeRows = (types ?? []) as TrainingTypeRow[]
  if (typeRows.length === 0) return 0

  const { data: users, error: usersErr } = await supabase
    .from('User')
    .select('id, departmentId, roles, role, roleMetadata')
    .eq('isActive', true)
  if (usersErr) {
    console.error('ensureComplianceTrainingCompletionRows users', usersErr)
    return 0
  }
  const userRows = (users ?? []) as UserRow[]
  if (userRows.length === 0) return 0

  const { data: existing, error: exErr } = await supabase
    .from('ComplianceTrainingCompletion')
    .select('trainingTypeId, userId')
  if (exErr) {
    console.error('ensureComplianceTrainingCompletionRows existing', exErr)
    return 0
  }
  const have = new Set(
    (existing ?? []).map((e: { trainingTypeId: string; userId: string }) => `${e.trainingTypeId}:${e.userId}`)
  )

  const now = new Date().toISOString()
  const rows: Record<string, unknown>[] = []

  for (const tt of typeRows) {
    for (const u of userRows) {
      if (!userMatchesTrainingType(u, tt)) continue
      const k = `${tt.id}:${u.id}`
      if (have.has(k)) continue
      rows.push({
        id: randomUUID(),
        trainingTypeId: tt.id,
        userId: u.id,
        lastCompletedAt: null,
        nextDueAt: null,
        updatedAt: now,
      })
      have.add(k)
    }
  }

  if (rows.length === 0) return 0

  const { error: insErr } = await supabase.from('ComplianceTrainingCompletion').insert(rows)
  if (insErr) {
    console.error('ensureComplianceTrainingCompletionRows insert', insErr)
    return 0
  }
  return rows.length
}

/** @deprecated Use ensureComplianceTrainingCompletionRows (same behavior for mandatory types; now covers all audience rules). */
export const ensureMandatoryComplianceCompletions = ensureComplianceTrainingCompletionRows
