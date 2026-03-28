import { describe, expect, it } from 'vitest'
import { rolesFromUserRow, sanitizeRoleMetadataForRoles } from '@/lib/role-metadata'

describe('sanitizeRoleMetadataForRoles', () => {
  it('returns null when no operational roles', () => {
    const r = sanitizeRoleMetadataForRoles(['STAFF'], { PILOT: { pilotSeat: 'CAPTAIN', aircraftTypeCodes: ['C208'] } })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBeNull()
  })

  it('accepts valid pilot', () => {
    const r = sanitizeRoleMetadataForRoles(
      ['PILOT'],
      { PILOT: { pilotSeat: 'CAPTAIN', aircraftTypeCodes: ['C208'] } }
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value?.PILOT?.aircraftTypeCodes).toEqual(['C208'])
  })

  it('rejects invalid aircraft code', () => {
    const r = sanitizeRoleMetadataForRoles(
      ['PILOT'],
      { PILOT: { pilotSeat: 'CAPTAIN', aircraftTypeCodes: ['NOT_A_TYPE'] } }
    )
    expect(r.ok).toBe(false)
  })

  it('accepts dispatcher', () => {
    const r = sanitizeRoleMetadataForRoles(
      ['FLIGHT_DISPATCHERS'],
      { FLIGHT_DISPATCHERS: { aircraftTypeCodes: ['B737'] } }
    )
    expect(r.ok).toBe(true)
  })
})

describe('rolesFromUserRow', () => {
  it('prefers roles array', () => {
    expect(rolesFromUserRow({ roles: ['A', 'B'], role: 'STAFF' })).toEqual(['A', 'B'])
  })

  it('falls back to role', () => {
    expect(rolesFromUserRow({ role: 'STAFF' })).toEqual(['STAFF'])
  })
})
