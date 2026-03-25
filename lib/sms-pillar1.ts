/** Shared SMS Pillar 1 helpers (personnel currency, etc.). */

export type SmsPersonnelCurrency = 'CURRENT' | 'EXPIRING' | 'EXPIRED'

const MS_PER_DAY = 86_400_000

/** Parse YYYY-MM-DD as UTC midnight for stable comparisons. */
const parseDateOnly = (value: string): Date | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo, d))
  return Number.isNaN(dt.getTime()) ? null : dt
}

const startOfTodayUtc = (): Date => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** Collect non-empty expiry dates from qualification and training rows. */
export const collectPersonnelExpiryDates = (
  quals: { expiry_date?: string | null }[],
  training: { expiry_date?: string | null }[]
): string[] => {
  const out: string[] = []
  for (const row of [...quals, ...training]) {
    const raw = row.expiry_date
    if (raw == null) continue
    const s = String(raw).trim()
    if (s) out.push(s)
  }
  return out
}

const EXPIRING_WINDOW_DAYS = 60

/**
 * Worst status wins: any past expiry → EXPIRED; else any within 60 days → EXPIRING; else CURRENT.
 * No dates → CURRENT.
 */
export const computeCurrencyFromExpiries = (expiryDateStrings: string[]): SmsPersonnelCurrency => {
  const today = startOfTodayUtc().getTime()
  const soonEnd = today + EXPIRING_WINDOW_DAYS * MS_PER_DAY

  let hasExpired = false
  let hasExpiring = false

  for (const s of expiryDateStrings) {
    const d = parseDateOnly(s)
    if (!d) continue
    const t = d.getTime()
    if (t < today) {
      hasExpired = true
      break
    }
    if (t <= soonEnd) hasExpiring = true
  }

  if (hasExpired) return 'EXPIRED'
  if (hasExpiring) return 'EXPIRING'
  return 'CURRENT'
}
