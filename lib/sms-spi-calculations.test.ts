import { describe, it, expect } from 'vitest'
import {
  DEFAULT_INVESTIGATION_SLA_DAYS,
  addDaysIso,
  daysBetweenUtc,
  getLastNMonthBuckets,
  getUtcMonthBounds,
  investigationSlaMet,
  rowMatchesOperationalArea,
} from './sms-spi-calculations'

describe('sms-spi-calculations', () => {
  it('getUtcMonthBounds returns first and last day of month', () => {
    const { start, end } = getUtcMonthBounds(2025, 2)
    expect(start).toBe('2025-03-01')
    expect(end).toBe('2025-03-31')
  })

  it('getLastNMonthBuckets returns N buckets ending at reference month', () => {
    const ref = new Date(Date.UTC(2025, 2, 15))
    const buckets = getLastNMonthBuckets(ref, 3)
    expect(buckets).toHaveLength(3)
    expect(buckets[0].label).toBe('2025-01')
    expect(buckets[2].label).toBe('2025-03')
  })

  it('investigationSlaMet uses target_completion_date when set', () => {
    const ok = investigationSlaMet(
      '2025-01-01T10:00:00Z',
      '2025-02-15',
      '2025-02-10T12:00:00Z',
      DEFAULT_INVESTIGATION_SLA_DAYS
    )
    expect(ok).toBe(true)
  })

  it('investigationSlaMet uses default 30 days from opened_at when no target date', () => {
    const due = addDaysIso('2025-01-01T10:00:00Z', DEFAULT_INVESTIGATION_SLA_DAYS)
    const late = investigationSlaMet('2025-01-01T10:00:00Z', null, `${due}T23:00:00Z`, DEFAULT_INVESTIGATION_SLA_DAYS)
    expect(late).toBe(true)
    const veryLate = investigationSlaMet(
      '2025-01-01T10:00:00Z',
      null,
      '2025-03-15T12:00:00Z',
      DEFAULT_INVESTIGATION_SLA_DAYS
    )
    expect(veryLate).toBe(false)
  })

  it('investigationSlaMet returns null when not closed', () => {
    expect(investigationSlaMet('2025-01-01T10:00:00Z', null, null)).toBeNull()
  })

  it('daysBetweenUtc counts whole days', () => {
    expect(daysBetweenUtc('2025-01-01', '2025-01-31')).toBe(30)
  })

  it('rowMatchesOperationalArea respects scope', () => {
    expect(rowMatchesOperationalArea('airline_ops', { mode: 'area', area: 'airline_ops' })).toBe(true)
    expect(rowMatchesOperationalArea('mro_maintenance', { mode: 'area', area: 'airline_ops' })).toBe(false)
    expect(rowMatchesOperationalArea('mro_maintenance', { mode: 'all' })).toBe(true)
    expect(rowMatchesOperationalArea('all', { mode: 'area', area: 'airline_ops' })).toBe(true)
  })
})
