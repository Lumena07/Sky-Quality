import jsPDF from 'jspdf'

export interface FindingReport {
  findingNumber: string
  description: string
  priority?: string | null
}

export interface ExecutiveSummaryReport {
  overallResult: string
  checklistItemsReviewed: number
  numberOfFindings: number
  complianceSummary: string
  compliantCount?: number
  nonCompliantCount?: number
  notReviewedCount?: number
}

export interface ChecklistItemReport {
  ref?: string | null
  content: string
  documentedImplementedLabel: string
  compliance: 'Compliant' | 'Non-Compliant' | 'Not reviewed'
  objectiveEvidence?: string | null
  findings?: FindingReport[]
}

export interface AuditReportData {
  auditNumber: string
  title: string
  reportTitle: string
  auditDate: string
  department: string
  base: string
  scope: string
  description?: string
  auditors: string[]
  auditees: string[]
  executiveSummary: ExecutiveSummaryReport
  conclusion?: string
  generatedDate: string
  checklistItems?: ChecklistItemReport[]
  findings?: {
    findingNumber: string
    description: string
    severity: string
  }[]
}

const SECTION_SPACING = 4
const LINE_HEIGHT = 6
const MARGIN = 20
const PAGE_TOP = 20
const PAGE_BREAK_Y = 270
const BODY_FONT_SIZE = 10
const HEADING_FONT_SIZE = 12
const TITLE_FONT_SIZE = 18

