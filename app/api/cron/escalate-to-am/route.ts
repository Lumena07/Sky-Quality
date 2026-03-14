import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

/** Escalate to AM when CAP is overdue by this many days (configurable; align with ICAO / internal manual). */
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
        priority,
        status,
        CorrectiveAction(
          id,
          dueDate,
          status,
          catDueDate,
          catStatus,
          completionDate
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

      const findingPriority = (f as { priority?: string | null }).priority ?? null
      if (findingPriority === 'P1') {
        toEscalate.push({
          findingId: f.id,
          findingNumber: (f as { findingNumber?: string }).findingNumber ?? f.id,
        })
        continue
      }

      const capDueDate = ca?.dueDate ? (ca as { dueDate: string }).dueDate : null
      if (capDueDate && capDueDate < cutoffIso) {
        toEscalate.push({
          findingId: f.id,
          findingNumber: (f as { findingNumber?: string }).findingNumber ?? f.id,
        })
        continue
      }

      const catDueDate = ca?.catDueDate ? (ca as { catDueDate: string }).catDueDate : null
      const catStatus = (ca as { catStatus?: string | null } | null)?.catStatus ?? null
      const completionDate = (ca as { completionDate?: string | null } | null)?.completionDate ?? null
      const catCompleted = catStatus === 'APPROVED' || Boolean(completionDate)
      if (catDueDate && catDueDate < cutoffIso && !catCompleted) {
        toEscalate.push({
          findingId: f.id,
          findingNumber: (f as { findingNumber?: string }).findingNumber ?? f.id,
        })
        continue
      }
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
      const finding = openFindingsWithCa.find((f) => f.id === findingId)
      const ca = finding
        ? Array.isArray(finding.CorrectiveAction)
          ? finding.CorrectiveAction[0]
          : finding.CorrectiveAction
        : null
      const findingPriority = finding ? ((finding as { priority?: string | null }).priority ?? null) : null
      const capDueDate = ca?.dueDate ? (ca as { dueDate: string }).dueDate : null
      const catDueDate = ca?.catDueDate ? (ca as { catDueDate: string }).catDueDate : null
      const catStatus = (ca as { catStatus?: string | null } | null)?.catStatus ?? null
      const completionDate = (ca as { completionDate?: string | null } | null)?.completionDate ?? null
      const catCompleted = catStatus === 'APPROVED' || Boolean(completionDate)

      const trigger =
        findingPriority === 'P1'
          ? 'P1'
          : capDueDate && capDueDate < cutoffIso
            ? 'OVERDUE_CAP'
            : catDueDate && catDueDate < cutoffIso && !catCompleted
              ? 'CAT_OVERDUE'
              : 'OVERDUE_CAP'

      escalationRows.push({
        id: randomUUID(),
        findingId,
        escalatedAt: now,
        escalatedToUserId: firstAmId,
        trigger,
      })
      for (const am of amUsers) {
        const amId = (am as { id: string }).id
        notificationRows.push({
          id: randomUUID(),
          userId: amId,
          type: 'ESCALATION_TO_AM',
          title: 'Finding escalated to Accountable Manager',
          message:
            trigger === 'P1'
              ? `Finding ${findingNumber} has been escalated (Priority 1).`
              : trigger === 'CAT_OVERDUE'
                ? `Finding ${findingNumber} has been escalated (CAT overdue > ${ESCALATION_CAP_OVERDUE_DAYS} days).`
                : `Finding ${findingNumber} has been escalated (CAP overdue > ${ESCALATION_CAP_OVERDUE_DAYS} days).`,
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
