import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

/** Escalate to AM when CAP is overdue by this many days (configurable; align with ICAO / Auric Air Manual). */
const ESCALATION_CAP_OVERDUE_DAYS = parseInt(
  process.env.ESCALATION_CAP_OVERDUE_DAYS ?? '7',
  10
)

/**
 * Called by cron to escalate findings to Accountable Manager.
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

    const { data: amUsers, error: amError } = await supabase
      .from('User')
      .select('id')
      .eq('isActive', true)
      .contains('roles', ['ACCOUNTABLE_MANAGER'])

    if (amError || !amUsers?.length) {
      return NextResponse.json({
        ok: true,
        escalated: 0,
        message: 'No active Accountable Manager users found',
      })
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - ESCALATION_CAP_OVERDUE_DAYS)
    const cutoffIso = cutoff.toISOString()

    const { data: openFindingsWithCa, error: fetchError } = await supabase
      .from('Finding')
      .select(
        `
        id,
        findingNumber,
        status,
        CorrectiveAction(
          id,
          dueDate,
          status
        )
      `
      )
      .neq('status', 'CLOSED')

    if (fetchError || !openFindingsWithCa) {
      console.error('Cron escalate-to-am: fetch error', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch findings' },
        { status: 500 }
      )
    }

    const { data: existingEscalations } = await supabase
      .from('FindingEscalation')
      .select('findingId')

    const escalatedFindingIds = new Set(
      (existingEscalations ?? []).map((e: { findingId: string }) => e.findingId)
    )

    const toEscalate: Array<{ findingId: string; findingNumber: string }> = []
    for (const f of openFindingsWithCa) {
      if (escalatedFindingIds.has(f.id)) continue
      const ca = Array.isArray(f.CorrectiveAction) ? f.CorrectiveAction[0] : f.CorrectiveAction
      if (!ca?.dueDate) continue
      const dueDate = (ca as { dueDate: string }).dueDate
      if (dueDate >= cutoffIso) continue
      toEscalate.push({
        findingId: f.id,
        findingNumber: (f as { findingNumber?: string }).findingNumber ?? f.id,
      })
    }

    const escalationRows: Array<{
      id: string
      findingId: string
      escalatedAt: string
      escalatedToUserId: string
      trigger: string
    }> = []
    const notificationRows: Array<{
      id: string
      userId: string
      type: string
      title: string
      message: string
      link: string
      findingId: string
    }> = []

    const now = new Date().toISOString()
    const firstAmId = (amUsers[0] as { id: string }).id
    for (const { findingId, findingNumber } of toEscalate) {
      escalationRows.push({
        id: randomUUID(),
        findingId,
        escalatedAt: now,
        escalatedToUserId: firstAmId,
        trigger: 'OVERDUE_CAP',
      })
      for (const am of amUsers) {
        const amId = (am as { id: string }).id
        notificationRows.push({
          id: randomUUID(),
          userId: amId,
          type: 'ESCALATION_TO_AM',
          title: 'Finding escalated to Accountable Manager',
          message: `Finding ${findingNumber} has been escalated (CAP overdue > ${ESCALATION_CAP_OVERDUE_DAYS} days).`,
          link: `/findings/${findingId}`,
          findingId,
        })
      }
    }

    if (escalationRows.length > 0) {
      const { error: escError } = await supabase
        .from('FindingEscalation')
        .insert(escalationRows)
      if (escError) {
        console.error('Cron escalate-to-am: insert escalations error', escError)
        return NextResponse.json(
          { error: 'Failed to insert escalations' },
          { status: 500 }
        )
      }
    }

    if (notificationRows.length > 0) {
      const { error: notifError } = await supabase
        .from('Notification')
        .insert(notificationRows)
      if (notifError) {
        console.error('Cron escalate-to-am: insert notifications error', notifError)
      }
    }

    return NextResponse.json({
      ok: true,
      escalated: toEscalate.length,
      escalationCapOverdueDays: ESCALATION_CAP_OVERDUE_DAYS,
    })
  } catch (error) {
    console.error('Cron escalate-to-am:', error)
    return NextResponse.json(
      { error: 'Escalation cron failed' },
      { status: 500 }
    )
  }
}
