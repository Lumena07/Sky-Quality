import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { DIRECTOR_OF_SAFETY_ROLE } from '@/lib/permissions'

/**
 * Notify Directors of Safety when a regulatory initial deadline is within 12 hours.
 * Secure with CRON_SECRET: Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdminClient()
  const now = new Date()
  const horizon = new Date(now.getTime() + 12 * 60 * 60 * 1000)
  const { data: rows, error } = await supabase
    .from('sms_regulatory_reports')
    .select('id, report_number, initial_deadline_at')
    .not('initial_deadline_at', 'is', null)
    .gte('initial_deadline_at', now.toISOString())
    .lte('initial_deadline_at', horizon.toISOString())
    .in('status', ['SUBMITTED', 'ACKNOWLEDGED'])

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  if (!rows?.length) return NextResponse.json({ ok: true, created: 0 })

  const { data: dosUsers } = await supabase
    .from('User')
    .select('id')
    .eq('isActive', true)
    .contains('roles', [DIRECTOR_OF_SAFETY_ROLE])

  const dosIds = Array.from(new Set((dosUsers ?? []).map((u) => String(u.id))))
  if (dosIds.length === 0) return NextResponse.json({ ok: true, created: 0 })

  const notifications = dosIds.flatMap((userId) =>
    (rows ?? []).map((r) => ({
      id: randomUUID(),
      userId,
      type: 'SYSTEM_ALERT',
      title: 'Regulatory report deadline approaching',
      message: `Report ${r.report_number} initial notification deadline is within 12 hours.`,
      link: '/sms/risk/regulatory',
      findingId: null as string | null,
    }))
  )

  const { error: insErr } = await supabase.from('Notification').insert(notifications)
  if (insErr) console.error('sms-regulatory-deadline notifications', insErr)
  return NextResponse.json({ ok: true, created: notifications.length })
}
