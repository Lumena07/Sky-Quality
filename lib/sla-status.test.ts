import { describe, expect, it } from 'vitest'
import { daysUntilSlaExpiry, getSlaExpiryStatus } from './sla-status'

describe('getSlaExpiryStatus', () => {
  it('returns Evergreen when isEvergreen', () => {
    expect(
      getSlaExpiryStatus({ isEvergreen: true, expiryDate: null }, new Date('2026-06-01T12:00:00Z'))
    ).toBe('Evergreen')
  })

  it('returns Expired when past expiry', () => {
    expect(
      getSlaExpiryStatus({ isEvergreen: false, expiryDate: '2026-01-01' }, new Date('2026-06-01T12:00:00Z'))
    ).toBe('Expired')
  })

  it('returns Expiring Soon within 60 days', () => {
    expect(
      getSlaExpiryStatus({ isEvergreen: false, expiryDate: '2026-07-15' }, new Date('2026-06-01T12:00:00Z'))
    ).toBe('Expiring Soon')
  })

  it('returns Active when more than 60 days left', () => {
    expect(
      getSlaExpiryStatus({ isEvergreen: false, expiryDate: '2026-12-31' }, new Date('2026-06-01T12:00:00Z'))
    ).toBe('Active')
  })
})

describe('daysUntilSlaExpiry', () => {
  it('returns null for evergreen', () => {
    expect(daysUntilSlaExpiry({ isEvergreen: true, expiryDate: null }, new Date('2026-06-01'))).toBeNull()
  })

  it('returns day count for dated SLA', () => {
    expect(
      daysUntilSlaExpiry({ isEvergreen: false, expiryDate: '2026-06-10' }, new Date('2026-06-01T12:00:00Z'))
    ).toBe(9)
  })
})
