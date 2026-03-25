import { NextResponse } from 'next/server'
import { isAccountableManager, isDirectorOfSafety } from '@/lib/permissions'
import { canManageSmsMoc, canProposeSmsMoc, canViewSmsMoc } from '@/lib/sms-permissions'
import type { OperationalArea } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'
import { INTRODUCES_HAZARDS, MOC_CHANGE_TYPES, MOC_STATUSES } from '@/lib/sms-workflow-constants'
import { riskIndexToLevel } from '@/lib/sms-risk-constants'

const CHANGE_SET = new Set<string>(MOC_CHANGE_TYPES.map((c) => c.value))
const STATUS_SET = new Set<string>(MOC_STATUSES.map((s) => s.value))
const INTRO_SET = new Set<string>(INTRODUCES_HAZARDS.map((x) => x.value))

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsMoc(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let { data, error } = await supabase
    .from('sms_moc')
    .select('*, sms_moc_hazard_links(hazard_id)')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) {
    const plain = await supabase.from('sms_moc').select('*').eq('id', id).maybeSingle()
    if (plain.error || !plain.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    data = plain.data
  }
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row, error: fetchErr } = await supabase.from('sms_moc').select('*').eq('id', id).maybeSingle()
  if (fetchErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const mocArea = row.operational_area as OperationalArea
  const isManager = canManageSmsMoc(profile.roles, profile.safetyOperationalArea as OperationalArea | null, mocArea)
  const isProposer = row.proposed_by === user.id && canProposeSmsMoc(profile.roles)
  const draftEditable = String(row.status) === 'DRAFT' && (isManager || isProposer)

  if (!canViewSmsMoc(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (draftEditable || isManager) {
    if (body.title !== undefined) updates.title = String(body.title).trim()
    if (body.description !== undefined) updates.description = String(body.description).trim()
    if (body.changeType !== undefined) {
      const ct = String(body.changeType).toUpperCase()
      if (!CHANGE_SET.has(ct)) return NextResponse.json({ error: 'Invalid change type' }, { status: 400 })
      updates.change_type = ct
    }
    if (body.operationalArea !== undefined && isManager) updates.operational_area = String(body.operationalArea)
    if (body.implementationDate !== undefined) {
      updates.implementation_date = body.implementationDate ? String(body.implementationDate).slice(0, 10) : null
    }
    if (body.introducesNewHazards !== undefined) {
      const v = String(body.introducesNewHazards).toUpperCase()
      if (!INTRO_SET.has(v)) return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
      updates.introduces_new_hazards = v
    }
    if (body.safetyImpactNotes !== undefined) updates.safety_impact_notes = body.safetyImpactNotes
    if (body.mitigationsProposed !== undefined) updates.mitigations_proposed = body.mitigationsProposed
    if (body.initialLikelihood !== undefined || body.initialSeverity !== undefined) {
      const l =
        body.initialLikelihood !== undefined ? Number(body.initialLikelihood) : Number(row.initial_likelihood ?? 1)
      const s =
        body.initialSeverity !== undefined ? Number(body.initialSeverity) : Number(row.initial_severity ?? 1)
      const L = Math.min(5, Math.max(1, l))
      const S = Math.min(5, Math.max(1, s))
      updates.initial_likelihood = L
      updates.initial_severity = S
      const idx = L * S
      updates.initial_risk_index = idx
      updates.initial_risk_level = riskIndexToLevel(idx)
    }
    if (body.status !== undefined && isManager) {
      const st = String(body.status).toUpperCase()
      if (!STATUS_SET.has(st)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      updates.status = st
    }
    if (body.postReviewDate !== undefined) {
      updates.post_review_date = body.postReviewDate ? String(body.postReviewDate).slice(0, 10) : null
    }
    if (body.postReviewOutcome !== undefined) updates.post_review_outcome = body.postReviewOutcome
  }

  if (isManager && body.dosReviewNotes !== undefined) {
    updates.dos_review_notes = body.dosReviewNotes
    updates.dos_reviewed_at = new Date().toISOString()
    updates.review_by_dos_id = user.id
    if (body.statusAfterReview && STATUS_SET.has(String(body.statusAfterReview).toUpperCase())) {
      updates.status = String(body.statusAfterReview).toUpperCase()
    }
  }

  if (isManager && body.approveAsDos === true && isDirectorOfSafety(profile.roles)) {
    const level = String(row.initial_risk_level || '')
    if (level !== 'ALARP' && level !== 'ACCEPTABLE') {
      return NextResponse.json({ error: 'DoS approval applies to ALARP or acceptable risk' }, { status: 400 })
    }
    updates.approved_by_id = user.id
    updates.status = body.approvalStatus === 'APPROVED_WITH_CONDITIONS' ? 'APPROVED_WITH_CONDITIONS' : 'APPROVED'
    if (body.approvalConditions) updates.approval_conditions = String(body.approvalConditions)
  }

  if (body.amApprovalSignature && isAccountableManager(profile.roles)) {
    const level = String(row.initial_risk_level || '')
    if (level !== 'UNACCEPTABLE') {
      return NextResponse.json({ error: 'Accountable Manager approval only for unacceptable risk' }, { status: 400 })
    }
    updates.am_approval_signature = String(body.amApprovalSignature)
    updates.am_approved_at = new Date().toISOString()
    updates.approved_by_id = user.id
    updates.status = 'APPROVED'
  }

  if (isManager && body.rejectionReason !== undefined) {
    updates.rejection_reason = body.rejectionReason
    updates.status = 'REJECTED'
  }

  const onlyHazards = isManager && Array.isArray(body.hazardIds) && Object.keys(updates).length <= 1
  if (Object.keys(updates).length <= 1 && !onlyHazards) {
    return NextResponse.json({ error: 'No valid updates' }, { status: 400 })
  }

  let data = row
  if (Object.keys(updates).length > 1) {
    const res = await supabase.from('sms_moc').update(updates).eq('id', id).select('*').single()
    if (res.error || !res.data) return NextResponse.json({ error: 'Failed to update MoC' }, { status: 500 })
    data = res.data
  }

  if (isManager && Array.isArray(body.hazardIds)) {
    await supabase.from('sms_moc_hazard_links').delete().eq('moc_id', id)
    const hazardIds = body.hazardIds.map(String)
    if (hazardIds.length > 0) {
      await supabase.from('sms_moc_hazard_links').insert(hazardIds.map((hazard_id: string) => ({ moc_id: id, hazard_id })))
    }
  }

  if (Object.keys(updates).length > 1 || (isManager && Array.isArray(body.hazardIds))) {
    await createSmsAuditLog({
      userId: user.id,
      actionType: 'UPDATE',
      module: 'sms_moc',
      recordId: id,
      oldValue: row,
      newValue: data,
    })
  }
  return NextResponse.json(data)
}
