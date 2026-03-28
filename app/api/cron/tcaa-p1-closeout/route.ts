import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

const SOURCE_AUTO = 'AUTO_P1_NOT_CLOSED_ON_TIME'
const NOTIF_TYPE = 'TCAA_P1_CLOSEOUT_RED_ALERT'

/**
 * Cron: P1 findings not closed by close-out due date → TCAA register + red alert to Accountable Managers.
 * Authorization: Bearer CRON_SECRET (when CRON_SECRET is set).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createSupabaseAdminClient()
    const nowIso = new Date().toISOString()

    const { data: qmUsers } = await supabase
      .from('User')
      .select('id')
      .eq('isActive', true)
      .contains('roles', ['QUALITY_MANAGER'])
      .limit(1)

    const qmId = (qmUsers?.[0] as { id: string } | undefined)?.id
    if (!qmId) {
      return NextResponse.json({
        ok: true,
        tcaaRowsInserted: 0,
        message: 'No active Quality Manager user; cannot set createdById on TCAA rows',
      })
    }

    const { data: amUsers } = await supabase
      .from('User')
      .select('id')
      .eq('isActive', true)
      .contains('roles', ['ACCOUNTABLE_MANAGER'])

    const { data: candidates, error: fetchErr } = await supabase
      .from('Finding')
      .select('id, findingNumber, closeOutDueDate, priority, status')
      .eq('priority', 'P1')
      .neq('status', 'CLOSED')

    if (fetchErr || !candidates) {
      console.error('tcaa-p1-closeout fetch', fetchErr)
      return NextResponse.json({ error: 'Failed to fetch findings' }, { status: 500 })
    }

    let inserted = 0
    const notifications: Array<{
      id: string
      userId: string
      type: string
      title: string
      message: string
      link: string
      findingId: string
    }> = []

    for (const f of candidates) {
      const closeOut = (f as { closeOutDueDate?: string | null }).closeOutDueDate
      if (!closeOut || closeOut >= nowIso) continue

      const findingId = (f as { id: string }).id
      const findingNumber = (f as { findingNumber?: string }).findingNumber ?? findingId

      const { data: existing } = await supabase
        .from('TcaaMandatoryNotification')
        .select('id')
        .eq('findingId', findingId)
        .eq('source', SOURCE_AUTO)
        .maybeSingle()

      if (existing) continue

      const { error: insErr } = await supabase.from('TcaaMandatoryNotification').insert({
        id: randomUUID(),
        findingId,
        source: SOURCE_AUTO,
        notes: null,
        createdAt: nowIso,
        createdById: qmId,
        resolvedAt: null,
      })

      if (insErr) {
        console.error('tcaa-p1-closeout insert', insErr)
        continue
      }

      inserted += 1

      for (const am of amUsers ?? []) {
        const amId = (am as { id: string }).id
        if (!amId) continue
        notifications.push({
          id: randomUUID(),
          userId: amId,
          type: NOTIF_TYPE,
          title: 'TCAA: P1 finding not closed on time',
          message: `Red alert: Finding ${findingNumber} (P1) was not closed by the close-out due date. TCAA mandatory notification has been registered.`,
          link: `/findings/${findingId}`,
          findingId,
        })
      }
    }

    if (notifications.length > 0) {
      const { error: nErr } = await supabase.from('Notification').insert(notifications)
      if (nErr) {
        console.error('tcaa-p1-closeout notifications', nErr)
      }
    }

    return NextResponse.json({ ok: true, tcaaRowsInserted: inserted, amNotifications: notifications.length })
  } catch (e) {
    console.error('tcaa-p1-closeout', e)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
