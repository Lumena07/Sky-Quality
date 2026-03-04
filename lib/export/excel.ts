import * as XLSX from 'xlsx'

export interface FindingExportData {
  findingNumber: string
  auditNumber: string
  department: string
  policyReference: string
  description: string
  rootCause?: string
  severity: string
  status: string
  assignedTo: string
  dueDate?: string
  correctiveAction?: string
  capStatus?: string
  capDueDate?: string
}

export interface AuditExportData {
  auditNumber: string
  title: string
  department: string
  base: string
  scheduledDate: string
  status: string
  scope: string
  auditors: string
  auditees: string
  findingsCount: number
}

export const exportFindingsToExcel = (
  findings: FindingExportData[],
  filename?: string
) => {
  // Create workbook
  const wb = XLSX.utils.book_new()

  // Prepare data for export
  const exportData = findings.map((finding) => ({
    'Finding Number': finding.findingNumber,
    'Audit Number': finding.auditNumber,
    'Department': finding.department,
    'Policy Reference': finding.policyReference,
    'Description': finding.description,
    'Root Cause': finding.rootCause || '',
    'Severity': finding.severity,
    'Status': finding.status,
    'Assigned To': finding.assignedTo,
    'Due Date': finding.dueDate || '',
    'Corrective Action': finding.correctiveAction || '',
    'CAP Status': finding.capStatus || '',
    'CAP Due Date': finding.capDueDate || '',
  }))

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(exportData)

  // Set column widths
  const colWidths = [
    { wch: 18 }, // Finding Number
    { wch: 18 }, // Audit Number
    { wch: 15 }, // Department
    { wch: 20 }, // Policy Reference
    { wch: 40 }, // Description
    { wch: 30 }, // Root Cause
    { wch: 12 }, // Severity
    { wch: 15 }, // Status
    { wch: 20 }, // Assigned To
    { wch: 12 }, // Due Date
    { wch: 40 }, // Corrective Action
    { wch: 15 }, // CAP Status
    { wch: 12 }, // CAP Due Date
  ]
  ws['!cols'] = colWidths

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Findings')

  // Generate filename
  const fileName = filename || `Findings-Export-${Date.now()}.xlsx`

  // Write file
  XLSX.writeFile(wb, fileName)
}

export const exportAuditsToExcel = (
  audits: AuditExportData[],
  filename?: string
) => {
  const wb = XLSX.utils.book_new()

  const exportData = audits.map((audit) => ({
    'Audit Number': audit.auditNumber,
    'Title': audit.title,
    'Department': audit.department,
    'Base': audit.base,
    'Scheduled Date': audit.scheduledDate,
    'Status': audit.status,
    'Scope': audit.scope,
    'Auditors': audit.auditors,
    'Auditees': audit.auditees,
    'Findings Count': audit.findingsCount,
  }))

  const ws = XLSX.utils.json_to_sheet(exportData)

  const colWidths = [
    { wch: 18 }, // Audit Number
    { wch: 30 }, // Title
    { wch: 15 }, // Department
    { wch: 15 }, // Base
    { wch: 15 }, // Scheduled Date
    { wch: 12 }, // Status
    { wch: 40 }, // Scope
    { wch: 30 }, // Auditors
    { wch: 30 }, // Auditees
    { wch: 15 }, // Findings Count
  ]
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, 'Audits')

  const fileName = filename || `Audits-Export-${Date.now()}.xlsx`
  XLSX.writeFile(wb, fileName)
}

export const exportDashboardStatsToExcel = (stats: {
  totalAudits: number
  activeAudits: number
  openFindings: number
  overdueCAPs: number
  pendingDocuments: number
}) => {
  const wb = XLSX.utils.book_new()

  const statsData = [
    { Metric: 'Total Audits', Value: stats.totalAudits },
    { Metric: 'Active Audits', Value: stats.activeAudits },
    { Metric: 'Open Findings', Value: stats.openFindings },
    { Metric: 'Overdue CAPs', Value: stats.overdueCAPs },
    { Metric: 'Pending Documents', Value: stats.pendingDocuments },
  ]

  const ws = XLSX.utils.json_to_sheet(statsData)

  const colWidths = [{ wch: 25 }, { wch: 15 }]
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, 'Dashboard Stats')

  const fileName = `Dashboard-Stats-${Date.now()}.xlsx`
  XLSX.writeFile(wb, fileName)
}
