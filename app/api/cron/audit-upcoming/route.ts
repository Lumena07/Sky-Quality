import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

const AUDIT_UPCOMING_DAYS = 7

/**
 * Called by Vercel Cron (or external cron) to create AUDIT_UPCOMING notifications
 * when an audit's scheduled/start date is within the next 7 days.
 * Secure with CRON_SECRET: set in Vercel env and pass Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createSupabaseAdminClient()
    const now = new Date()
    const windowEnd = new Date(now)
    windowEnd.setDate(windowEnd.getDate() + AUDIT_UPCOMING_DAYS)
    const nowIso = now.toISOString()
    const windowEndIso = windowEnd.toISOString()

    const { data: audits, error: fetchError } = await supabase
      .from('Audit')
      .select('id, title, startDate, scheduledDate')
      .is('upcomingNotificationSentAt', null)
      .in('status', ['PLANNED', 'ACTIVE'])

    if (fetchError || !audits) {
      console.error('Cron audit-upcoming: fetch error', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch audits' },
        { status: 500 }
      )
    }

    const inWindow = audits.filter((a) => {
      const effective = (a as { startDate?: string | null }).startDate ?? (a as { scheduledDate: string }).scheduledDate
      if (!effective) return false
      return effective >= nowIso && effective <= windowEndIso
    })

    const notifications: Array<{
      id: string
      userId: string
      type: string
      title: string
      message: string
      link: string
    }> = []

    for (const audit of inWindow) {
      const auditId = (audit as { id: string }).id
      const title = (audit as { title: string }).title
      const effective = (audit as { startDate?: string | null }).startDate ?? (audit as { scheduledDate: string }).scheduledDate
      const auditDate = effective ? new Date(effective) : null
      const daysLeft = auditDate ? Math.ceil((auditDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : 0
      const dateStr = auditDate ? auditDate.toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'soon'
      const message =
        daysLeft <= 0
          ? `Audit "${title}" is scheduled for ${dateStr}.`
          : daysLeft === 1
            ? `Audit "${title}" is tomorrow (${dateStr}).`
            : `Audit "${title}" is in ${daysLeft} days (${dateStr}).`

      const { data: auditorRows } = await supabase
        .from('AuditAuditor')
        .select('userId')
        .eq('auditId', auditId)
      const { data: auditeeRows } = await supabase
        .from('AuditAuditee')
        .select('userId')
        .eq('auditId', auditId)

      const userIds = new Set<string>()
      for (const r of auditorRows ?? []) {
        const uid = (r as { userId: string }).userId
        if (uid) userIds.add(uid)
      }
      for (const r of auditeeRows ?? []) {
        const uid = (r as { userId: string | null }).userId
        if (uid) userIds.add(uid)
      }

      for (const uid of userIds) {
        notifications.push({
          id: randomUUID(),
          userId: uid,
          type: 'AUDIT_UPCOMING',
          title: 'Audit upcoming',
          message,
          link: `/audits/${auditId}`,
        })
      }

      const { error: updateError } = await supabase
        .from('Audit')
        .update({ upcomingNotificationSentAt: nowIso })
        .eq('id', auditId)

      if (updateError) {
        console.error('Cron audit-upcoming: failed to set upcomingNotificationSentAt for', auditId, updateError)
      }
    }

    if (notifications.length > 0) {
      const { error: insertError } = await supabase.from('Notification').insert(notifications)
      if (insertError) {
        console.error('Cron audit-upcoming: insert error', insertError)
        return NextResponse.json(
          { error: 'Failed to insert notifications' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      ok: true,
      created: notifications.length,
      auditsProcessed: inWindow.length,
      upcomingDays: AUDIT_UPCOMING_DAYS,
    })
  } catch (error) {
    console.error('Cron audit-upcoming:', error)
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    )
  }
}
