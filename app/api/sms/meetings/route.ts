import { NextResponse } from 'next/server'
import { isAccountableManager } from '@/lib/permissions'
import { canReadSmsDashboard, canViewSmsProtectedData } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext, nextSmsIdentifier } from '@/lib/sms'

export async function GET() {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReadSmsDashboard(profile.roles) && !canViewSmsProtectedData(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { data, error } = await supabase.from('sms_meetings').select('*').order('scheduled_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsProtectedData(profile.roles) && !isAccountableManager(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const mt = typeof body.meetingType === 'string' ? body.meetingType.toUpperCase() : ''
  if (!['SRB', 'SAG', 'SAFETY_COMMITTEE'].includes(mt)) {
    return NextResponse.json({ error: 'meetingType must be SRB, SAG, or SAFETY_COMMITTEE' }, { status: 400 })
  }
  const number = await nextSmsIdentifier('sms_meeting', 'SMS-MTG')
  const attendees = Array.isArray(body.attendeeUserIds) ? body.attendeeUserIds.map(String) : []
  const agenda = Array.isArray(body.agendaItems) ? body.agendaItems : []
  const { data, error } = await supabase
    .from('sms_meetings')
    .insert({
      meeting_number: number,
      meeting_type: mt,
      title: body.title,
      chaired_by_id: body.chairedById || user.id,
      scheduled_at: body.scheduledAt,
      minutes: body.minutes || null,
      minutes_html: body.minutesHtml ?? null,
      attendee_user_ids: attendees,
      agenda_items: agenda,
      decisions: body.decisions ?? null,
      actual_held_at: body.actualHeldAt || null,
      status: body.status || 'PLANNED',
    })
    .select('*')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  await createSmsAuditLog({ userId: user.id, actionType: 'CREATE', module: 'sms_meetings', recordId: String(data.id), newValue: data })
  return NextResponse.json(data, { status: 201 })
}
