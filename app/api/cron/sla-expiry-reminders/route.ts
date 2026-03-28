import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { sendEmailOptional } from '@/lib/email'
import { daysUntilSlaExpiry } from '@/lib/sla-status'

const THRESHOLDS = [60, 30] as const

/**
 * Daily: notify QMs by in-app notification + email (if Resend configured) at 60 and 30 days before SLA expiry.
 * Secured with CRON_SECRET like other crons.
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

    const { data: slas, error: slaErr } = await supabase
      .from('ServiceLevelAgreement')
      .select('id, companyName, isEvergreen, expiryDate')
    if (slaErr || !slas) {
      console.error('sla-expiry-reminders: fetch SLA', slaErr)
      return NextResponse.json({ error: 'Failed to fetch SLAs' }, { status: 500 })
    }

    const { data: qmUsers, error: qmErr } = await supabase
      .from('User')
      .select('id, email')
      .eq('isActive', true)
      .filter('roles', 'cs', JSON.stringify(['QUALITY_MANAGER']))

    let qmList = qmUsers ?? []
    if (qmErr || qmList.length === 0) {
      const { data: fallback } = await supabase
        .from('User')
        .select('id, email')
        .eq('isActive', true)
        .eq('role', 'QUALITY_MANAGER')
      qmList = fallback ?? []
    }

    if (qmList.length === 0) {
      return NextResponse.json({ ok: true, message: 'No QM users', created: 0 })
    }

    const notifications: Array<{
      id: string
      userId: string
      type: string
      title: string
      message: string
      link: string | null
    }> = []
    const sentKeys: Array<{ id: string; slaId: string; thresholdDays: number; sentAt: string }> = []

    for (const sla of slas as Array<{
      id: string
      companyName: string
      isEvergreen?: boolean
      expiryDate: string | null
    }>) {
      if (sla.isEvergreen === true || sla.expiryDate == null) continue
      const days = daysUntilSlaExpiry(
        { isEvergreen: false, expiryDate: String(sla.expiryDate).slice(0, 10) },
        now
      )
      if (days == null || days < 0) continue

      for (const threshold of THRESHOLDS) {
        if (days > threshold) continue

        const { data: existing } = await supabase
          .from('SlaExpiryNotificationSent')
          .select('id')
          .eq('slaId', sla.id)
          .eq('thresholdDays', threshold)
          .maybeSingle()
        if (existing) continue

        const sentAt = new Date().toISOString()
        const keyId = randomUUID()
        sentKeys.push({ id: keyId, slaId: sla.id, thresholdDays: threshold, sentAt })

        for (const qm of qmList) {
          const uid = (qm as { id: string }).id
          const email = (qm as { email?: string }).email
          notifications.push({
            id: randomUUID(),
            userId: uid,
            type: 'SYSTEM_ALERT',
            title: `SLA expiring in ${threshold} days or less`,
            message: `${sla.companyName} — expiry ${String(sla.expiryDate).slice(0, 10)} (${days} day(s) remaining).`,
            link: '/external-service-providers',
          })
          if (email?.trim()) {
            await sendEmailOptional({
              to: email.trim(),
              subject: `[QMS] SLA expiring: ${sla.companyName}`,
              text: `Service level agreement "${sla.companyName}" expires on ${String(sla.expiryDate).slice(0, 10)} (${days} day(s) left). Review: External Service Providers in the QMS module.`,
            })
          }
        }
      }
    }

    if (sentKeys.length > 0) {
      const { error: insSentErr } = await supabase.from('SlaExpiryNotificationSent').insert(sentKeys)
      if (insSentErr) {
        console.error('sla-expiry-reminders: insert sent keys', insSentErr)
      }
    }

    if (notifications.length > 0) {
      const { error: insN } = await supabase.from('Notification').insert(notifications)
      if (insN) {
        console.error('sla-expiry-reminders: insert notifications', insN)
        return NextResponse.json({ error: 'Failed to insert notifications' }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      slasChecked: slas.length,
      notificationsCreated: notifications.length,
      dedupeRows: sentKeys.length,
    })
  } catch (e) {
    console.error('sla-expiry-reminders', e)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
