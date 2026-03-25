import { describe, it, expect } from 'vitest'
import {
  canManageSmsSpis,
  canSignOffSmsAuditClosure,
  getAssuranceOperationalScope,
} from './sms-permissions'

describe('sms-permissions assurance helpers', () => {
  it('canManageSmsSpis is Director of Safety only', () => {
    expect(canManageSmsSpis(['DIRECTOR_OF_SAFETY'])).toBe(true)
    expect(canManageSmsSpis(['SAFETY_OFFICER'])).toBe(false)
    expect(canManageSmsSpis(['ACCOUNTABLE_MANAGER'])).toBe(false)
  })

  it('canSignOffSmsAuditClosure is Director of Safety only', () => {
    expect(canSignOffSmsAuditClosure(['DIRECTOR_OF_SAFETY'])).toBe(true)
    expect(canSignOffSmsAuditClosure(['SAFETY_OFFICER'])).toBe(false)
  })

  it('getAssuranceOperationalScope: DoS and AM see all', () => {
    expect(getAssuranceOperationalScope(['DIRECTOR_OF_SAFETY'], 'airline_ops')).toEqual({ mode: 'all' })
    expect(getAssuranceOperationalScope(['ACCOUNTABLE_MANAGER'], 'mro_maintenance')).toEqual({ mode: 'all' })
  })

  it('getAssuranceOperationalScope: department head scoped to safety area', () => {
    expect(getAssuranceOperationalScope(['DEPARTMENT_HEAD'], 'airport_ground_ops')).toEqual({
      mode: 'area',
      area: 'airport_ground_ops',
    })
  })

  it('getAssuranceOperationalScope: safety officer scoped when area set', () => {
    expect(getAssuranceOperationalScope(['SAFETY_OFFICER'], 'mro_maintenance')).toEqual({
      mode: 'area',
      area: 'mro_maintenance',
    })
  })
})
