import jsPDF from 'jspdf'

export interface AuditReportData {
  auditNumber: string
  title: string
  department: string
  base: string
  scheduledDate: string
  status: string
  scope: string
  description?: string
  auditors: string[]
  auditees: string[]
  findings?: {
    findingNumber: string
    description: string
    severity: string
    status: string
  }[]
}

export const generateAuditReportPDF = (data: AuditReportData): jsPDF => {
  const doc = new jsPDF()
  let yPosition = 20

  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('AUDIT REPORT', 105, yPosition, { align: 'center' })
  yPosition += 10

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Audit Number: ${data.auditNumber}`, 20, yPosition)
  yPosition += 7

  // Audit Details
  doc.setFont('helvetica', 'bold')
  doc.text('Audit Details', 20, yPosition)
  yPosition += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Title: ${data.title}`, 20, yPosition)
  yPosition += 6
  doc.text(`Department: ${data.department}`, 20, yPosition)
  yPosition += 6
  doc.text(`Base/Location: ${data.base}`, 20, yPosition)
  yPosition += 6
  doc.text(`Scheduled Date: ${data.scheduledDate}`, 20, yPosition)
  yPosition += 6
  doc.text(`Status: ${data.status}`, 20, yPosition)
  yPosition += 10

  // Scope
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Scope', 20, yPosition)
  yPosition += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const scopeLines = doc.splitTextToSize(data.scope, 170)
  doc.text(scopeLines, 20, yPosition)
  yPosition += scopeLines.length * 6 + 5

  // Description
  if (data.description) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Description', 20, yPosition)
    yPosition += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const descLines = doc.splitTextToSize(data.description, 170)
    doc.text(descLines, 20, yPosition)
    yPosition += descLines.length * 6 + 5
  }

  // Team
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Audit Team', 20, yPosition)
  yPosition += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Auditors: ${data.auditors.join(', ')}`, 20, yPosition)
  yPosition += 6
  doc.text(`Auditees: ${data.auditees.join(', ')}`, 20, yPosition)
  yPosition += 10

  // Findings
  if (data.findings && data.findings.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Findings', 20, yPosition)
    yPosition += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    data.findings.forEach((finding, index) => {
      if (yPosition > 270) {
        doc.addPage()
        yPosition = 20
      }

      doc.setFont('helvetica', 'bold')
      doc.text(`${index + 1}. ${finding.findingNumber} (${finding.severity})`, 20, yPosition)
      yPosition += 6

      doc.setFont('helvetica', 'normal')
      const findingLines = doc.splitTextToSize(finding.description, 170)
      doc.text(findingLines, 20, yPosition)
      yPosition += findingLines.length * 6 + 3
      doc.text(`Status: ${finding.status}`, 20, yPosition)
      yPosition += 8
    })
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.text(
      `Page ${i} of ${pageCount}`,
      105,
      285,
      { align: 'center' }
    )
    doc.text(
      `Generated on ${new Date().toLocaleDateString()}`,
      105,
      290,
      { align: 'center' }
    )
  }

  return doc
}

export const downloadAuditReportPDF = (data: AuditReportData, filename?: string) => {
  const doc = generateAuditReportPDF(data)
  const fileName = filename || `Audit-Report-${data.auditNumber}-${Date.now()}.pdf`
  doc.save(fileName)
}
