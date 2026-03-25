import {
  daysBetweenUtc,
  getLastNMonthBuckets,
  investigationSlaMet,
  rowMatchesOperationalArea,
  type MonthBucket,
} from '@/lib/sms-spi-calculations'
import type { SmsSpiCalculationKey } from '@/lib/sms-spi-keys'
import { isSmsSpiCalculationKey } from '@/lib/sms-spi-keys'
import type { AssuranceOperationalScope } from '@/lib/sms-permissions'

/** Loosely typed so real SupabaseClient can be passed without structural conflicts */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

const CAPA_OPEN_LIKE = ['OPEN', 'IN_PROGRESS', 'COMPLETED'] as const
const CAPA_TERMINAL = ['CLOSED', 'VERIFIED_EFFECTIVE'] as const

const endOfUtcDayIso = (yyyyMmDd: string) => `${yyyyMmDd}T23:59:59.999Z`

const monthEndTs = (periodEnd: string) => endOfUtcDayIso(periodEnd)

type HazardRow = {
  created_at: string
  operational_area: string | null
  status?: string
  review_date?: string | null
}
type ReportRow = {
  created_at: string
  operational_area: string | null
  report_type: string | null
  icao_high_risk_categories: string[] | null
}
type InvRow = {
  opened_at: string
  target_completion_date: string | null
  closure_signed_at: string | null
  status: string
  operational_area: string | null
}
type CapaRow = {
  created_at: string
  updated_at: string
  target_completion_date: string
  status: string
  operational_area: string | null
}
type FindingRow = { status: string; created_at: string }
type TrainingRow = {
  user_id: string
  completed_at: string | null
  expiry_date: string | null
}
type HazardReviewRow = { review_date: string | null; status: string; operational_area: string | null }
type MeetingRow = {
  meeting_type: string
  scheduled_at: string
  actual_held_at: string | null
}
type MeetingActionRow = { status: string; owner_id: string | null }

const filterByScope = <T extends { operational_area?: string | null }>(rows: T[], scope: AssuranceOperationalScope): T[] => {
  if (scope.mode === 'all') return rows
  return rows.filter((r) => rowMatchesOperationalArea(r.operational_area ?? null, scope))
}

const isCapaOpenAsOf = (c: CapaRow, monthEndIso: string): boolean => {
  const endTs = new Date(monthEndTs(monthEndIso)).getTime()
  const updated = new Date(c.updated_at).getTime()
  if (CAPA_TERMINAL.includes(c.status as (typeof CAPA_TERMINAL)[number])) {
    if (Number.isNaN(updated)) return false
    return updated > endTs
  }
  return CAPA_OPEN_LIKE.includes(c.status as (typeof CAPA_OPEN_LIKE)[number])
}

const isCapaOverdueAsOf = (c: CapaRow, monthEndIso: string): boolean => {
  if (!isCapaOpenAsOf(c, monthEndIso)) return false
  const due = c.target_completion_date?.slice(0, 10)
  if (!due) return false
  return due < monthEndIso.slice(0, 10)
}

export type SpiSeriesPoint = { period: string; value: number }

export type AssuranceSummary = {
  openHazards: number
  openInvestigations: number
  overdueCapas: number
  trainingCompliancePct: number
  nextAuditDue: string | null
  openMeetingActionsUser: number
  openMeetingActionsOrg: number
}

export type MeetingCadenceWarning = {
  meetingType: string
  label: string
  lastHeldAt: string | null
  daysSince: number | null
  expectedDaysMax: number
  isOverdue: boolean
}

const runSelect = async (supabase: SupabaseLike, table: string, columns: string): Promise<unknown[]> => {
  const { data, error } = await supabase.from(table).select(columns)
  if (error) return []
  return Array.isArray(data) ? data : []
}

