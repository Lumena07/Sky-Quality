/**
 * Compute aviation compliance KPI values per month from system data (Supabase).
 * Used by Performance dashboard API.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

export type KpiTrendPoint = { month: string; value: number }

export type ComputedKpiResult = {
  code: string
  currentValue: number
  trend: KpiTrendPoint[]
}

function firstDayOfMonth(month: string): string {
  return `${month}-01T00:00:00.000Z`
}

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))
  return last.toISOString()
}

function monthRange(month: string, count: number): string[] {
  const out: string[] = []
  const [y, m] = month.split('-').map(Number)
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    out.unshift(ym)
  }
  return out
}

export async function computeKpis(
  supabase: Supabase,
  month: string,
  months: number
): Promise<ComputedKpiResult[]> {
  const trendMonths = monthRange(month, months)
  const results: ComputedKpiResult[] = []

  // FINDINGS_CLOSED_ONTIME: % closed within due date (closedDate <= closeOutDueDate) per month
  const closedOnTimeByMonth: Record<string, { onTime: number; total: number }> = {}
  for (const m of trendMonths) {
    const start = firstDayOfMonth(m)
    const end = lastDayOfMonth(m)
    const { data } = await supabase
      .from('Finding')
      .select('closedDate, closeOutDueDate')
      .gte('closedDate', start)
      .lte('closedDate', end)
      .not('closedDate', 'is', null)
    const list = (data ?? []) as Array<{ closedDate: string; closeOutDueDate: string | null }>
    const total = list.length
    const onTime = list.filter((f) => f.closeOutDueDate && f.closedDate <= f.closeOutDueDate).length
    closedOnTimeByMonth[m] = { onTime, total }
  }
  const currentClosed = closedOnTimeByMonth[month] ?? { onTime: 0, total: 0 }
  results.push({
    code: 'FINDINGS_CLOSED_ONTIME',
    currentValue: currentClosed.total > 0 ? Math.round((currentClosed.onTime / currentClosed.total) * 100) : 0,
    trend: trendMonths.map((m) => {
      const v = closedOnTimeByMonth[m]
      return { month: m, value: v && v.total > 0 ? Math.round((v.onTime / v.total) * 100) : 0 }
    }),
  })

  // OVERDUE_CAP: % of CAPs entered in month M (with dueDate) where capEnteredAt > dueDate
  const overdueCapByMonth: Record<string, number> = {}
  for (const m of trendMonths) {
    const start = firstDayOfMonth(m)
    const end = lastDayOfMonth(m)
    const { data } = await supabase
      .from('CorrectiveAction')
      .select('capEnteredAt, dueDate')
      .gte('capEnteredAt', start)
      .lte('capEnteredAt', end)
      .not('capEnteredAt', 'is', null)
      .not('dueDate', 'is', null)
    const list = (data ?? []) as Array<{ capEnteredAt: string; dueDate: string }>
    const total = list.length
    const overdue = list.filter((c) => c.capEnteredAt > c.dueDate).length
    overdueCapByMonth[m] = total > 0 ? Math.round((overdue / total) * 100) : 0
  }
  results.push({
    code: 'OVERDUE_CAP',
    currentValue: overdueCapByMonth[month] ?? 0,
    trend: trendMonths.map((m) => ({ month: m, value: overdueCapByMonth[m] ?? 0 })),
  })

  // OVERDUE_CAT: % of CATs entered in month M (with catDueDate) where catEnteredAt > catDueDate
  const overdueCatByMonth: Record<string, number> = {}
  for (const m of trendMonths) {
    const start = firstDayOfMonth(m)
    const end = lastDayOfMonth(m)
    const { data } = await supabase
      .from('CorrectiveAction')
      .select('catEnteredAt, catDueDate')
      .gte('catEnteredAt', start)
      .lte('catEnteredAt', end)
      .not('catEnteredAt', 'is', null)
      .not('catDueDate', 'is', null)
    const list = (data ?? []) as Array<{ catEnteredAt: string; catDueDate: string }>
    const total = list.length
    const overdue = list.filter((c) => c.catEnteredAt > c.catDueDate).length
    overdueCatByMonth[m] = total > 0 ? Math.round((overdue / total) * 100) : 0
  }
  results.push({
    code: 'OVERDUE_CAT',
    currentValue: overdueCatByMonth[month] ?? 0,
    trend: trendMonths.map((m) => ({ month: m, value: overdueCatByMonth[m] ?? 0 })),
  })

  // AUDIT_PROGRAMME: audits closed in month / audits with endDate in month
  const auditByMonth: Record<string, number> = {}
  for (const m of trendMonths) {
    const start = firstDayOfMonth(m)
    const end = lastDayOfMonth(m)
    const { count: closed } = await supabase
      .from('Audit')
      .select('*', { count: 'exact', head: true })
      .gte('updatedAt', start)
      .lte('updatedAt', end)
      .eq('status', 'CLOSED')
    const { count: planned } = await supabase
      .from('Audit')
      .select('*', { count: 'exact', head: true })
      .gte('endDate', start)
      .lte('endDate', end)
    const c = closed ?? 0
    const p = planned ?? 0
    auditByMonth[m] = p > 0 ? Math.round((c / p) * 100) : c > 0 ? 100 : 0
  }
  results.push({
    code: 'AUDIT_PROGRAMME',
    currentValue: auditByMonth[month] ?? 0,
    trend: trendMonths.map((m) => ({ month: m, value: auditByMonth[m] ?? 0 })),
  })

  // REPEAT_FINDINGS: % with same classificationId seen in earlier finding (lookback from start of trend)
  const lookbackStart = trendMonths.length > 0 ? firstDayOfMonth(trendMonths[0]) : firstDayOfMonth(month)
  const { data: allFindings } = await supabase
    .from('Finding')
    .select('id, classificationId, createdAt')
    .gte('createdAt', lookbackStart)
  const findingsList = (allFindings ?? []) as Array<{ id: string; classificationId: string | null; createdAt: string }>

  const repeatByMonth: Record<string, number> = {}
  for (const m of trendMonths) {
    const start = firstDayOfMonth(m)
    const end = lastDayOfMonth(m)
    const inMonth = findingsList.filter((f) => f.createdAt >= start && f.createdAt <= end && f.classificationId)
    const total = inMonth.length
    if (total === 0) {
      repeatByMonth[m] = 0
      continue
    }
    const beforeMonth = findingsList.filter((f) => f.createdAt < start)
    const seenClasses = new Set(beforeMonth.map((f) => f.classificationId).filter(Boolean))
    const repeats = inMonth.filter((f) => f.classificationId && seenClasses.has(f.classificationId)).length
    repeatByMonth[m] = Math.round((repeats / total) * 100)
  }
  results.push({
    code: 'REPEAT_FINDINGS',
    currentValue: repeatByMonth[month] ?? 0,
    trend: trendMonths.map((m) => ({ month: m, value: repeatByMonth[m] ?? 0 })),
  })

  // REGULATORY_VIOLATIONS: count in month (table may not exist)
  const regByMonth: Record<string, number> = {}
  try {
    for (const m of trendMonths) {
      const start = firstDayOfMonth(m)
      const end = lastDayOfMonth(m)
      const { count } = await supabase
        .from('RegulatoryViolation')
        .select('*', { count: 'exact', head: true })
        .gte('occurredAt', start)
        .lte('occurredAt', end)
      regByMonth[m] = count ?? 0
    }
  } catch {
    trendMonths.forEach((mo) => (regByMonth[mo] = 0))
  }
  results.push({
    code: 'REGULATORY_VIOLATIONS',
    currentValue: regByMonth[month] ?? 0,
    trend: trendMonths.map((m) => ({ month: m, value: regByMonth[m] ?? 0 })),
  })

  // CAP_FIRST_SUBMISSION: % CAP approved (no rejection) of those reviewed in month
  const capFirstByMonth: Record<string, number> = {}
  for (const m of trendMonths) {
    const start = firstDayOfMonth(m)
    const end = lastDayOfMonth(m)
    const { data } = await supabase
      .from('CorrectiveAction')
      .select('capStatus, capReviewedAt, capRejectionReason')
      .gte('capReviewedAt', start)
      .lte('capReviewedAt', end)
      .not('capReviewedAt', 'is', null)
    const list = (data ?? []) as Array<{ capStatus: string; capRejectionReason: string | null }>
    const total = list.length
    const approved = list.filter((c) => c.capStatus === 'APPROVED' && !c.capRejectionReason).length
    capFirstByMonth[m] = total > 0 ? Math.round((approved / total) * 100) : 0
  }
  results.push({
    code: 'CAP_FIRST_SUBMISSION',
    currentValue: capFirstByMonth[month] ?? 0,
    trend: trendMonths.map((m) => ({ month: m, value: capFirstByMonth[m] ?? 0 })),
  })

  // EXTERNAL_MAJOR: count major findings from 3rd party audits only (created in month)
  const extByMonth: Record<string, number> = {}
  for (const m of trendMonths) {
    const start = firstDayOfMonth(m)
    const end = lastDayOfMonth(m)
    const { data: audits } = await supabase
      .from('Audit')
      .select('id')
      .eq('type', 'THIRD_PARTY')
      .gte('createdAt', start)
      .lte('createdAt', end)
    const auditIds = ((audits ?? []) as Array<{ id: string }>).map((a) => a.id)
    if (auditIds.length === 0) {
      extByMonth[m] = 0
      continue
    }
    const { count } = await supabase
      .from('Finding')
      .select('*', { count: 'exact', head: true })
      .in('auditId', auditIds)
      .in('severity', ['Critical', 'Major'])
    extByMonth[m] = count ?? 0
  }
  results.push({
    code: 'EXTERNAL_MAJOR',
    currentValue: extByMonth[month] ?? 0,
    trend: trendMonths.map((m) => ({ month: m, value: extByMonth[m] ?? 0 })),
  })

  // AUDIT_RESPONSE_DAYS: avg days from finding createdAt to capEnteredAt (CAPs entered in month)
  const responseByMonth: Record<string, number> = {}
  for (const m of trendMonths) {
    const start = firstDayOfMonth(m)
    const end = lastDayOfMonth(m)
    const { data: cas } = await supabase
      .from('CorrectiveAction')
      .select('findingId, capEnteredAt')
      .gte('capEnteredAt', start)
      .lte('capEnteredAt', end)
      .not('capEnteredAt', 'is', null)
    const list = (cas ?? []) as Array<{ findingId: string; capEnteredAt: string }>
    if (list.length === 0) {
      responseByMonth[m] = 0
      continue
    }
    const findingIds = list.map((c) => c.findingId)
    const { data: finds } = await supabase.from('Finding').select('id, createdAt').in('id', findingIds)
    const findMap = new Map(((finds ?? []) as Array<{ id: string; createdAt: string }>).map((f) => [f.id, f.createdAt]))
    let sum = 0
    let n = 0
    for (const c of list) {
      const created = findMap.get(c.findingId)
      if (created) {
        sum += (new Date(c.capEnteredAt).getTime() - new Date(created).getTime()) / (1000 * 60 * 60 * 24)
        n++
      }
    }
    responseByMonth[m] = n > 0 ? Math.round(sum / n) : 0
  }
  results.push({
    code: 'AUDIT_RESPONSE_DAYS',
    currentValue: responseByMonth[month] ?? 0,
    trend: trendMonths.map((m) => ({ month: m, value: responseByMonth[m] ?? 0 })),
  })

  // FINDING_CLOSURE_DAYS: avg days from createdAt to closedDate (closed in month)
  const closureByMonth: Record<string, number> = {}
  for (const m of trendMonths) {
    const start = firstDayOfMonth(m)
    const end = lastDayOfMonth(m)
    const { data } = await supabase
      .from('Finding')
      .select('createdAt, closedDate')
      .gte('closedDate', start)
      .lte('closedDate', end)
      .eq('status', 'CLOSED')
    const list = (data ?? []) as Array<{ createdAt: string; closedDate: string }>
    if (list.length === 0) {
      closureByMonth[m] = 0
      continue
    }
    const sum = list.reduce(
      (s, f) => s + (new Date(f.closedDate).getTime() - new Date(f.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      0
    )
    closureByMonth[m] = Math.round(sum / list.length)
  }
  results.push({
    code: 'FINDING_CLOSURE_DAYS',
    currentValue: closureByMonth[month] ?? 0,
    trend: trendMonths.map((m) => ({ month: m, value: closureByMonth[m] ?? 0 })),
  })

  return results
}
