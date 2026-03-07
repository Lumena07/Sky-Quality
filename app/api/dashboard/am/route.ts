import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, canSeeAmDashboard } from '@/lib/permissions'

/** GET: Accountable Manager dashboard data. Restricted to AM, Quality Manager, System Admin. */
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
        { error: 'Only Accountable Manager, Quality Manager, or System Admin can view AM dashboard' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()

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

    const [
      overdueCAPsResult,
      openFindingsResult,
      openByDeptResult,
    ] = await Promise.all([
      supabase
        .from('CorrectiveAction')
        .select(
          `
          id,
          findingId,
          dueDate,
          Finding:findingId(findingNumber, status, departmentId, Department:departmentId(name))
        `
        )
        .in('status', ['OPEN', 'IN_PROGRESS'])
        .lt('dueDate', now)
        .limit(100),
      supabase
        .from('Finding')
        .select('*', { count: 'exact', head: true })
        .in('status', ['OPEN', 'IN_PROGRESS']),
      supabase
        .from('Finding')
        .select('departmentId, Department:departmentId(name)')
        .in('status', ['OPEN', 'IN_PROGRESS']),
    ])

    const overdueCAPs = overdueCAPsResult.data ?? []
    const openFindingsCount = openFindingsResult.count ?? 0
    const openByDeptRaw = openByDeptResult.data ?? []

    const departmentCounts: Record<string, { name: string; count: number }> = {}
    for (const row of openByDeptRaw) {
      const deptId = (row as { departmentId: string }).departmentId
      const dept = (row as { Department?: { name: string } | Array<{ name: string }> }).Department
      const name = Array.isArray(dept) ? dept[0]?.name : dept?.name
      if (!departmentCounts[deptId]) {
        departmentCounts[deptId] = { name: name ?? deptId, count: 0 }
      }
      departmentCounts[deptId].count += 1
    }

    return NextResponse.json({
      escalations,
      overdueCAPs: overdueCAPs.slice(0, 30),
      overdueCAPsCount: overdueCAPs.length,
      openFindingsCount,
      openByDepartment: Object.entries(departmentCounts).map(([id, v]) => ({
        departmentId: id,
        departmentName: v.name,
        count: v.count,
      })),
    })
  } catch (error) {
    console.error('Error fetching AM dashboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AM dashboard' },
      { status: 500 }
    )
  }
}
