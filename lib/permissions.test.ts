import { describe, it, expect } from 'vitest'
import {
  hasReviewerRole,
  isAdminOrQM,
  isAccountableManager,
  canSeeAmDashboard,
  canViewActivityLog,
  isAuditorOnly,
  isNormalUser,
  isFocalPersonOnly,
  canEditFindingContent,
  canReviewFinding,
  canCreateFinding,
  canEditDocument,
  isQualityManager,
  canEditAudit,
} from './permissions'

describe('permissions', () => {
  describe('hasReviewerRole', () => {
    it('returns true for QUALITY_MANAGER', () => {
      expect(hasReviewerRole(['QUALITY_MANAGER'])).toBe(true)
    })
    it('returns true for AUDITOR', () => {
      expect(hasReviewerRole(['AUDITOR'])).toBe(true)
    })
    it('returns false for STAFF', () => {
      expect(hasReviewerRole(['STAFF'])).toBe(false)
    })
    it('returns false for empty roles', () => {
      expect(hasReviewerRole([])).toBe(false)
    })
    it('returns true when one of multiple roles is reviewer', () => {
      expect(hasReviewerRole(['STAFF', 'AUDITOR'])).toBe(true)
    })
  })

  describe('isAdminOrQM', () => {
    it('returns true for QUALITY_MANAGER', () => {
      expect(isAdminOrQM(['QUALITY_MANAGER'])).toBe(true)
    })
    it('returns false for AUDITOR', () => {
      expect(isAdminOrQM(['AUDITOR'])).toBe(false)
    })
    it('returns false for ACCOUNTABLE_MANAGER only', () => {
      expect(isAdminOrQM(['ACCOUNTABLE_MANAGER'])).toBe(false)
    })
  })

  describe('isAccountableManager', () => {
    it('returns true for ACCOUNTABLE_MANAGER', () => {
      expect(isAccountableManager(['ACCOUNTABLE_MANAGER'])).toBe(true)
    })
    it('returns false for QUALITY_MANAGER', () => {
      expect(isAccountableManager(['QUALITY_MANAGER'])).toBe(false)
    })
    it('returns false for empty roles', () => {
      expect(isAccountableManager([])).toBe(false)
    })
  })

  describe('canSeeAmDashboard', () => {
    it('returns false for QUALITY_MANAGER (AM only)', () => {
      expect(canSeeAmDashboard(['QUALITY_MANAGER'])).toBe(false)
    })
    it('returns true for ACCOUNTABLE_MANAGER', () => {
      expect(canSeeAmDashboard(['ACCOUNTABLE_MANAGER'])).toBe(true)
    })
    it('returns false for AUDITOR only', () => {
      expect(canSeeAmDashboard(['AUDITOR'])).toBe(false)
    })
    it('returns false for STAFF', () => {
      expect(canSeeAmDashboard(['STAFF'])).toBe(false)
    })
  })

  describe('canViewActivityLog', () => {
    it('returns true for QUALITY_MANAGER only', () => {
      expect(canViewActivityLog(['QUALITY_MANAGER'])).toBe(true)
    })
    it('returns false for ACCOUNTABLE_MANAGER', () => {
      expect(canViewActivityLog(['ACCOUNTABLE_MANAGER'])).toBe(false)
    })
    it('returns false for AUDITOR', () => {
      expect(canViewActivityLog(['AUDITOR'])).toBe(false)
    })
    it('returns false for STAFF', () => {
      expect(canViewActivityLog(['STAFF'])).toBe(false)
    })
  })

  describe('isAuditorOnly', () => {
    it('returns true for AUDITOR only', () => {
      expect(isAuditorOnly(['AUDITOR'])).toBe(true)
    })
    it('returns false for QUALITY_MANAGER', () => {
      expect(isAuditorOnly(['QUALITY_MANAGER'])).toBe(false)
    })
    it('returns false for QUALITY_MANAGER', () => {
      expect(isAuditorOnly(['QUALITY_MANAGER'])).toBe(false)
    })
  })

  describe('isNormalUser', () => {
    it('returns true for STAFF', () => {
      expect(isNormalUser(['STAFF'])).toBe(true)
    })
    it('returns true for DEPARTMENT_HEAD', () => {
      expect(isNormalUser(['DEPARTMENT_HEAD'])).toBe(true)
    })
    it('returns false for AUDITOR', () => {
      expect(isNormalUser(['AUDITOR'])).toBe(false)
    })
    it('returns false for QUALITY_MANAGER', () => {
      expect(isNormalUser(['QUALITY_MANAGER'])).toBe(false)
    })
  })

  describe('isFocalPersonOnly', () => {
    it('returns true for FOCAL_PERSON only', () => {
      expect(isFocalPersonOnly(['FOCAL_PERSON'])).toBe(true)
    })
    it('returns false for FOCAL_PERSON + AUDITOR', () => {
      expect(isFocalPersonOnly(['FOCAL_PERSON', 'AUDITOR'])).toBe(false)
    })
  })

  describe('canEditFindingContent', () => {
    it('returns true when user is assignee', () => {
      expect(canEditFindingContent('user-1', 'user-1', [])).toBe(true)
    })
    it('returns false when user is not assignee', () => {
      expect(canEditFindingContent('user-1', 'user-2', [])).toBe(false)
    })
    it('returns false when userId is null', () => {
      expect(canEditFindingContent(null, 'user-2', [])).toBe(false)
    })
    it('returns false when assignedToId is null', () => {
      expect(canEditFindingContent('user-1', null, [])).toBe(false)
    })
  })

  describe('canReviewFinding', () => {
    it('returns true for AUDITOR', () => {
      expect(canReviewFinding(['AUDITOR'])).toBe(true)
    })
    it('returns false for STAFF', () => {
      expect(canReviewFinding(['STAFF'])).toBe(false)
    })
  })

  describe('canCreateFinding', () => {
    it('returns true for QUALITY_MANAGER', () => {
      expect(canCreateFinding(['QUALITY_MANAGER'])).toBe(true)
    })
    it('returns false for STAFF', () => {
      expect(canCreateFinding(['STAFF'])).toBe(false)
    })
  })

  describe('canEditDocument', () => {
    it('returns true when not review/draft', () => {
      expect(canEditDocument(false, false, [])).toBe(true)
    })
    it('returns true when manual holder', () => {
      expect(canEditDocument(true, true, [])).toBe(true)
    })
    it('returns true when reviewer role', () => {
      expect(canEditDocument(true, false, ['AUDITOR'])).toBe(true)
    })
    it('returns false when review/draft and not holder and not reviewer', () => {
      expect(canEditDocument(true, false, ['STAFF'])).toBe(false)
    })
  })
})
