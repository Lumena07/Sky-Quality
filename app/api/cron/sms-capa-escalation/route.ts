import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { DIRECTOR_OF_SAFETY_ROLE } from '@/lib/permissions'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data: overdue, error } = await supabase
    .from('sms_capas')
    .select('id, capa_number, assigned_owner_id, target_completion_date')
    .lt('target_completion_date', today)
    .in('status', ['OPEN', 'IN_PROGRESS'])

  if (error) return NextResponse.json({ error: 'Failed to fetch CAPAs' }, { status: 500 })
  if (!overdue || overdue.length === 0) return NextResponse.json({ ok: true, created: 0 })

  const { data: dosRows } = await supabase
    .from('User')
    .select('id')
    .eq('isActive', true)
    .contains('roles', [DIRECTOR_OF_SAFETY_ROLE])

  const { data: soPersonnel } = await supabase
    .from('sms_personnel')
    .select('user_id')
    .eq('post_holder_type', 'SAFETY_OFFICER')

  const soUserIds = Array.from(new Set((soPersonnel ?? []).map((r) => String(r.user_id)).filter(Boolean)))
  let activeSoIds = new Set<string>()
  if (soUserIds.length > 0) {
    const { data: activeSo } = await supabase.from('User').select('id').eq('isActive', true).in('id', soUserIds)
    activeSoIds = new Set((activeSo ?? []).map((u) => String(u.id)))
  }

  const dosIds = new Set((dosRows ?? []).map((u) => String(u.id)))

  const notifications: Array<{
    id: string
    userId: string
    type: string
    title: string
    message: string
    link: string
    findingId: string | null
  }> = []

  for (const item of overdue) {
    const targets = new Set<string>()
    if (item.assigned_owner_id) targets.add(String(item.assigned_owner_id))
    dosIds.forEach((id) => targets.add(id))
    activeSoIds.forEach((id) => targets.add(id))
    for (const userId of Array.from(targets)) {
      notifications.push({
        id: randomUUID(),
        userId,
        type: 'CAP_OVERDUE',
        title: 'SMS CAPA overdue',
        message: `${item.capa_number} is overdue (target ${item.target_completion_date})`,
        link: '/sms/risk/capa',
        findingId: null,
      })
    }
  }

  if (notifications.length === 0) return NextResponse.json({ ok: true, created: 0 })

  const { error: insErr } = await supabase.from('Notification').insert(notifications)
  if (insErr) console.error('sms-capa-escalation insert', insErr)
  return NextResponse.json({ ok: true, created: notifications.length })
}
