import { describe, it, expect } from 'vitest'
import { calculateDeadlines, getPriorityDescription } from './audit-deadlines'

describe('audit-deadlines', () => {
  const baseDate = new Date('2025-01-15T12:00:00.000Z')

  describe('calculateDeadlines', () => {
    it('P1: CAP and root cause 24h, close out 7 days', () => {
      const result = calculateDeadlines(baseDate, 'P1')
      expect(result.capDueDate.toISOString()).toBe('2025-01-16T12:00:00.000Z')
      expect(result.rootCauseDueDate.toISOString()).toBe('2025-01-16T12:00:00.000Z')
      expect(result.closeOutDueDate.toISOString()).toBe('2025-01-22T12:00:00.000Z')
    })

    it('P2: CAP and root cause 14 days, close out 60 days', () => {
      const result = calculateDeadlines(baseDate, 'P2')
      expect(result.capDueDate.toISOString()).toBe('2025-01-29T12:00:00.000Z')
      expect(result.rootCauseDueDate.toISOString()).toBe('2025-01-29T12:00:00.000Z')
      expect(result.closeOutDueDate.toISOString()).toBe('2025-03-16T12:00:00.000Z')
    })

    it('P3: CAP and root cause 28 days, close out 90 days', () => {
      const result = calculateDeadlines(baseDate, 'P3')
      expect(result.capDueDate.toISOString()).toBe('2025-02-12T12:00:00.000Z')
      expect(result.rootCauseDueDate.toISOString()).toBe('2025-02-12T12:00:00.000Z')
      expect(result.closeOutDueDate.toISOString()).toBe('2025-04-15T12:00:00.000Z')
    })

    it('rootCauseDueDate equals capDueDate', () => {
      const result = calculateDeadlines(baseDate, 'P2')
      expect(result.rootCauseDueDate.getTime()).toBe(result.capDueDate.getTime())
    })
  })

  describe('getPriorityDescription', () => {
    it('returns description for P1', () => {
      const desc = getPriorityDescription('P1')
      expect(desc).toContain('24 hours')
      expect(desc).toContain('7 days')
    })
    it('returns description for P2', () => {
      const desc = getPriorityDescription('P2')
      expect(desc).toContain('2 weeks')
      expect(desc).toContain('60 days')
    })
    it('returns description for P3', () => {
      const desc = getPriorityDescription('P3')
      expect(desc).toContain('4 weeks')
      expect(desc).toContain('90 days')
    })
    it('returns description for OBSERVATION', () => {
      const desc = getPriorityDescription('OBSERVATION')
      expect(desc.toLowerCase()).toContain('observation')
      expect(desc.toLowerCase()).toContain('no cap')
    })
  })
})
