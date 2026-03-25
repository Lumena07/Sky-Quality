import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, canSeeAmDashboard, hasReviewerRole } from '@/lib/permissions'
import { computeKpis } from '@/lib/kpi-computation'
import { isCapOverdue, isCatOverdue } from '@/lib/finding-overdue'

/** Can view Performance dashboard: reviewers (QM, auditors) or Accountable Manager. */
const canViewPerformanceDashboard = (roles: string[]): boolean =>
  canSeeAmDashboard(roles) || hasReviewerRole(roles)

/** GET: Performance dashboard data (monthly KPIs + trends). Restricted to reviewers and AM. */
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
    if (!canViewPerformanceDashboard(roles)) {
      return NextResponse.json(
        {
          error:
            'Only reviewers, Quality Manager, or Accountable Manager can view performance dashboard',
        },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')
    const monthsParam = searchParams.get('months') ?? '12'
    const period = searchParams.get('period') ?? '30d'

    const now = new Date()
    const month =
      monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? monthParam
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const months = Math.min(24, Math.max(1, parseInt(monthsParam, 10) || 12))

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)
    const fromIso = fromDate.toISOString()

    // Fetch KPI definitions (active only); table may not exist before migrations
    let definitions: Array<{
      id: string
      code: string | null
      name: string
      area: string | null
      unit: string
      direction: string
      targetValue: number | null
      isComputed: boolean
    }> = []
    try {
      const { data: kpiDefs } = await supabase
        .from('KpiDefinition')
        .select('id, code, name, area, unit, direction, targetValue, isComputed, isActive')
        .eq('isActive', true)
      definitions = (kpiDefs ?? []) as typeof definitions
    } catch {
      // KpiDefinition table not yet migrated
    }

    const computedDefs = definitions.filter((d) => d.isComputed)
    const manualDefs = definitions.filter((d) => !d.isComputed)

    // Compute values for built-in KPIs
    let computedResults: Array<{ code: string; currentValue: number; trend: Array<{ month: string; value: number }> }> = []
    try {
      computedResults = await computeKpis(supabase, month, months)
    } catch (e) {
      console.error('KPI computation error', e)
    }

    // Build trend month list (first day of each month for query)
    const trendMonths: string[] = []
    const [y, m] = month.split('-').map(Number)
    for (let i = 0; i < months; i++) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1))
      trendMonths.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`)
    }

    // Fetch manual KPI monthly values for the trend range
    const manualKpiIds = manualDefs.map((d) => d.id)
    const { data: monthlyValues } =
      manualKpiIds.length > 0
        ? await supabase
            .from('KpiMonthlyValue')
            .select('kpiDefinitionId, month, value')
            .in('kpiDefinitionId', manualKpiIds)
            .gte('month', trendMonths[trendMonths.length - 1])
            .lte('month', trendMonths[0])
        : { data: [] }

    const valueMap = new Map<string, Map<string, number>>()
    for (const row of (monthlyValues ?? []) as Array<{ kpiDefinitionId: string; month: string; value: number }>) {
      const monthKey = row.month.slice(0, 7)
      if (!valueMap.has(row.kpiDefinitionId)) valueMap.set(row.kpiDefinitionId, new Map())
      valueMap.get(row.kpiDefinitionId)!.set(monthKey, Number(row.value))
    }

    const trendMonthKeys = trendMonths.map((d) => d.slice(0, 7))

    const kpis = [
      ...computedDefs.map((def) => {
        const comp = computedResults.find((r) => r.code === def.code)
        return {
          id: def.id,
          code: def.code,
          name: def.name,
          area: def.area,
          unit: def.unit,
          direction: def.direction,
          targetValue: def.targetValue,
          isComputed: true,
          currentValue: comp?.currentValue ?? 0,
          trend: comp?.trend ?? trendMonthKeys.map((mo) => ({ month: mo, value: 0 })),
        }
      }),
      ...manualDefs.map((def) => {
        const byMonth = valueMap.get(def.id)
        const currentVal = byMonth?.get(month) ?? 0
        return {
          id: def.id,
          code: def.code,
          name: def.name,
          area: def.area,
          unit: def.unit,
          direction: def.direction,
          targetValue: def.targetValue,
          isComputed: false,
          currentValue: Number(currentVal),
          trend: trendMonthKeys.map((mo) => ({ month: mo, value: Number(byMonth?.get(mo) ?? 0) })),
        }
      }),
    ]

    // Legacy summary stats (period-based)
    const [
      auditsCompletedResult,
      findingsClosedResult,
      findingsOpenedResult,
      findingsWithCaResult,
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
    ])

    const nowIso = new Date().toISOString()
    let overdueCAPsNow = 0
    let overdueCATsNow = 0
    for (const row of (findingsWithCaResult.data ?? []) as Array<Record<string, unknown>>) {
      const caRaw = row.CorrectiveAction
      const ca = Array.isArray(caRaw) ? caRaw[0] : caRaw
      const normalized = {
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
      }
      const capOverdue = isCapOverdue(normalized, nowIso)
      const catOverdue = isCatOverdue(normalized, nowIso)
      if (capOverdue) overdueCAPsNow += 1
      if (catOverdue) overdueCATsNow += 1
    }

    const { data: byDepartment } = await supabase
      .from('Finding')
      .select('departmentId, status, Department:departmentId(name)')
      .gte('createdAt', fromIso)

    const deptOpen: Record<string, { name: string; open: number; closed: number }> = {}
    for (const row of byDepartment ?? []) {
      const d = row as {
        departmentId: string
        status: string
        Department?: { name: string } | Array<{ name: string }>
      }
      const id = d.departmentId
      const name = Array.isArray(d.Department) ? d.Department[0]?.name : d.Department?.name
      if (!deptOpen[id]) deptOpen[id] = { name: name ?? id, open: 0, closed: 0 }
      if (d.status === 'CLOSED') deptOpen[id].closed += 1
      else deptOpen[id].open += 1
    }

    return NextResponse.json({
      month,
      months,
      kpis,
      period,
      days,
      fromDate: fromIso,
      auditsCompleted: auditsCompletedResult.count ?? 0,
      findingsClosed: findingsClosedResult.count ?? 0,
      findingsOpened: findingsOpenedResult.count ?? 0,
      overdueCAPsNow,
      overdueCATsNow,
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
