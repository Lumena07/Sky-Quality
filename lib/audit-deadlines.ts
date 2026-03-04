/**
 * Calculate deadlines based on priority level
 * P1: CAP within 24 hours, Close Out within 7 days
 * P2: CAP within 2 weeks, Close Out within 60 days
 * P3: CAP within 4 weeks, Close Out within 90 days
 */

export type Priority = 'P1' | 'P2' | 'P3'

export interface DeadlineDates {
  capDueDate: Date
  closeOutDueDate: Date
  rootCauseDueDate: Date // Same as CAP due date
}

export const calculateDeadlines = (auditReportDate: Date, priority: Priority): DeadlineDates => {
  const capDueDate = new Date(auditReportDate)
  const rootCauseDueDate = new Date(auditReportDate)
  const closeOutDueDate = new Date(auditReportDate)

  switch (priority) {
    case 'P1':
      // CAP and Root Cause: 24 hours
      capDueDate.setHours(capDueDate.getHours() + 24)
      rootCauseDueDate.setHours(rootCauseDueDate.getHours() + 24)
      // Close Out: 7 days
      closeOutDueDate.setDate(closeOutDueDate.getDate() + 7)
      break
    case 'P2':
      // CAP and Root Cause: 2 weeks (14 days)
      capDueDate.setDate(capDueDate.getDate() + 14)
      rootCauseDueDate.setDate(rootCauseDueDate.getDate() + 14)
      // Close Out: 60 days
      closeOutDueDate.setDate(closeOutDueDate.getDate() + 60)
      break
    case 'P3':
      // CAP and Root Cause: 4 weeks (28 days)
      capDueDate.setDate(capDueDate.getDate() + 28)
      rootCauseDueDate.setDate(rootCauseDueDate.getDate() + 28)
      // Close Out: 90 days
      closeOutDueDate.setDate(closeOutDueDate.getDate() + 90)
      break
  }

  return {
    capDueDate,
    closeOutDueDate,
    rootCauseDueDate,
  }
}

export const getPriorityDescription = (priority: Priority): string => {
  switch (priority) {
    case 'P1':
      return 'Priority 1: CAP within 24 hours, Close Out within 7 days. If safety is compromised, operation must cease immediately.'
    case 'P2':
      return 'Priority 2: CAP within 2 weeks, Close Out within 60 days'
    case 'P3':
      return 'Priority 3: CAP within 4 weeks, Close Out within 90 days'
  }
}
