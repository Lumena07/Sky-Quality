import { describe, expect, it } from 'vitest'
import { evaluateOverdue, isCapOverdue, isCatOverdue } from '@/lib/finding-overdue'

const NOW_ISO = '2026-03-25T00:00:00.000Z'

describe('finding overdue evaluator', () => {
  it('marks CAP overdue when CAP missing and Finding capDueDate is past', () => {
    const input = {
      findingStatus: 'IN_PROGRESS',
      findingCapDueDate: '2026-03-18T00:00:00.000Z',
      hasCorrectiveAction: false,
    }
    expect(isCapOverdue(input, NOW_ISO)).toBe(true)
    expect(evaluateOverdue(input, NOW_ISO)).toEqual({ isOverdue: true, kind: 'CAP' })
  })

  it('marks CAP overdue when CAP exists, due is past, and capStatus is not approved', () => {
    const input = {
      findingStatus: 'IN_PROGRESS',
      caDueDate: '2026-03-18T00:00:00.000Z',
      capStatus: null,
      hasCorrectiveAction: true,
    }
    expect(isCapOverdue(input, NOW_ISO)).toBe(true)
  })

  it('does not mark CAP overdue when CAP already approved', () => {
    const input = {
      findingStatus: 'IN_PROGRESS',
      caDueDate: '2026-03-18T00:00:00.000Z',
      capStatus: 'APPROVED',
      hasCorrectiveAction: true,
    }
    expect(isCapOverdue(input, NOW_ISO)).toBe(false)
  })

  it('marks CAT overdue when CAT due is past, not approved, and correctiveActionTaken is empty', () => {
    const input = {
      findingStatus: 'IN_PROGRESS',
      catDueDate: '2026-03-18T00:00:00.000Z',
      catStatus: 'PENDING',
      correctiveActionTaken: '',
    }
    expect(isCatOverdue(input, NOW_ISO)).toBe(true)
    expect(evaluateOverdue(input, NOW_ISO)).toEqual({ isOverdue: true, kind: 'CAT' })
  })

  it('does not mark CAT overdue when CAT is approved', () => {
    const input = {
      findingStatus: 'IN_PROGRESS',
      catDueDate: '2026-03-18T00:00:00.000Z',
      catStatus: 'APPROVED',
      correctiveActionTaken: '',
    }
    expect(isCatOverdue(input, NOW_ISO)).toBe(false)
  })

  it('never marks closed findings as overdue', () => {
    const input = {
      findingStatus: 'CLOSED',
      caDueDate: '2026-03-18T00:00:00.000Z',
      catDueDate: '2026-03-18T00:00:00.000Z',
      findingDueDate: '2026-03-18T00:00:00.000Z',
    }
    expect(evaluateOverdue(input, NOW_ISO)).toEqual({ isOverdue: false, kind: 'NONE' })
  })

  it('prioritizes CAT kind when CAP and CAT are both overdue', () => {
    const input = {
      findingStatus: 'IN_PROGRESS',
      findingCapDueDate: '2026-03-18T00:00:00.000Z',
      hasCorrectiveAction: false,
      caDueDate: '2026-03-18T00:00:00.000Z',
      capStatus: 'PENDING',
      catDueDate: '2026-03-18T00:00:00.000Z',
      catStatus: 'PENDING',
      correctiveActionTaken: '',
    }
    expect(evaluateOverdue(input, NOW_ISO)).toEqual({ isOverdue: true, kind: 'CAT' })
  })

  it('falls back to legacy finding due date when phase dates are not overdue', () => {
    const input = {
      findingStatus: 'IN_PROGRESS',
      findingDueDate: '2026-03-18T00:00:00.000Z',
      caDueDate: null,
      catDueDate: null,
    }
    expect(evaluateOverdue(input, NOW_ISO)).toEqual({ isOverdue: true, kind: 'FINDING_DUE' })
  })

  it('OBSERVATION priority is never overdue in evaluateOverdue', () => {
    const input = {
      findingPriority: 'OBSERVATION',
      findingStatus: 'OPEN',
      findingCapDueDate: '2026-03-18T00:00:00.000Z',
      hasCorrectiveAction: false,
    }
    expect(evaluateOverdue(input, NOW_ISO)).toEqual({ isOverdue: false, kind: 'NONE' })
  })
})
