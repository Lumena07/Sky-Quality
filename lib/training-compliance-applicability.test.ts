import { describe, expect, it } from 'vitest'
import {
  matchesAudienceRules,
  userMatchesTrainingType,
  userMatchesPersonalDocumentKind,
  parseStringIdArray,
} from '@/lib/training-compliance-applicability'

const baseUser = {
  id: 'u1',
  departmentId: null as string | null,
  roles: ['STAFF'] as unknown,
  role: null as string | null,
  roleMetadata: null as unknown,
}

describe('userMatchesTrainingType', () => {
  it('mandatoryForAll matches everyone', () => {
    expect(
      userMatchesTrainingType(baseUser, {
        mandatoryForAll: true,
        applicableRoles: ['PILOT'],
      })
    ).toBe(true)
  })

  it('excludes focal persons even when mandatoryForAll', () => {
    const focal = { ...baseUser, roles: ['FOCAL_PERSON'] as unknown }
    expect(
      userMatchesTrainingType(focal, {
        mandatoryForAll: true,
      })
    ).toBe(false)
  })

  it('excludes focal persons when listed by applicableUserIds only', () => {
    const focal = { ...baseUser, id: 'fp1', roles: ['FOCAL_PERSON'] as unknown }
    expect(
      userMatchesTrainingType(focal, {
        mandatoryForAll: false,
        applicableUserIds: ['fp1'],
      })
    ).toBe(false)
  })

  it('no filters matches everyone', () => {
    expect(userMatchesTrainingType(baseUser, { mandatoryForAll: false })).toBe(true)
  })

  it('applicableUserIds only', () => {
    const t = { mandatoryForAll: false, applicableUserIds: ['u1'] }
    expect(userMatchesTrainingType(baseUser, t)).toBe(true)
    expect(userMatchesTrainingType({ ...baseUser, id: 'u2' }, t)).toBe(false)
  })

  it('department filter', () => {
    const t = {
      mandatoryForAll: false,
      applicableDepartmentIds: ['dept_a'],
    }
    expect(
      userMatchesTrainingType({ ...baseUser, departmentId: 'dept_a' }, t)
    ).toBe(true)
    expect(
      userMatchesTrainingType({ ...baseUser, departmentId: 'dept_b' }, t)
    ).toBe(false)
  })

  it('roles filter', () => {
    const t = { mandatoryForAll: false, applicableRoles: ['PILOT'] }
    expect(userMatchesTrainingType({ ...baseUser, roles: ['PILOT'] }, t)).toBe(true)
    expect(userMatchesTrainingType(baseUser, t)).toBe(false)
  })

  it('userIds OR rules', () => {
    const t = {
      mandatoryForAll: false,
      applicableUserIds: ['u2'],
      applicableRoles: ['PILOT'],
    }
    expect(userMatchesTrainingType(baseUser, t)).toBe(false)
    expect(userMatchesTrainingType({ ...baseUser, id: 'u2' }, t)).toBe(true)
    expect(
      userMatchesTrainingType({ ...baseUser, roles: ['PILOT'] }, t)
    ).toBe(true)
  })

  it('pilot metadata subset', () => {
    const t = {
      mandatoryForAll: false,
      applicableRoles: ['PILOT'],
      applicableRoleMetadata: {
        PILOT: { aircraftTypeCodes: ['C208'], pilotSeat: 'CAPTAIN' },
      },
    }
    const ok = {
      ...baseUser,
      roles: ['PILOT'],
      roleMetadata: {
        PILOT: {
          aircraftTypeCodes: ['C208', 'B737'],
          pilotSeat: 'CAPTAIN',
        },
      },
    }
    const wrongSeat = {
      ...ok,
      roleMetadata: { PILOT: { aircraftTypeCodes: ['C208'], pilotSeat: 'FIRST_OFFICER' } },
    }
    const wrongType = {
      ...ok,
      roleMetadata: { PILOT: { aircraftTypeCodes: ['B737'], pilotSeat: 'CAPTAIN' } },
    }
    expect(userMatchesTrainingType(ok, t)).toBe(true)
    expect(userMatchesTrainingType(wrongSeat, t)).toBe(false)
    expect(userMatchesTrainingType(wrongType, t)).toBe(false)
  })
})

describe('parseStringIdArray', () => {
  it('dedupes and trims', () => {
    expect(parseStringIdArray([' a ', 'a', 'b'])).toEqual(['a', 'b'])
  })
})

describe('userMatchesPersonalDocumentKind', () => {
  it('matches everyone when no roles configured', () => {
    expect(
      userMatchesPersonalDocumentKind(
        { roles: ['STAFF'], role: null },
        { applicableRoles: null }
      )
    ).toBe(true)
    expect(
      userMatchesPersonalDocumentKind(
        { roles: ['STAFF'], role: null },
        { applicableRoles: [] }
      )
    ).toBe(true)
  })

  it('does not match focal persons when kind applies to all staff', () => {
    expect(
      userMatchesPersonalDocumentKind(
        { roles: ['FOCAL_PERSON'], role: null },
        { applicableRoles: null }
      )
    ).toBe(false)
  })

  it('matches when user has any listed role', () => {
    const kind = { applicableRoles: ['PILOT', 'AUDITOR'] }
    expect(
      userMatchesPersonalDocumentKind({ roles: ['PILOT'], role: null }, kind)
    ).toBe(true)
    expect(
      userMatchesPersonalDocumentKind({ roles: ['STAFF'], role: null }, kind)
    ).toBe(false)
  })
})

describe('matchesAudienceRules', () => {
  it('ANDs department and role', () => {
    const t = {
      applicableDepartmentIds: ['d1'],
      applicableRoles: ['AUDITOR'],
    }
    expect(
      matchesAudienceRules(
        { ...baseUser, departmentId: 'd1', roles: ['AUDITOR'] },
        t
      )
    ).toBe(true)
    expect(
      matchesAudienceRules(
        { ...baseUser, departmentId: 'd1', roles: ['STAFF'] },
        t
      )
    ).toBe(false)
  })
})