export const fetchAssuranceDashboardBundle = async (
  supabase: SupabaseLike,
  scope: AssuranceOperationalScope,
  options: { userId: string; months?: number }
): Promise<{
  buckets: MonthBucket[]
  summary: AssuranceSummary
  hazards: HazardRow[]
  reports: ReportRow[]
  investigations: InvRow[]
  capas: CapaRow[]
  findings: FindingRow[]
  training: TrainingRow[]
  hazardReviews: HazardReviewRow[]
  meetings: MeetingRow[]
  meetingActions: MeetingActionRow[]
  auditsForNext: { planned_date: string | null; status: string }[]
  auditsForCompliance: {
    planned_date: string | null
    status: string
    operational_area: string | null
    audit_type: string
    actual_date: string | null
  }[]
  activeUserIds: string[]
}> => {
  const months = options.months ?? 12
  const buckets = getLastNMonthBuckets(new Date(), months)

  const [
    hazardsRaw,
    reportsRaw,
    invRaw,
    capasRaw,
    findingsRaw,
    trainingRaw,
    meetingsRaw,
    actionsRaw,
    auditsRaw,
    usersRaw,
  ] = await Promise.all([
    runSelect(supabase, 'sms_hazards', 'created_at, operational_area, status, review_date'),
    runSelect(
      supabase,
      'sms_reports',
      'created_at, operational_area, report_type, icao_high_risk_categories'
    ),
    runSelect(
      supabase,
      'sms_investigations',
      'opened_at, target_completion_date, closure_signed_at, status, operational_area, updated_at'
    ),
    runSelect(
      supabase,
      'sms_capas',
      'created_at, updated_at, target_completion_date, status, operational_area'
    ),
    runSelect(supabase, 'sms_audit_findings', 'status, created_at'),
    runSelect(supabase, 'sms_training_staff', 'user_id, completed_at, expiry_date'),
    runSelect(supabase, 'sms_meetings', 'meeting_type, scheduled_at, actual_held_at'),
    runSelect(supabase, 'sms_meeting_actions', 'status, owner_id'),
    runSelect(supabase, 'sms_audits', 'planned_date, status, operational_area, audit_type, actual_date'),
    runSelect(supabase, 'User', 'id, isActive'),
  ])

  const hazards = filterByScope(hazardsRaw as HazardRow[], scope)
  const reports = filterByScope(reportsRaw as ReportRow[], scope)
  const investigations = filterByScope(invRaw as InvRow[], scope)
  const capas = filterByScope(capasRaw as CapaRow[], scope)
  const meetings = meetingsRaw as MeetingRow[]
  const auditsScoped = filterByScope(
    auditsRaw as {
      planned_date: string | null
      status: string
      operational_area?: string | null
      audit_type?: string
      actual_date?: string | null
    }[],
    scope
  )

  const today = new Date().toISOString().slice(0, 10)
  const activeUserIds = (usersRaw as { id: string; isActive?: boolean }[])
    .filter((u) => u.isActive !== false)
    .map((u) => String(u.id))

  const trainingList = trainingRaw as TrainingRow[]
  const trainingUsers = new Set(trainingList.map((t) => t.user_id))
  const trainingCompliancePct =
    activeUserIds.length === 0
      ? 0
      : Math.round(
          (activeUserIds.filter((uid) => {
            if (!trainingUsers.has(uid)) return false
            const rows = trainingList.filter((r) => r.user_id === uid)
            return rows.some((r) => {
              if (!r.completed_at) return false
              const exp = r.expiry_date
              if (!exp || exp >= today) return true
              return false
            })
          }).length /
            activeUserIds.length) *
            1000
        ) / 10

  const auditsForNext = auditsScoped
    .filter((a) => a.status !== 'CLOSED' && a.planned_date)
    .sort((a, b) => (a.planned_date ?? '').localeCompare(b.planned_date ?? ''))

  const nextAuditDue = auditsForNext[0]?.planned_date ?? null

  const actions = actionsRaw as MeetingActionRow[]
  const openMeetingActionsOrg = actions.filter((a) => a.status === 'OPEN').length
  const openMeetingActionsUser = actions.filter((a) => a.status === 'OPEN' && a.owner_id === options.userId).length

  const hazardReviews: HazardReviewRow[] = hazards.map((h) => ({
    review_date: h.review_date ?? null,
    status: h.status ?? 'OPEN',
    operational_area: h.operational_area,
  }))

  const openHazards = hazards.filter((h) => (h.status ?? 'OPEN') === 'OPEN').length
  const openInvestigations = investigations.filter((i) => i.status !== 'CLOSED').length
  const overdueCapas = capas.filter(
    (c) =>
      CAPA_OPEN_LIKE.includes(c.status as (typeof CAPA_OPEN_LIKE)[number]) &&
      c.target_completion_date &&
      c.target_completion_date < today
  ).length

  return {
    buckets,
    summary: {
      openHazards,
      openInvestigations,
      overdueCapas,
      trainingCompliancePct,
      nextAuditDue,
      openMeetingActionsUser,
      openMeetingActionsOrg,
    },
    hazards: hazards.map((h) => ({
      created_at: h.created_at,
      operational_area: h.operational_area,
    })),
    reports: reports as ReportRow[],
    investigations: investigations as InvRow[],
    capas,
    findings: findingsRaw as FindingRow[],
    training: trainingList,
    hazardReviews,
    meetings: meetings as MeetingRow[],
    meetingActions: actions,
    auditsForNext,
    auditsForCompliance: (auditsRaw as {
      planned_date: string | null
      status: string
      operational_area: string | null
      audit_type: string
      actual_date: string | null
    }[]) ?? [],
    activeUserIds,
  }
}

