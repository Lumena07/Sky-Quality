import { NextResponse } from 'next/server'
import { canManageSmsInvestigation } from '@/lib/sms-permissions'
import type { OperationalArea } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

type RouteParams = { params: Promise<{ id: string; recId: string }> }

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: investigationId, recId } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row } = await supabase.from('sms_investigations').select('*').eq('id', investigationId).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (
    !canManageSmsInvestigation(
      profile.roles,
      profile.safetyOperationalArea as OperationalArea | null,
      row.operational_area as OperationalArea
    )
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: rec, error: rErr } = await supabase
    .from('sms_investigation_recommendations')
    .select('*')
    .eq('id', recId)
    .eq('investigation_id', investigationId)
    .maybeSingle()
  if (rErr || !rec) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.description !== undefined) updates.description = String(body.description).trim()
  if (body.sortOrder !== undefined) updates.sort_order = Number(body.sortOrder)
  if (body.capaId !== undefined) updates.capa_id = body.capaId || null

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sms_investigation_recommendations')
    .update(updates)
    .eq('id', recId)
    .select('*')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_investigation_recommendations',
    recordId: recId,
    oldValue: rec,
    newValue: data,
  })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: investigationId, recId } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row } = await supabase.from('sms_investigations').select('*').eq('id', investigationId).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (
    !canManageSmsInvestigation(
      profile.roles,
      profile.safetyOperationalArea as OperationalArea | null,
      row.operational_area as OperationalArea
    )
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: rec } = await supabase
    .from('sms_investigation_recommendations')
    .select('*')
    .eq('id', recId)
    .eq('investigation_id', investigationId)
    .maybeSingle()
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('sms_investigation_recommendations').delete().eq('id', recId)
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  await createSmsAuditLog({
    userId: user.id,
    actionType: 'DELETE',
    module: 'sms_investigation_recommendations',
    recordId: recId,
    oldValue: rec,
  })
  return NextResponse.json({ ok: true })
}
