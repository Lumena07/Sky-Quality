import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile } from '@/lib/permissions'

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
    const auditorIds = await (async () => {
      const { data } = await supabase
        .from('AuditAuditor')
        .select('userId')
        .eq('auditId', params.id)
      return (data ?? []).map((r: { userId: string }) => r.userId)
    })()
    const canSend =
      roles.some((r) => r === 'SYSTEM_ADMIN' || r === 'QUALITY_MANAGER') ||
      auditorIds.includes(user.id)

    if (!canSend) {
      return NextResponse.json(
        { error: 'Only auditors or QM/Admin can send checklist and schedule to auditees' },
        { status: 403 }
      )
    }

    const { data: audit, error: auditError } = await supabase
      .from('Audit')
      .select('id, title, status')
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

    const { data: auditeeRows } = await supabase
      .from('AuditAuditee')
      .select('userId, name, email')
      .eq('auditId', params.id)

    const auditees = auditeeRows ?? []
    const userIds = auditees
      .map((a: { userId: string | null }) => a.userId)
      .filter(Boolean) as string[]
    const uniqueUserIds = [...new Set(userIds)]

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
