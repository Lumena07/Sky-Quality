import { NextResponse } from 'next/server'
import { canManageSmsHazard } from '@/lib/sms-permissions'
import type { OperationalArea } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'
import { MITIGATION_CONTROL_TYPES, MITIGATION_STATUSES } from '@/lib/sms-risk-constants'

const CONTROL_VALUES = new Set<string>(MITIGATION_CONTROL_TYPES.map((c) => c.value))
const MIT_STATUS_VALUES = new Set<string>(MITIGATION_STATUSES.map((s) => s.value))

type RouteParams = { params: Promise<{ id: string; mitigationId: string }> }

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: hazardId, mitigationId } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: hazard, error: hErr } = await supabase
    .from('sms_hazards')
    .select('operational_area')
    .eq('id', hazardId)
    .maybeSingle()
  if (hErr || !hazard) return NextResponse.json({ error: 'Hazard not found' }, { status: 404 })

  if (
    !canManageSmsHazard(profile.roles, profile.safetyOperationalArea as OperationalArea | null, hazard.operational_area as OperationalArea)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: row, error: mErr } = await supabase
    .from('sms_hazard_mitigations')
    .select('*')
    .eq('id', mitigationId)
    .eq('hazard_id', hazardId)
    .maybeSingle()
  if (mErr || !row) return NextResponse.json({ error: 'Mitigation not found' }, { status: 404 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.description !== undefined) updates.description = String(body.description).trim()
  if (body.controlType !== undefined) {
    const v = String(body.controlType).toUpperCase()
    if (!CONTROL_VALUES.has(v)) return NextResponse.json({ error: 'Invalid control type' }, { status: 400 })
    updates.control_type = v
  }
  if (body.ownerId !== undefined) updates.owner_id = body.ownerId || null
  if (body.dueDate !== undefined) {
    updates.due_date = body.dueDate != null && body.dueDate !== '' ? String(body.dueDate).slice(0, 10) : null
  }
  if (body.status !== undefined) {
    const v = String(body.status).toUpperCase()
    if (!MIT_STATUS_VALUES.has(v)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    updates.status = v
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sms_hazard_mitigations')
    .update(updates)
    .eq('id', mitigationId)
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to update mitigation' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_hazard_mitigations',
    recordId: mitigationId,
    oldValue: row,
    newValue: data,
  })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: hazardId, mitigationId } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: hazard, error: hErr } = await supabase
    .from('sms_hazards')
    .select('operational_area')
    .eq('id', hazardId)
    .maybeSingle()
  if (hErr || !hazard) return NextResponse.json({ error: 'Hazard not found' }, { status: 404 })

  if (
    !canManageSmsHazard(profile.roles, profile.safetyOperationalArea as OperationalArea | null, hazard.operational_area as OperationalArea)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: row, error: mErr } = await supabase
    .from('sms_hazard_mitigations')
    .select('*')
    .eq('id', mitigationId)
    .eq('hazard_id', hazardId)
    .maybeSingle()
  if (mErr || !row) return NextResponse.json({ error: 'Mitigation not found' }, { status: 404 })

  const { error } = await supabase.from('sms_hazard_mitigations').delete().eq('id', mitigationId)
  if (error) return NextResponse.json({ error: 'Failed to delete mitigation' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'DELETE',
    module: 'sms_hazard_mitigations',
    recordId: mitigationId,
    oldValue: row,
  })
  return NextResponse.json({ ok: true })
}
