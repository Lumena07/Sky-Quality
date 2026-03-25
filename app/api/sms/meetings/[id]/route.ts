import { NextResponse } from 'next/server'
import { isAccountableManager } from '@/lib/permissions'
import { canReadSmsDashboard, canViewSmsProtectedData } from '@/lib/sms-permissions'

const canEditMeeting = (roles: string[]) =>
  canViewSmsProtectedData(roles) || isAccountableManager(roles)
import { createSmsAuditLog, getSmsAuthContext, notifyMeetingMinutesPublished } from '@/lib/sms'

const MEETING_TYPES = new Set(['SRB', 'SAG', 'SAFETY_COMMITTEE'])

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReadSmsDashboard(profile.roles) && !canViewSmsProtectedData(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: meeting, error: mErr } = await supabase.from('sms_meetings').select('*').eq('id', params.id).single()
  if (mErr || !meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: actions, error: aErr } = await supabase
    .from('sms_meeting_actions')
    .select('*')
    .eq('meeting_id', params.id)
    .order('due_date', { ascending: true })

  if (aErr) return NextResponse.json({ error: 'Failed to load actions' }, { status: 500 })
  return NextResponse.json({ meeting, actions: actions ?? [] })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditMeeting(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing, error: exErr } = await supabase.from('sms_meetings').select('*').eq('id', params.id).single()
  if (exErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (typeof body.title === 'string') updates.title = body.title.trim()
  if (typeof body.meetingType === 'string') {
    const mt = body.meetingType.toUpperCase()
    if (!MEETING_TYPES.has(mt)) return NextResponse.json({ error: 'Invalid meeting type' }, { status: 400 })
    updates.meeting_type = mt
  }
  if (body.chairedById !== undefined) updates.chaired_by_id = body.chairedById
  if (body.scheduledAt !== undefined) updates.scheduled_at = body.scheduledAt
  if (body.actualHeldAt !== undefined) updates.actual_held_at = body.actualHeldAt
  if (body.minutes !== undefined) updates.minutes = body.minutes
  if (body.minutesHtml !== undefined) updates.minutes_html = body.minutesHtml
  if (body.decisions !== undefined) updates.decisions = body.decisions
  if (body.status !== undefined) updates.status = body.status
  if (Array.isArray(body.attendeeUserIds)) updates.attendee_user_ids = body.attendeeUserIds.map(String)
  if (Array.isArray(body.agendaItems)) updates.agenda_items = body.agendaItems

  let shouldNotifyMinutes = false
  if (body.publishMinutes === true) {
    const html = (updates.minutes_html as string | undefined) ?? (existing as { minutes_html?: string }).minutes_html
    const plain =
      (updates.minutes as string | undefined) ?? (existing as { minutes?: string }).minutes
    const hasContent = Boolean((html && html.trim()) || (plain && plain.trim()))
    if (!hasContent) {
      return NextResponse.json({ error: 'Add minutes before publishing' }, { status: 400 })
    }
    if (!(existing as { minutes_published_at?: string | null }).minutes_published_at) {
      updates.minutes_published_at = new Date().toISOString()
      shouldNotifyMinutes = true
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates' }, { status: 400 })
  }

  const { data, error } = await supabase.from('sms_meetings').update(updates).eq('id', params.id).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 })

  if (shouldNotifyMinutes) {
    const attendees = (data as { attendee_user_ids?: string[] }).attendee_user_ids ?? []
    await notifyMeetingMinutesPublished(supabase, {
      attendeeUserIds: attendees,
      meetingTitle: String((data as { title?: string }).title ?? 'Meeting'),
      meetingId: params.id,
      meetingNumber: String((data as { meeting_number?: string }).meeting_number ?? ''),
    })
  }

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_meetings',
    recordId: params.id,
    oldValue: existing,
    newValue: data,
  })
  return NextResponse.json(data)
}
