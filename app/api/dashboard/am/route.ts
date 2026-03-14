import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, canSeeAmDashboard } from '@/lib/permissions'

/** GET: Accountable Manager dashboard data. Restricted to AM only. */
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

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!canSeeAmDashboard(roles)) {
      return NextResponse.json(
        { error: 'Only Accountable Manager can view AM dashboard' },
        { status: 403 }
      )
    }

    let escalations: Array<{
      id: string
      findingId: string
      escalatedAt: string
      trigger: string
      Finding?: Array<{ findingNumber: string; status: string }> | { findingNumber: string; status: string }
    }> = []
    try {
      const { data: escData } = await supabase
        .from('FindingEscalation')
        .select(
          `
          id,
          findingId,
          escalatedAt,
          trigger,
          Finding:findingId(findingNumber, status)
        `
        )
        .order('escalatedAt', { ascending: false })
        .limit(50)
      escalations = (escData ?? []) as typeof escalations
    } catch {
      // Table may not exist yet
    }

    let pendingRescheduleRequests: Array<{
      id: string
      auditId: string
      requestedStartDate: string
      requestedEndDate: string
      requestedAt: string
      reason: string | null
      Audit?: { id: string; title?: string } | null
      RequestedBy?: { id: string; firstName?: string; lastName?: string } | null
    }> = []
    try {
      const { data: rescheduleData } = await supabase
        .from('AuditRescheduleRequest')
        .select(
          `
          id,
          auditId,
          requestedStartDate,
          requestedEndDate,
          requestedAt,
          reason,
          Audit:auditId(id, title),
          RequestedBy:requestedById(id, firstName, lastName)
        `
        )
        .eq('status', 'PENDING')
        .order('requestedAt', { ascending: false })
        .limit(50)
      pendingRescheduleRequests = (rescheduleData ?? []) as typeof pendingRescheduleRequests
    } catch {
      // Table may not exist yet
    }

    return NextResponse.json({
      escalations,
      pendingRescheduleRequests,
    })
  } catch (error) {
    console.error('Error fetching AM dashboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AM dashboard' },
      { status: 500 }
    )
  }
}
