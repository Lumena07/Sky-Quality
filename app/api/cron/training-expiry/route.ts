import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

/** Notify when training expires within this many days. */
const TRAINING_EXPIRY_WITHIN_DAYS = parseInt(
  process.env.TRAINING_EXPIRY_WITHIN_DAYS ?? '30',
  10
)

/**
 * Called by cron to create TRAINING_EXPIRY notifications.
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
    const now = new Date()
    const future = new Date()
    future.setDate(future.getDate() + TRAINING_EXPIRY_WITHIN_DAYS)
    const nowIso = now.toISOString()
    const futureIso = future.toISOString()

    const { data: records, error } = await supabase
      .from('TrainingRecord')
      .select('id, userId, name, expiryDate')
      .not('expiryDate', 'is', null)
      .gte('expiryDate', nowIso)
      .lte('expiryDate', futureIso)

    if (error) {
      console.error('Cron training-expiry: fetch error', error)
      return NextResponse.json(
        { error: 'Failed to fetch training records' },
        { status: 500 }
      )
    }

    const notifications = (records ?? []).map((r: { id: string; userId: string; name: string; expiryDate: string }) => ({
      id: randomUUID(),
      userId: r.userId,
      type: 'TRAINING_EXPIRY',
      title: 'Training / qualification expiring soon',
      message: `"${r.name}" expires within ${TRAINING_EXPIRY_WITHIN_DAYS} days.`,
      link: '/training',
    }))

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('Notification')
        .insert(notifications)
      if (insertError) {
        console.error('Cron training-expiry: insert error', insertError)
        return NextResponse.json(
          { error: 'Failed to insert notifications' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      ok: true,
      created: notifications.length,
      withinDays: TRAINING_EXPIRY_WITHIN_DAYS,
    })
  } catch (error) {
    console.error('Cron training-expiry:', error)
    return NextResponse.json(
      { error: 'Training expiry cron failed' },
      { status: 500 }
    )
  }
}
