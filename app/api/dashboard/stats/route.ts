import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

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
      overdueCAPsResult,
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
        .from('CorrectiveAction')
        .select('*', { count: 'exact', head: true })
        .in('status', ['OPEN', 'IN_PROGRESS'])
        .lt('dueDate', now.toISOString()),
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
    const overdueCAPs = overdueCAPsResult.count ?? 0
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
