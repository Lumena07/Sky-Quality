import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, canViewActivityLog } from '@/lib/permissions'

/** GET: Performance dashboard data (trends, KPIs over time). Restricted to reviewers and AM/admin. */
export async function GET(request: Request) {
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
    if (!canViewActivityLog(roles)) {
      return NextResponse.json(
        { error: 'Only reviewers, Quality Manager, Accountable Manager, or System Admin can view performance dashboard' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') ?? '30d'
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)
    const fromIso = fromDate.toISOString()

    const [
      auditsCompletedResult,
      findingsClosedResult,
      findingsOpenedResult,
      overdueAtEndResult,
    ] = await Promise.all([
      supabase
        .from('Audit')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'CLOSED')
        .gte('updatedAt', fromIso),
      supabase
        .from('Finding')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'CLOSED')
        .gte('closedDate', fromIso),
      supabase
        .from('Finding')
        .select('*', { count: 'exact', head: true })
        .in('status', ['OPEN', 'IN_PROGRESS'])
        .gte('createdAt', fromIso),
      supabase
        .from('CorrectiveAction')
        .select('*', { count: 'exact', head: true })
        .in('status', ['OPEN', 'IN_PROGRESS'])
        .lt('dueDate', new Date().toISOString()),
    ])

    const auditsCompleted = auditsCompletedResult.count ?? 0
    const findingsClosed = findingsClosedResult.count ?? 0
    const findingsOpened = findingsOpenedResult.count ?? 0
    const overdueCAPsNow = overdueAtEndResult.count ?? 0

    const { data: byDepartment } = await supabase
      .from('Finding')
      .select('departmentId, status, Department:departmentId(name)')
      .gte('createdAt', fromIso)

    const deptOpen: Record<string, { name: string; open: number; closed: number }> = {}
    for (const row of byDepartment ?? []) {
      const d = row as { departmentId: string; status: string; Department?: { name: string } | Array<{ name: string }> }
      const id = d.departmentId
      const name = Array.isArray(d.Department) ? d.Department[0]?.name : d.Department?.name
      if (!deptOpen[id]) deptOpen[id] = { name: name ?? id, open: 0, closed: 0 }
      if (d.status === 'CLOSED') deptOpen[id].closed += 1
      else deptOpen[id].open += 1
    }

    return NextResponse.json({
      period,
      days,
      fromDate: fromIso,
      auditsCompleted,
      findingsClosed,
      findingsOpened,
      overdueCAPsNow,
      byDepartment: Object.entries(deptOpen).map(([id, v]) => ({
        departmentId: id,
        departmentName: v.name,
        openFindings: v.open,
        closedFindings: v.closed,
      })),
    })
  } catch (error) {
    console.error('Error fetching performance dashboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    )
  }
}