export const generateAuditReportPDF = (data: AuditReportData): jsPDF => {
  const doc = new jsPDF()
  let yPosition = PAGE_TOP

  const drawSectionHeading = (title: string) => {
    if (yPosition > PAGE_BREAK_Y) {
      doc.addPage()
      yPosition = PAGE_TOP
    }
    doc.setFontSize(HEADING_FONT_SIZE)
    doc.setFont('helvetica', 'bold')
    doc.text(title, MARGIN, yPosition)
    yPosition += LINE_HEIGHT + 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(BODY_FONT_SIZE)
  }

  // Report title: [Audit Name] Audit Report
  const reportTitle = data.reportTitle ?? `${data.title} Audit Report`
  doc.setFontSize(TITLE_FONT_SIZE)
  doc.setFont('helvetica', 'bold')
  const titleLines = doc.splitTextToSize(reportTitle, 170)
  doc.text(titleLines, 105, yPosition, { align: 'center' })
  yPosition += titleLines.length * LINE_HEIGHT + 6
  doc.setDrawColor(200, 200, 200)
  doc.line(MARGIN, yPosition, 190, yPosition)
  yPosition += 10

  // 1. Audit Details (no scheduled date; audit date = start date)
  drawSectionHeading('1. Audit Details')
  doc.text(`Audit Number: ${data.auditNumber}`, MARGIN, yPosition)
  yPosition += LINE_HEIGHT
  doc.text(`Audit Date: ${data.auditDate}`, MARGIN, yPosition)
  yPosition += LINE_HEIGHT
  doc.text(`Department: ${data.department}`, MARGIN, yPosition)
  yPosition += LINE_HEIGHT
  doc.text(`Base/Location: ${data.base}`, MARGIN, yPosition)
  yPosition += LINE_HEIGHT + SECTION_SPACING

  // 2. Scope
  drawSectionHeading('2. Scope')
  const scopeLines = doc.splitTextToSize(data.scope, 170)
  doc.text(scopeLines, MARGIN, yPosition)
  yPosition += scopeLines.length * LINE_HEIGHT + SECTION_SPACING

  // 3. Audit Team
  drawSectionHeading('3. Audit Team')
  doc.text(`Auditors: ${data.auditors.join(', ')}`, MARGIN, yPosition)
  yPosition += LINE_HEIGHT
  doc.text(`Auditees: ${data.auditees.join(', ')}`, MARGIN, yPosition)
  yPosition += LINE_HEIGHT + SECTION_SPACING

  // 4. Executive Summary
  const summary = data.executiveSummary
  if (summary) {
    drawSectionHeading('4. Executive Summary')
    doc.text(`Overall Result: ${summary.overallResult}`, MARGIN, yPosition)
    yPosition += LINE_HEIGHT
    doc.text(`Number of Checklist Items Reviewed: ${summary.checklistItemsReviewed}`, MARGIN, yPosition)
    yPosition += LINE_HEIGHT
    doc.text(`Number of Findings: ${summary.numberOfFindings}`, MARGIN, yPosition)
    yPosition += LINE_HEIGHT
    const summaryLines = doc.splitTextToSize(summary.complianceSummary, 170)
    doc.text(summaryLines, MARGIN, yPosition)
    yPosition += summaryLines.length * LINE_HEIGHT + SECTION_SPACING
  }

  // 5. Checklist Items
  if (data.checklistItems && data.checklistItems.length > 0) {
    drawSectionHeading('5. Checklist Items')
    data.checklistItems.forEach((item, index) => {
      if (yPosition > PAGE_BREAK_Y) {
        doc.addPage()
        yPosition = PAGE_TOP
      }

      // Item number
      doc.setFont('helvetica', 'bold')
      doc.text(`Item ${index + 1}`, MARGIN, yPosition)
      yPosition += LINE_HEIGHT

      // Ref
      doc.setFont('helvetica', 'normal')
      doc.text(`Ref: ${item.ref ?? '—'}`, MARGIN, yPosition)
      yPosition += LINE_HEIGHT

      // Audit question
      doc.setFont('helvetica', 'bold')
      doc.text('Audit question:', MARGIN, yPosition)
      yPosition += LINE_HEIGHT
      doc.setFont('helvetica', 'normal')
      const questionLines = doc.splitTextToSize(item.content, 170)
      doc.text(questionLines, MARGIN, yPosition)
      yPosition += questionLines.length * LINE_HEIGHT

      // Category (documented/implemented status)
      doc.text(`Category: ${item.documentedImplementedLabel}`, MARGIN, yPosition)
      yPosition += LINE_HEIGHT
      doc.text(`Compliance: ${item.compliance}`, MARGIN, yPosition)
      yPosition += LINE_HEIGHT

      if (item.compliance === 'Compliant') {
        const evidenceText = (item.objectiveEvidence ?? '').trim() || '—'
        doc.text('Objective Evidence:', MARGIN, yPosition)
        yPosition += LINE_HEIGHT
        const evidenceLines = doc.splitTextToSize(evidenceText, 165)
        doc.text(evidenceLines, MARGIN + 5, yPosition)
        yPosition += evidenceLines.length * LINE_HEIGHT
      } else if (item.compliance === 'Non-Compliant' && item.findings && item.findings.length > 0) {
        doc.text('Findings:', MARGIN, yPosition)
        yPosition += LINE_HEIGHT
        item.findings.forEach((f) => {
          if (yPosition > PAGE_BREAK_Y) {
            doc.addPage()
            yPosition = PAGE_TOP
          }
          const priorityLabel = f.priority ?? '—'
          doc.setFont('helvetica', 'bold')
          doc.text(`  • ${f.findingNumber} (${priorityLabel})`, MARGIN, yPosition)
          yPosition += LINE_HEIGHT
          doc.setFont('helvetica', 'normal')
          const fLines = doc.splitTextToSize(f.description ?? '', 165)
          doc.text(fLines, MARGIN + 5, yPosition)
          yPosition += fLines.length * LINE_HEIGHT + 3
        })
        yPosition += 3
      }

      yPosition += SECTION_SPACING
    })
    yPosition += SECTION_SPACING
  }

  // 6. Conclusion
  if (data.conclusion && data.conclusion.trim()) {
    drawSectionHeading('6. Conclusion')
    const conclusionLines = doc.splitTextToSize(data.conclusion, 170)
    doc.text(conclusionLines, MARGIN, yPosition)
    yPosition += conclusionLines.length * LINE_HEIGHT + SECTION_SPACING
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  const generatedDate = data.generatedDate ?? new Date().toLocaleDateString()
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
      `Generated on ${generatedDate}`,
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
