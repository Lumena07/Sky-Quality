import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

/** CAP due soon window in days (configurable via env; align with ICAO / internal manual). */
const CAP_DUE_SOON_DAYS = parseInt(process.env.CAP_DUE_SOON_DAYS ?? '3', 10)

/**
 * Called by Vercel Cron (or external cron) to create CAP_DUE_SOON and CAP_OVERDUE notifications.
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
    const dueSoonEnd = new Date(now)
    dueSoonEnd.setDate(dueSoonEnd.getDate() + CAP_DUE_SOON_DAYS)
    const nowIso = now.toISOString()
    const dueSoonEndIso = dueSoonEnd.toISOString()

    const { data: correctiveActions, error: fetchError } = await supabase
      .from('CorrectiveAction')
      .select(
        `
        id,
        findingId,
        dueDate,
        status,
        Finding:findingId(
          findingNumber,
          assignedToId,
          status
        )
      `
      )
      .in('status', ['OPEN', 'IN_PROGRESS'])
      .not('dueDate', 'is', null)

    if (fetchError || !correctiveActions) {
      console.error('Cron cap-notifications: fetch error', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch corrective actions' },
        { status: 500 }
      )
    }

    const notifications: Array<{
      id: string
      userId: string
      type: string
      title: string
      message: string
      link: string
      findingId: string
    }> = []

    for (const ca of correctiveActions) {
      const finding = Array.isArray(ca.Finding) ? ca.Finding[0] : ca.Finding
      if (!finding || finding.status === 'CLOSED') continue
      const assignedToId = (finding as { assignedToId?: string }).assignedToId
      if (!assignedToId) continue

      const dueDate = (ca as { dueDate?: string }).dueDate
      if (!dueDate) continue

      const findingId = (ca as { findingId: string }).findingId
      const findingNumber = (finding as { findingNumber?: string }).findingNumber ?? findingId
      const link = `/findings/${findingId}`

      if (dueDate < nowIso) {
        notifications.push({
          id: randomUUID(),
          userId: assignedToId,
          type: 'CAP_OVERDUE',
          title: 'Corrective Action Plan overdue',
          message: `CAP for finding ${findingNumber} is overdue. Please submit or update your corrective action.`,
          link,
          findingId,
        })
      } else if (dueDate <= dueSoonEndIso) {
        notifications.push({
          id: randomUUID(),
          userId: assignedToId,
          type: 'CAP_DUE_SOON',
          title: 'Corrective Action Plan due soon',
          message: `CAP for finding ${findingNumber} is due within ${CAP_DUE_SOON_DAYS} days.`,
          link,
          findingId,
        })
      }
    }

    if (notifications.length > 0) {
      const { error: insertError } = await supabase.from('Notification').insert(notifications)
      if (insertError) {
        console.error('Cron cap-notifications: insert error', insertError)
        return NextResponse.json(
          { error: 'Failed to insert notifications' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      ok: true,
      created: notifications.length,
      dueSoonDays: CAP_DUE_SOON_DAYS,
    })
  } catch (error) {
    console.error('Cron cap-notifications:', error)
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    )
  }
}
