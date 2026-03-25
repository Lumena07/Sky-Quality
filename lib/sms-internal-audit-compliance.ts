import { SMS_INTERNAL_AUDIT_TYPE } from '@/lib/sms-audit-checklist-templates'

export const internalAuditComplianceByArea = (
  audits: {
    operational_area: string | null
    audit_type: string
    status: string
    actual_date: string | null
    planned_date: string | null
  }[]
): { area: string; label: string; lastClosedAt: string | null; isOverdue: boolean }[] => {
  const AREAS = [
    { area: 'airline_ops', label: 'Airline' },
    { area: 'mro_maintenance', label: 'MRO' },
    { area: 'airport_ground_ops', label: 'Airport' },
  ] as const
  const yearMs = 365 * 24 * 60 * 60 * 1000
  const now = Date.now()
  return AREAS.map(({ area, label }) => {
    const relevant = audits.filter(
      (a) => a.audit_type === SMS_INTERNAL_AUDIT_TYPE && a.operational_area === area && a.status === 'CLOSED'
    )
    let last = 0
    for (const a of relevant) {
      const d = a.actual_date ?? a.planned_date
      if (!d) continue
      const t = new Date(d).getTime()
      if (t > last) last = t
    }
    const lastClosedAt = last ? new Date(last).toISOString().slice(0, 10) : null
    const isOverdue = !last || now - last > yearMs
    return { area, label, lastClosedAt, isOverdue }
  })
}
