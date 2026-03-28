import type { SupabaseClient } from '@supabase/supabase-js'
import type { TcaaAuditReportPdfInput } from '@/lib/export/tcaa-audit-report-pdf'

export type QmsSettingsRow = {
  operatorLegalName?: string | null
  aocNumber?: string | null
  reportFooterText?: string | null
}

export async function loadQmsAuditReportAggregate(
  supabase: SupabaseClient,
  periodStart: Date,
  periodEnd: Date,
  settings: QmsSettingsRow | null
): Promise<TcaaAuditReportPdfInput> {
  const startIso = periodStart.toISOString()
  const endIso = periodEnd.toISOString()

  const { data: auditsRaw, error: auditsErr } = await supabase
    .from('Audit')
    .select(
      `
      id,
      auditNumber,
      title,
      status,
      scheduledDate,
      startDate,
      endDate,
      Department:departmentId ( name )
    `
    )
    .order('scheduledDate', { ascending: false })

  if (auditsErr) {
    console.error('loadQmsAuditReportAggregate audits', auditsErr)
  }

  const auditsList = (auditsRaw ?? []) as {
    id: string
    auditNumber: string
    title: string
    status: string
    scheduledDate: string
    startDate: string | null
    endDate: string | null
    Department?: { name: string } | { name: string }[] | null
  }[]

  const auditInPeriod = (a: (typeof auditsList)[0]): boolean => {
    const s = a.startDate ? new Date(a.startDate).getTime() : null
    const e = a.endDate ? new Date(a.endDate).getTime() : null
    const sched = new Date(a.scheduledDate).getTime()
    const p0 = periodStart.getTime()
    const p1 = periodEnd.getTime()
    if (s != null && !Number.isNaN(s) && e != null && !Number.isNaN(e)) {
      return s <= p1 && e >= p0
    }
    return sched >= p0 && sched <= p1
  }

  const filteredAudits = auditsList.filter(auditInPeriod)

  const auditIds = filteredAudits.map((a) => a.id)
  let findingsCounts = new Map<string, number>()
  if (auditIds.length > 0) {
    const { data: findingsRows } = await supabase
      .from('Finding')
      .select('id, auditId')
      .in('auditId', auditIds)
    for (const row of findingsRows ?? []) {
      const f = row as { auditId: string }
      findingsCounts.set(f.auditId, (findingsCounts.get(f.auditId) ?? 0) + 1)
    }
  }

  const deptName = (d: (typeof auditsList)[0]['Department']): string | null => {
    if (!d) return null
    if (Array.isArray(d)) return d[0]?.name ?? null
    return d.name ?? null
  }

  const audits: TcaaAuditReportPdfInput['audits'] = filteredAudits.map((a) => ({
    auditNumber: a.auditNumber,
    title: a.title,
    status: a.status,
    departmentName: deptName(a.Department),
    findingsCount: findingsCounts.get(a.id) ?? 0,
  }))

  const { data: findingsInPeriod } = await supabase
    .from('Finding')
    .select('id, status, createdAt')
    .gte('createdAt', startIso)
    .lte('createdAt', endIso)

  const findingsByStatus: Record<string, number> = {}
  for (const row of findingsInPeriod ?? []) {
    const st = (row as { status: string }).status ?? 'UNKNOWN'
    findingsByStatus[st] = (findingsByStatus[st] ?? 0) + 1
  }

  const { data: capRows } = await supabase.from('CorrectiveAction').select('id, status, Finding:findingId ( status )')

  let capOpen = 0
  let capClosed = 0
  for (const row of capRows ?? []) {
    const r = row as { Finding?: { status: string } | { status: string }[] | null }
    const f = Array.isArray(r.Finding) ? r.Finding[0] : r.Finding
    const fs = f?.status ?? ''
    if (fs === 'CLOSED') capClosed += 1
    else capOpen += 1
  }

  const { data: plans } = await supabase
    .from('AuditPlan')
    .select(
      `
      name,
      intervalMonths,
      lastDoneDate,
      Department:departmentId ( name )
    `
    )
    .order('name', { ascending: true })

  const auditPlans = (plans ?? []).map((p) => {
    const row = p as {
      name: string
      intervalMonths: number
      lastDoneDate: string | null
      Department?: { name: string } | { name: string }[] | null
    }
    let departmentName: string | null = null
    const d = row.Department
    if (d) departmentName = Array.isArray(d) ? d[0]?.name ?? null : d.name ?? null
    return {
      name: row.name,
      intervalMonths: row.intervalMonths,
      lastDoneDate: row.lastDoneDate,
      departmentName,
    }
  })

  const startYear = periodStart.getFullYear()
  const endYear = periodEnd.getFullYear()
  const { data: objectives } = await supabase
    .from('QualityObjectives')
    .select('year, objectivesPdfUrl, objectivesText')
    .gte('year', startYear - 1)
    .lte('year', endYear + 1)

  const summarizeObjective = (row: {
    objectivesPdfUrl: string | null
    objectivesText: string | null
  }): string => {
    const t = row.objectivesText?.trim()
    if (t) {
      return t.length > 280 ? `${t.slice(0, 277)}…` : t
    }
    if (row.objectivesPdfUrl?.trim()) {
      return 'Documented (PDF on file)'
    }
    return 'Not recorded'
  }

  const qualityObjectivesRows = (objectives ?? []).map((o) => {
    const row = o as { year: number; objectivesPdfUrl: string | null; objectivesText: string | null }
    return {
      year: row.year,
      objectiveSummary: summarizeObjective(row),
    }
  })

  return {
    operatorLegalName: settings?.operatorLegalName ?? null,
    aocNumber: settings?.aocNumber ?? null,
    reportFooterText: settings?.reportFooterText ?? null,
    periodLabel: '',
    reportType: '',
    periodStart: startIso,
    periodEnd: endIso,
    executiveSummaryText: null,
    generatedAt: null,
    audits,
    findingsByStatus,
    capOpen,
    capClosed,
    auditPlans,
    qualityObjectivesRows,
  }
}
