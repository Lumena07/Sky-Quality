import { NextResponse } from 'next/server'
import { isAccountableManager } from '@/lib/permissions'
import { canViewSmsProtectedData } from '@/lib/sms-permissions'

const canEditMeeting = (roles: string[]) =>
  canViewSmsProtectedData(roles) || isAccountableManager(roles)
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; actionId: string } }
) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditMeeting(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing, error: exErr } = await supabase
    .from('sms_meeting_actions')
    .select('*')
    .eq('id', params.actionId)
    .eq('meeting_id', params.id)
    .single()
  if (exErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (typeof body.description === 'string') updates.description = body.description.trim()
  if (body.ownerId !== undefined) updates.owner_id = body.ownerId
  if (body.dueDate !== undefined) updates.due_date = body.dueDate
  if (typeof body.status === 'string') updates.status = body.status.toUpperCase()

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No updates' }, { status: 400 })

  const { data, error } = await supabase
    .from('sms_meeting_actions')
    .update(updates)
    .eq('id', params.actionId)
    .select('*')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_meeting_actions',
    recordId: params.actionId,
    oldValue: existing,
    newValue: data,
  })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; actionId: string } }
) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditMeeting(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing, error: exErr } = await supabase
    .from('sms_meeting_actions')
    .select('*')
    .eq('id', params.actionId)
    .eq('meeting_id', params.id)
    .single()
  if (exErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('sms_meeting_actions').delete().eq('id', params.actionId)
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'DELETE',
    module: 'sms_meeting_actions',
    recordId: params.actionId,
    oldValue: existing,
  })
  return NextResponse.json({ ok: true })
}
