/** UI + cron: SLA expiry status from evergreen flag and optional YYYY-MM-DD date string. */
export type SlaExpiryUiStatus = 'Evergreen' | 'Active' | 'Expiring Soon' | 'Expired'

export type SlaExpiryInput = {
  isEvergreen: boolean
  expiryDate: string | null
}

export const getSlaExpiryStatus = (input: SlaExpiryInput, now = new Date()): SlaExpiryUiStatus => {
  if (input.isEvergreen) return 'Evergreen'
  const expiryDateStr = input.expiryDate
  if (!expiryDateStr) return 'Active'
  const d = new Date(expiryDateStr.slice(0, 10) + 'T12:00:00Z')
  if (Number.isNaN(d.getTime())) return 'Active'
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const exp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const msPerDay = 86400000
  const days = Math.ceil((exp.getTime() - today.getTime()) / msPerDay)
  if (days < 0) return 'Expired'
  if (days <= 60) return 'Expiring Soon'
  return 'Active'
}

export const daysUntilSlaExpiry = (input: SlaExpiryInput, now = new Date()): number | null => {
  if (input.isEvergreen) return null
  const expiryDateStr = input.expiryDate
  if (!expiryDateStr) return null
  const d = new Date(expiryDateStr.slice(0, 10) + 'T12:00:00Z')
  if (Number.isNaN(d.getTime())) return null
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const exp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000)
}