/** Re-apply scope to head counts for open hazards/investigations when area-scoped */
export const computeOccurrenceBreakdown = (reports: ReportRow[], periodStart: string, periodEnd: string) => {
  const inPeriod = reports.filter((r) => {
    const d = r.created_at.slice(0, 10)
    return d >= periodStart && d <= periodEnd
  })
  const byReportType: Record<string, number> = {}
  let highRiskTagged = 0
  for (const r of inPeriod) {
    const t = r.report_type ?? 'UNKNOWN'
    byReportType[t] = (byReportType[t] ?? 0) + 1
    const cats = r.icao_high_risk_categories ?? []
    if (cats.length > 0) highRiskTagged += 1
  }
  return { byReportType, highRiskTaggedCount: highRiskTagged, total: inPeriod.length }
}

export const buildSeriesForCalculationKey = (
  key: SmsSpiCalculationKey,
  buckets: MonthBucket[],
  ctx: {
    hazards: HazardRow[]
    reports: ReportRow[]
    investigations: InvRow[]
    capas: CapaRow[]
    findings: FindingRow[]
    training: TrainingRow[]
    hazardReviews: HazardReviewRow[]
    activeUserIds: string[]
  }
): { series: SpiSeriesPoint[]; currentValue: number; extra?: Record<string, unknown> } => {
  const { hazards, reports, investigations, capas, findings, training, hazardReviews, activeUserIds } = ctx

  const countInMonth = <T extends { created_at: string }>(rows: T[], start: string, end: string) =>
    rows.filter((r) => {
      const d = r.created_at.slice(0, 10)
      return d >= start && d <= end
    }).length

  if (key === 'HAZARD_REPORTS_TOTAL') {
    const series = buckets.map((b) => ({
      period: b.label,
      value: countInMonth(hazards, b.periodStart, b.periodEnd),
    }))
    return { series, currentValue: series[series.length - 1]?.value ?? 0 }
  }

  if (key === 'OCCURRENCES_MONTHLY_COUNT') {
    const series = buckets.map((b) => ({
      period: b.label,
      value: countInMonth(reports as { created_at: string }[], b.periodStart, b.periodEnd),
    }))
    const lastBucket = buckets[buckets.length - 1]
    const breakdown =
      lastBucket && reports.length
        ? computeOccurrenceBreakdown(reports, lastBucket.periodStart, lastBucket.periodEnd)
        : undefined
    return {
      series,
      currentValue: series[series.length - 1]?.value ?? 0,
      extra: breakdown ? { occurrenceBreakdown: breakdown } : undefined,
    }
  }

  if (key === 'INVESTIGATIONS_SLA_PCT') {
    const series = buckets.map((b) => {
      const closedInMonth = investigations.filter((i) => {
        if (i.status !== 'CLOSED' || !i.closure_signed_at) return false
        const d = i.closure_signed_at.slice(0, 10)
        return d >= b.periodStart && d <= b.periodEnd
      })
      if (closedInMonth.length === 0) return { period: b.label, value: 100 }
      let met = 0
      for (const i of closedInMonth) {
        const ok = investigationSlaMet(i.opened_at, i.target_completion_date, i.closure_signed_at)
        if (ok === true) met += 1
      }
      return { period: b.label, value: Math.round((met / closedInMonth.length) * 1000) / 10 }
    })
    return { series, currentValue: series[series.length - 1]?.value ?? 100 }
  }

  if (key === 'OPEN_CAPAS_COUNT') {
    const series = buckets.map((b) => ({
      period: b.label,
      value: capas.filter((c) => isCapaOpenAsOf(c, b.periodEnd)).length,
    }))
    return { series, currentValue: series[series.length - 1]?.value ?? 0 }
  }

  if (key === 'OVERDUE_CAPAS_COUNT') {
    const series = buckets.map((b) => ({
      period: b.label,
      value: capas.filter((c) => isCapaOverdueAsOf(c, b.periodEnd)).length,
    }))
    return { series, currentValue: series[series.length - 1]?.value ?? 0 }
  }

  if (key === 'TRAINING_COMPLIANCE_PCT') {
    const series = buckets.map((b) => {
      const end = b.periodEnd
      if (activeUserIds.length === 0) return { period: b.label, value: 0 }
      let ok = 0
      for (const uid of activeUserIds) {
        const rows = training.filter((t) => t.user_id === uid)
        const valid = rows.some((t) => {
          if (!t.completed_at || t.completed_at.slice(0, 10) > end) return false
          if (!t.expiry_date || t.expiry_date >= end) return true
          return false
        })
        if (valid) ok += 1
      }
      return { period: b.label, value: Math.round((ok / activeUserIds.length) * 1000) / 10 }
    })
    return { series, currentValue: series[series.length - 1]?.value ?? 0 }
  }

  if (key === 'OVERDUE_HAZARD_REVIEWS_COUNT') {
    const series = buckets.map((b) => {
      const end = b.periodEnd
      return {
        period: b.label,
        value: hazardReviews.filter(
          (h) => h.status === 'OPEN' && h.review_date && h.review_date <= end
        ).length,
      }
    })
    return { series, currentValue: series[series.length - 1]?.value ?? 0 }
  }

  if (key === 'AUDIT_FINDINGS_OPEN_COUNT') {
    const openNow = findings.filter((f) => f.status === 'OPEN').length
    const series = buckets.map((b) => ({ period: b.label, value: openNow }))
    return { series, currentValue: openNow }
  }

  if (key === 'AVG_INVESTIGATION_CLOSE_DAYS') {
    const series = buckets.map((b) => {
      const closedInMonth = investigations.filter((i) => {
        if (i.status !== 'CLOSED' || !i.closure_signed_at || !i.opened_at) return false
        const d = i.closure_signed_at.slice(0, 10)
        return d >= b.periodStart && d <= b.periodEnd
      })
      if (closedInMonth.length === 0) return { period: b.label, value: 0 }
      const sum = closedInMonth.reduce((acc, i) => {
        const days = daysBetweenUtc(i.opened_at.slice(0, 10), i.closure_signed_at!.slice(0, 10))
        return acc + (Number.isNaN(days) ? 0 : days)
      }, 0)
      return { period: b.label, value: Math.round((sum / closedInMonth.length) * 10) / 10 }
    })
    return { series, currentValue: series[series.length - 1]?.value ?? 0 }
  }

  return { series: [], currentValue: 0 }
}

