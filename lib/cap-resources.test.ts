import { describe, expect, it } from 'vitest'
import { auditTypeSkipsCapResourceAccountableManager } from './cap-resources'

describe('auditTypeSkipsCapResourceAccountableManager', () => {
  it('returns true for EXTERNAL and THIRD_PARTY', () => {
    expect(auditTypeSkipsCapResourceAccountableManager('EXTERNAL')).toBe(true)
    expect(auditTypeSkipsCapResourceAccountableManager('THIRD_PARTY')).toBe(true)
    expect(auditTypeSkipsCapResourceAccountableManager('external')).toBe(true)
    expect(auditTypeSkipsCapResourceAccountableManager('third_party')).toBe(true)
  })

  it('returns false for INTERNAL and ERP', () => {
    expect(auditTypeSkipsCapResourceAccountableManager('INTERNAL')).toBe(false)
    expect(auditTypeSkipsCapResourceAccountableManager('ERP')).toBe(false)
  })

  it('returns false for null or empty', () => {
    expect(auditTypeSkipsCapResourceAccountableManager(null)).toBe(false)
    expect(auditTypeSkipsCapResourceAccountableManager(undefined)).toBe(false)
    expect(auditTypeSkipsCapResourceAccountableManager('')).toBe(false)
  })
})
