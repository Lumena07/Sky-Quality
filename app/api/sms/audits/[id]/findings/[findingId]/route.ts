import { NextResponse } from 'next/server'
import { canViewSmsProtectedData } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

const CATEGORIES = new Set(['OBSERVATION', 'NON_CONFORMANCE', 'MAJOR_NON_CONFORMANCE'])
const STATUSES = new Set(['OPEN', 'CLOSED'])

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; findingId: string } }
) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsProtectedData(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing, error: exErr } = await supabase
    .from('sms_audit_findings')
    .select('*')
    .eq('id', params.findingId)
    .eq('audit_id', params.id)
    .single()
  if (exErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (typeof body.description === 'string') updates.description = body.description.trim()
  if (typeof body.category === 'string') {
    const c = body.category.toUpperCase()
    if (!CATEGORIES.has(c)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    updates.category = c
  }
  if (body.linkedSmsElement !== undefined) updates.linked_sms_element = body.linkedSmsElement
  if (body.riskLevel !== undefined) updates.risk_level = body.riskLevel
  if (body.linkedCapaId !== undefined) updates.linked_capa_id = body.linkedCapaId
  if (typeof body.status === 'string') {
    const s = body.status.toUpperCase()
    if (!STATUSES.has(s)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    updates.status = s
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sms_audit_findings')
    .update(updates)
    .eq('id', params.findingId)
    .select('*')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_audit_findings',
    recordId: params.findingId,
    oldValue: existing,
    newValue: data,
  })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; findingId: string } }
) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsProtectedData(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing, error: exErr } = await supabase
    .from('sms_audit_findings')
    .select('*')
    .eq('id', params.findingId)
    .eq('audit_id', params.id)
    .single()
  if (exErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('sms_audit_findings').delete().eq('id', params.findingId)
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'DELETE',
    module: 'sms_audit_findings',
    recordId: params.findingId,
    oldValue: existing,
  })
  return NextResponse.json({ ok: true })
}
