import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { calculateDeadlines } from '@/lib/audit-deadlines'
import { evaluateOverdue } from '@/lib/finding-overdue'

/**
 * Cron: one-step priority bump when a milestone is overdue (P3→P2, P2→P1). Recomputes CAP/CAT due dates from audit report date.
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

    const { data: rows, error } = await supabase
      .from('Finding')
      .select(
        `
        id,
        priority,
        status,
        auditId,
        dueDate,
        capDueDate,
        closeOutDueDate,
        Audit:auditId(createdAt, updatedAt),
        CorrectiveAction(
          id,
          dueDate,
          capStatus,
          catDueDate,
          catStatus,
          correctiveActionTaken
        )
      `
      )
      .neq('status', 'CLOSED')

    if (error || !rows) {
      console.error('escalate-finding-priority fetch', error)
      return NextResponse.json({ error: 'Failed to fetch findings' }, { status: 500 })
    }

    let bumped = 0

    for (const f of rows) {
      const pri = String((f as { priority?: string | null }).priority ?? '').toUpperCase()
      if (pri !== 'P3' && pri !== 'P2') continue

      const caRaw = (f as { CorrectiveAction?: unknown }).CorrectiveAction
      const ca = Array.isArray(caRaw) ? caRaw[0] : caRaw

      const overdueEval = evaluateOverdue(
        {
          findingPriority: pri,
          findingStatus: (f as { status?: string }).status,
          findingDueDate: (f as { dueDate?: string | null }).dueDate ?? null,
          findingCapDueDate: (f as { capDueDate?: string | null }).capDueDate ?? null,
          hasCorrectiveAction: Boolean(ca && typeof ca === 'object' && (ca as { id?: string }).id),
          caDueDate: (ca as { dueDate?: string | null } | null)?.dueDate ?? null,
          capStatus: (ca as { capStatus?: string | null } | null)?.capStatus ?? null,
          catDueDate: (ca as { catDueDate?: string | null } | null)?.catDueDate ?? null,
          catStatus: (ca as { catStatus?: string | null } | null)?.catStatus ?? null,
          correctiveActionTaken: (ca as { correctiveActionTaken?: string | null } | null)?.correctiveActionTaken ?? null,
        },
        nowIso
      )

      if (!overdueEval.isOverdue) continue

      const newPri = pri === 'P3' ? 'P2' : 'P1'
      const audit = (f as { Audit?: { createdAt?: string; updatedAt?: string } | null }).Audit
      const reportDate = new Date(
        audit?.updatedAt || audit?.createdAt || (f as { capDueDate?: string }).capDueDate || Date.now()
      )
      const deadlines = calculateDeadlines(reportDate, newPri as 'P1' | 'P2' | 'P3')

      const findingId = (f as { id: string }).id
      const severity = newPri === 'P1' ? 'Critical' : newPri === 'P2' ? 'Major' : 'Minor'

      const { error: upF } = await supabase
        .from('Finding')
        .update({
          priority: newPri,
          severity,
          capDueDate: deadlines.capDueDate.toISOString(),
          closeOutDueDate: deadlines.closeOutDueDate.toISOString(),
          updatedAt: nowIso,
        })
        .eq('id', findingId)

      if (upF) {
        console.error('escalate-finding-priority finding update', upF)
        continue
      }

      const caId = ca && typeof ca === 'object' ? (ca as { id?: string }).id : undefined
      if (caId) {
        await supabase
          .from('CorrectiveAction')
          .update({
            dueDate: deadlines.capDueDate.toISOString(),
            catDueDate: deadlines.closeOutDueDate.toISOString(),
            updatedAt: nowIso,
          })
          .eq('id', caId)
      }

      bumped += 1
    }

    return NextResponse.json({ ok: true, bumped })
  } catch (e) {
    console.error('escalate-finding-priority', e)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
