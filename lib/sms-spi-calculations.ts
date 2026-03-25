/**
 * Pure helpers for SMS SPI math (unit-tested).
 * Investigation SLA: closed on or before COALESCE(target_completion_date, opened_at + defaultSlaDays).
 */

export const DEFAULT_INVESTIGATION_SLA_DAYS = 30

export type MonthBucket = {
  key: string
  label: string
  periodStart: string
  periodEnd: string
}

/** ISO date YYYY-MM-DD for UTC calendar month boundaries */
export const getUtcMonthBounds = (year: number, monthIndex0: number): { start: string; end: string } => {
  const start = new Date(Date.UTC(year, monthIndex0, 1))
  const end = new Date(Date.UTC(year, monthIndex0 + 1, 0))
  const toIso = (d: Date) => d.toISOString().slice(0, 10)
  return { start: toIso(start), end: toIso(end) }
}

/** Last `count` complete calendar months ending at `reference` month (inclusive), oldest first */
export const getLastNMonthBuckets = (reference: Date, count: number): MonthBucket[] => {
  const buckets: MonthBucket[] = []
  const y = reference.getUTCFullYear()
  const m = reference.getUTCMonth()
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - i, 1))
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth()
    const { start, end } = getUtcMonthBounds(year, month)
    const label = `${year}-${String(month + 1).padStart(2, '0')}`
    buckets.push({
      key: label,
      label,
      periodStart: start,
      periodEnd: end,
    })
  }
  return buckets
}

export const addDaysIso = (openedAtIso: string, days: number): string => {
  const d = new Date(openedAtIso)
  if (Number.isNaN(d.getTime())) return openedAtIso
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  t.setUTCDate(t.getUTCDate() + days)
  return t.toISOString().slice(0, 10)
}

/** Returns true if SLA met, false if closed late, null if not yet closed */
export const investigationSlaMet = (
  openedAt: string | null,
  targetCompletionDate: string | null,
  closureSignedAt: string | null,
  defaultSlaDays: number = DEFAULT_INVESTIGATION_SLA_DAYS
): boolean | null => {
  if (!openedAt || !closureSignedAt) return null
  const dueDate =
    targetCompletionDate && targetCompletionDate.trim() !== ''
      ? targetCompletionDate.slice(0, 10)
      : addDaysIso(openedAt, defaultSlaDays)
  const closedDay = closureSignedAt.slice(0, 10)
  return closedDay <= dueDate
}

export const daysBetweenUtc = (startIso: string, endIso: string): number => {
  const a = new Date(startIso).getTime()
  const b = new Date(endIso).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

/** Operational area filter: row matches scope */
export const rowMatchesOperationalArea = (
  rowArea: string | null | undefined,
  scope: { mode: 'all' } | { mode: 'area'; area: string }
): boolean => {
  if (scope.mode === 'all') return true
  const a = rowArea ?? 'other'
  if (a === 'all') return true
  return a === scope.area
}
