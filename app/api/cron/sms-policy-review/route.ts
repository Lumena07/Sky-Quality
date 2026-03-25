import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

const RECIPIENT_ROLE_HINTS = ['DIRECTOR_OF_SAFETY', 'ACCOUNTABLE_MANAGER', 'SYSTEM_ADMIN'] as const

const userShouldReceivePolicyReviewAlerts = (roles: unknown): boolean => {
  if (!Array.isArray(roles)) return false
  return roles.some((r) => typeof r === 'string' && RECIPIENT_ROLE_HINTS.includes(r as (typeof RECIPIENT_ROLE_HINTS)[number]))
}

/**
 * Daily cron: notify safety leadership when an ACTIVE SMS safety policy review is due (or overdue).
 * Secure with CRON_SECRET: Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createSupabaseAdminClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: policies, error: polErr } = await supabase
      .from('sms_safety_policy')
      .select('id, version_number, review_due_date')
      .eq('status', 'ACTIVE')
      .not('review_due_date', 'is', null)
      .lte('review_due_date', today)

    if (polErr) {
      console.error('Cron sms-policy-review: policy fetch error', polErr)
      return NextResponse.json({ error: 'Failed to fetch policies' }, { status: 500 })
    }

    if (!policies?.length) {
      return NextResponse.json({ ok: true, created: 0, policies: 0 })
    }

    const { data: users, error: userErr } = await supabase.from('User').select('id, roles')

    if (userErr) {
      console.error('Cron sms-policy-review: user fetch error', userErr)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    const recipientIds = (users ?? [])
      .filter((u) => userShouldReceivePolicyReviewAlerts(u.roles))
      .map((u) => u.id as string)

    if (recipientIds.length === 0) {
      return NextResponse.json({ ok: true, created: 0, policies: policies.length, recipients: 0 })
    }

    const notifications = policies.flatMap((p) =>
      recipientIds.map((userId) => ({
        id: randomUUID(),
        userId,
        type: 'SYSTEM_ALERT',
        title: 'SMS safety policy review due',
        message: `Policy version ${p.version_number} review was due on ${p.review_due_date}.`,
        link: '/sms/policy/statement',
      }))
    )

    const { error: insertErr } = await supabase.from('Notification').insert(notifications)
    if (insertErr) {
      console.error('Cron sms-policy-review: insert error', insertErr)
      return NextResponse.json({ error: 'Failed to insert notifications' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      created: notifications.length,
      policies: policies.length,
      recipients: recipientIds.length,
    })
  } catch (e) {
    console.error('Cron sms-policy-review:', e)
    return NextResponse.json({ error: 'SMS policy review cron failed' }, { status: 500 })
  }
}
