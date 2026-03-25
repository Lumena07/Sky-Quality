import { NextResponse } from 'next/server'
import { isAccountableManager } from '@/lib/permissions'
import { canViewSmsProtectedData } from '@/lib/sms-permissions'

const canEditMeeting = (roles: string[]) =>
  canViewSmsProtectedData(roles) || isAccountableManager(roles)
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditMeeting(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: meeting, error: mErr } = await supabase.from('sms_meetings').select('id').eq('id', params.id).single()
  if (mErr || !meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

  const body = await request.json()
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const { data, error } = await supabase
    .from('sms_meeting_actions')
    .insert({
      meeting_id: params.id,
      description,
      owner_id: body.ownerId ?? null,
      due_date: body.dueDate ?? null,
      status: body.status || 'OPEN',
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to create action' }, { status: 500 })
  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_meeting_actions',
    recordId: String(data.id),
    newValue: data,
  })
  return NextResponse.json(data, { status: 201 })
}
