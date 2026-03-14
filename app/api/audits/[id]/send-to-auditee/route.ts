import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, canEditAudit } from '@/lib/permissions'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    const { data: auditorRows } = await supabase
      .from('AuditAuditor')
      .select('userId')
      .eq('auditId', params.id)
    const auditorIds = (auditorRows ?? []).map((r: { userId: string }) => r.userId)
    const { data: auditeeRows } = await supabase
      .from('AuditAuditee')
      .select('userId')
      .eq('auditId', params.id)
    const auditeeIds = (auditeeRows ?? [])
      .map((r: { userId: string | null }) => r.userId)
      .filter(Boolean) as string[]
    if (!canEditAudit(roles, user.id, auditorIds, auditeeIds)) {
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors assigned to this audit can send checklist and schedule to auditees' },
        { status: 403 }
      )
    }

    const { data: audit, error: auditError } = await supabase
      .from('Audit')
      .select('id, title, status, checklistId, openingMeetingAt, closingMeetingAt, ScheduleItems:AuditScheduleItem(id)')
      .eq('id', params.id)
      .single()

    if (auditError || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    if (audit.status !== 'PLANNED' && audit.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Checklist and schedule can only be sent for planned or active audits' },
        { status: 400 }
      )
    }

    if (!audit.checklistId) {
      return NextResponse.json(
        { error: 'Select a checklist before sending to auditees.' },
        { status: 400 }
      )
    }

    const scheduleItems = (audit as { ScheduleItems?: { id: string }[] }).ScheduleItems ?? []
    const hasSchedule =
      !!audit.openingMeetingAt ||
      !!audit.closingMeetingAt ||
      (Array.isArray(scheduleItems) && scheduleItems.length > 0)
    if (!hasSchedule) {
      return NextResponse.json(
        { error: 'Add audit schedule details before sending to auditees.' },
        { status: 400 }
      )
    }

    const { data: auditeeRows } = await supabase
      .from('AuditAuditee')
      .select('userId, name, email')
      .eq('auditId', params.id)

    const auditees = auditeeRows ?? []
    const userIds = auditees
      .map((a: { userId: string | null }) => a.userId)
      .filter(Boolean) as string[]
    const uniqueUserIds = Array.from(new Set(userIds))

    const notifications = uniqueUserIds.map((userId) => ({
      id: randomUUID(),
      userId,
      type: 'AUDIT_REMINDER',
      title: 'Audit checklist and schedule',
      message: `Checklist and schedule for audit "${audit.title}" have been shared with you. Please review before the audit.`,
      link: `/audits/${params.id}`,
      auditId: params.id,
    }))

    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from('Notification')
        .insert(notifications)
      if (notifError) {
        console.error('Error creating send-to-auditee notifications:', notifError)
        return NextResponse.json(
          { error: 'Failed to notify some auditees' },
          { status: 500 }
        )
      }
    }

    const { error: updateError } = await supabase
      .from('Audit')
      .update({ checklistScheduleSentAt: new Date().toISOString() })
      .eq('id', params.id)
    if (updateError) {
      console.error('Error setting checklistScheduleSentAt:', updateError)
      return NextResponse.json(
        { error: 'Failed to record send-to-auditee' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      notifiedCount: notifications.length,
      message:
        notifications.length > 0
          ? `Checklist and schedule sent to ${notifications.length} auditee(s).`
          : 'No auditees with user accounts to notify. Add auditees to the audit team to send them the checklist and schedule.',
    })
  } catch (error) {
    console.error('Error in send-to-auditee:', error)
    return NextResponse.json(
      { error: 'Failed to send checklist and schedule to auditees' },
      { status: 500 }
    )
  }
}
