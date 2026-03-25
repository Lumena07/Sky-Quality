import { NextResponse } from 'next/server'
import { canManageSmsSafetyWorkflow, canVerifySmsCapaEffectiveness, canViewSmsProtectedData } from '@/lib/sms-permissions'
import type { OperationalArea } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'
import { CAPA_PRIORITIES, CAPA_STATUSES, CAPA_TYPES, EFFECTIVENESS_OUTCOMES } from '@/lib/sms-workflow-constants'

const TYPE_SET = new Set<string>(CAPA_TYPES.map((t) => t.value))
const STATUS_SET = new Set<string>(CAPA_STATUSES.map((s) => s.value))
const PRIORITY_SET = new Set<string>(CAPA_PRIORITIES.map((p) => p.value))
const OUTCOME_SET = new Set<string>(EFFECTIVENESS_OUTCOMES.map((o) => o.value))

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row, error } = await supabase.from('sms_capas').select('*').eq('id', id).maybeSingle()
  if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (
    !canViewSmsProtectedData(profile.roles) &&
    row.assigned_owner_id !== user.id
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const due = String(row.target_completion_date || '')
  const st = String(row.status || '')
  const overdue = due < today && (st === 'OPEN' || st === 'IN_PROGRESS')
  return NextResponse.json({
    ...row,
    displayStatus: overdue ? 'OVERDUE' : st,
    isOverdue: overdue,
  })
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row, error: fetchErr } = await supabase.from('sms_capas').select('*').eq('id', id).maybeSingle()
  if (fetchErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const capaArea = row.operational_area as OperationalArea
  const isManager = canManageSmsSafetyWorkflow(
    profile.roles,
    profile.safetyOperationalArea as OperationalArea | null,
    capaArea
  )
  const isOwner = row.assigned_owner_id === user.id

  if (!isManager && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.description !== undefined) updates.description = String(body.description).trim()
  if (body.targetCompletionDate !== undefined) {
    updates.target_completion_date = String(body.targetCompletionDate).slice(0, 10)
  }
  if (body.completionEvidence !== undefined) updates.completion_evidence = body.completionEvidence
  if (body.completionAttachments !== undefined) updates.completion_attachments = body.completionAttachments
  if (body.assignedOwnerId !== undefined) {
    if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    updates.assigned_owner_id = body.assignedOwnerId || null
  }

  if (body.capaType !== undefined && isManager) {
    const t = String(body.capaType).toUpperCase()
    if (!TYPE_SET.has(t)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    updates.capa_type = t
  }
  if (body.priority !== undefined && isManager) {
    const p = String(body.priority).toUpperCase()
    if (!PRIORITY_SET.has(p)) return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
    updates.priority = p
  }
  if (body.status !== undefined) {
    const s = String(body.status).toUpperCase()
    if (!STATUS_SET.has(s)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    updates.status = s
  }

  if (body.effectivenessOutcome !== undefined) {
    if (!canVerifySmsCapaEffectiveness(profile.roles)) {
      return NextResponse.json({ error: 'Only DoS or Safety Officer can verify effectiveness' }, { status: 403 })
    }
    const o = String(body.effectivenessOutcome).toUpperCase()
    if (!OUTCOME_SET.has(o)) return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 })
    updates.effectiveness_outcome = o
    updates.effectiveness_verified_by = user.id
    updates.effectiveness_verified_at = new Date().toISOString()
    if (o === 'INEFFECTIVE') {
      updates.status = 'OPEN'
    } else if (o === 'EFFECTIVE' || o === 'PARTIALLY_EFFECTIVE') {
      updates.status = 'VERIFIED_EFFECTIVE'
    }
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'No valid updates' }, { status: 400 })
  }

  const { data, error } = await supabase.from('sms_capas').update(updates).eq('id', id).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Failed to update CAPA' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_capas',
    recordId: id,
    oldValue: row,
    newValue: data,
  })
  return NextResponse.json(data)
}