export const spiAlertState = (
  value: number,
  target: number | null,
  alertLevel: number | null,
  lowerIsBetter?: boolean
): 'ok' | 'warning' | 'critical' => {
  if (alertLevel == null && target == null) return 'ok'
  if (lowerIsBetter) {
    if (alertLevel != null && value > alertLevel) return 'critical'
    if (target != null && value > target) return 'warning'
    return 'ok'
  }
  if (alertLevel != null && value < alertLevel) return 'critical'
  if (target != null && value < target) return 'warning'
  return 'ok'
}

/** Lower-is-better SPI keys (counts / days where we want small values) */
const LOWER_IS_BETTER = new Set<SmsSpiCalculationKey>([
  'OPEN_CAPAS_COUNT',
  'OVERDUE_CAPAS_COUNT',
  'OVERDUE_HAZARD_REVIEWS_COUNT',
  'AUDIT_FINDINGS_OPEN_COUNT',
  'AVG_INVESTIGATION_CLOSE_DAYS',
  'OCCURRENCES_MONTHLY_COUNT',
  'HAZARD_REPORTS_TOTAL',
])

export const alertForKey = (key: SmsSpiCalculationKey | null, value: number, target: number | null, alert: number | null) =>
  spiAlertState(value, target, alert, key ? LOWER_IS_BETTER.has(key) : false)

export const meetingCadenceWarnings = (meetings: MeetingRow[]): MeetingCadenceWarning[] => {
  const types: { meetingType: string; label: string; maxDays: number }[] = [
    { meetingType: 'SRB', label: 'Safety Review Board', maxDays: 95 },
    { meetingType: 'SAG', label: 'Safety Action Group', maxDays: 35 },
    { meetingType: 'SAFETY_COMMITTEE', label: 'Safety Committee', maxDays: 35 },
  ]
  const now = Date.now()
  return types.map((t) => {
    const relevant = meetings.filter((m) => m.meeting_type === t.meetingType)
    let lastMs = 0
    for (const m of relevant) {
      const ts = new Date(m.actual_held_at ?? m.scheduled_at).getTime()
      if (ts > lastMs) lastMs = ts
    }
    const lastHeldAt = lastMs ? new Date(lastMs).toISOString() : null
    const daysSince = lastHeldAt ? Math.floor((now - lastMs) / (24 * 60 * 60 * 1000)) : null
    const isOverdue = daysSince === null ? true : daysSince > t.maxDays
    return {
      meetingType: t.meetingType,
      label: t.label,
      lastHeldAt,
      daysSince,
      expectedDaysMax: t.maxDays,
      isOverdue,
    }
  })
}
