import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canManageTrainingCompliance, getCurrentUserProfile } from '@/lib/permissions'
import { userMatchesTrainingType } from '@/lib/training-compliance-applicability'

const addMonthsIso = (fromIso: string, months: number): string => {
  const d = new Date(fromIso)
  if (Number.isNaN(d.getTime())) return fromIso
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString()
}

/** Only allow app-served upload paths (no open redirects). */
const isAllowedCompletionProofUrl = (url: string): boolean => {
  const t = url.trim()
  if (!t.startsWith('/uploads/')) return false
  if (t.includes('..')) return false
  return true
}

const normIso = (v: unknown): string | null => {
  if (v == null) return null
  if (typeof v !== 'string') return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

const normProofUrl = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null
  return v.trim()
}

/** POST: record training completion and compute next due. */
export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    if (!canManageTrainingCompliance(roles, departmentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
    const trainingTypeId = typeof body.trainingTypeId === 'string' ? body.trainingTypeId.trim() : ''
    const lastCompletedAt =
      typeof body.lastCompletedAt === 'string' && body.lastCompletedAt.trim()
        ? new Date(body.lastCompletedAt).toISOString()
        : new Date().toISOString()
    if (!userId || !trainingTypeId) {
      return NextResponse.json({ error: 'userId and trainingTypeId required' }, { status: 400 })
    }

    const { data: tt, error: ttErr } = await supabase
      .from('ComplianceTrainingType')
      .select(
        'intervalMonths, mandatoryForAll, applicableRoles, applicableUserIds, applicableDepartmentIds, applicableRoleMetadata'
      )
      .eq('id', trainingTypeId)
      .single()
    if (ttErr || !tt) {
      return NextResponse.json({ error: 'Training type not found' }, { status: 404 })
    }

    const { data: targetProfile, error: tpErr } = await supabase
      .from('User')
      .select('id, departmentId, roles, role, roleMetadata')
      .eq('id', userId)
      .maybeSingle()
    if (tpErr || !targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (!userMatchesTrainingType(targetProfile, tt)) {
      return NextResponse.json(
        { error: 'This training type does not apply to the selected user' },
        { status: 400 }
      )
    }
    const months = (tt as { intervalMonths: number }).intervalMonths
    const nextDueAt = addMonthsIso(lastCompletedAt, months)
    const now = new Date().toISOString()

    const { data: existingRow } = await supabase
      .from('ComplianceTrainingCompletion')
      .select('id, lastCompletedAt, nextDueAt, completionProofUrl')
      .eq('trainingTypeId', trainingTypeId)
      .eq('userId', userId)
      .maybeSingle()

    const existing = existingRow as {
      id?: string
      lastCompletedAt?: string | null
      nextDueAt?: string | null
      completionProofUrl?: string | null
    } | null

    const existingProof = existing?.completionProofUrl ?? null
    const rawProof = body.completionProofUrl
    let completionProofUrl: string | null = existingProof
    if (typeof rawProof === 'string' && rawProof.trim()) {
      const u = rawProof.trim()
      if (!isAllowedCompletionProofUrl(u)) {
        return NextResponse.json({ error: 'Invalid completion proof URL' }, { status: 400 })
      }
      completionProofUrl = u
    }

    const prevLast = normIso(existing?.lastCompletedAt ?? null)
    const prevNext = normIso(existing?.nextDueAt ?? null)
    const prevProof = normProofUrl(existing?.completionProofUrl ?? null)
    const nextLast = normIso(lastCompletedAt)
    const nextNext = normIso(nextDueAt)
    const nextProof = normProofUrl(completionProofUrl)

    const hadPriorData =
      prevLast != null || prevNext != null || prevProof != null
    const valuesChanged =
      prevLast !== nextLast || prevNext !== nextNext || prevProof !== nextProof

    if (existing?.id && hadPriorData && valuesChanged) {
      const { error: histErr } = await supabase.from('ComplianceTrainingCompletionHistory').insert({
        id: randomUUID(),
        userId,
        trainingTypeId,
        createdAt: now,
        createdById: user.id,
        lastCompletedAt: existing.lastCompletedAt ?? null,
        nextDueAt: existing.nextDueAt ?? null,
        completionProofUrl: existing.completionProofUrl ?? null,
      })
      if (histErr) {
        console.error('completion history insert', histErr)
        return NextResponse.json({ error: 'Failed to record completion history' }, { status: 500 })
      }
    }

    const rowId = existing?.id ?? randomUUID()

    const { data, error } = await supabase
      .from('ComplianceTrainingCompletion')
      .upsert(
        {
          id: rowId,
          trainingTypeId,
          userId,
          lastCompletedAt,
          nextDueAt,
          completionProofUrl,
          updatedAt: now,
        },
        { onConflict: 'trainingTypeId,userId' }
      )
      .select('*')
      .single()

    if (error || !data) {
      console.error('completion upsert', error)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
