import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { isCapOverdue } from '@/lib/finding-overdue'

export async function GET() {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    const [
      totalAuditsResult,
      activeAuditsResult,
      openFindingsResult,
      findingsWithCaResult,
      pendingDocumentsResult,
      pendingAssessmentHazardsResult,
    ] = await Promise.all([
      supabase.from('Audit').select('*', { count: 'exact', head: true }),
      supabase
        .from('Audit')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE'),
      supabase
        .from('Finding')
        .select('*', { count: 'exact', head: true })
        .in('status', ['OPEN', 'IN_PROGRESS']),
      supabase
        .from('Finding')
        .select(
          `
          status,
          dueDate,
          capDueDate,
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
        .neq('status', 'CLOSED'),
      supabase
        .from('Document')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'REVIEW'),
      supabase
        .from('sms_hazards')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING_ASSESSMENT'),
    ])

    const totalAudits = totalAuditsResult.count ?? 0
    const activeAudits = activeAuditsResult.count ?? 0
    const openFindings = openFindingsResult.count ?? 0
    const nowIso = now.toISOString()
    const overdueCAPs = (findingsWithCaResult.data ?? []).filter((row: Record<string, unknown>) => {
      const caRaw = row.CorrectiveAction
      const ca = Array.isArray(caRaw) ? caRaw[0] : caRaw
      return isCapOverdue(
        {
          findingStatus: row.status as string | null | undefined,
          findingDueDate: row.dueDate as string | null | undefined,
          findingCapDueDate: row.capDueDate as string | null | undefined,
          hasCorrectiveAction: Boolean(ca),
          caDueDate: (ca as Record<string, unknown> | null)?.dueDate as string | null | undefined,
          capStatus: (ca as Record<string, unknown> | null)?.capStatus as string | null | undefined,
          catDueDate: (ca as Record<string, unknown> | null)?.catDueDate as string | null | undefined,
          catStatus: (ca as Record<string, unknown> | null)?.catStatus as string | null | undefined,
          correctiveActionTaken: (ca as Record<string, unknown> | null)?.correctiveActionTaken as
            | string
            | null
            | undefined,
        },
        nowIso
      )
    }).length
    const pendingDocuments = pendingDocumentsResult.count ?? 0
    const pendingAssessmentHazards = pendingAssessmentHazardsResult.count ?? 0

    return NextResponse.json({
      totalAudits,
      activeAudits,
      openFindings,
      overdueCAPs,
      pendingDocuments,
      pendingAssessmentHazards,
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
