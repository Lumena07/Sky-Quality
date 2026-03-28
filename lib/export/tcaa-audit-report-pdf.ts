import { jsPDF } from 'jspdf'

export type TcaaAuditReportPdfAuditRow = {
  auditNumber: string
  title: string
  status: string
  departmentName?: string | null
  findingsCount: number
}

export type TcaaAuditReportPdfQualityObjectiveRow = {
  year: number
  objectiveSummary: string
}

export type TcaaAuditReportPdfInput = {
  operatorLegalName?: string | null
  aocNumber?: string | null
  reportFooterText?: string | null
  periodLabel: string
  reportType: string
  periodStart: string
  periodEnd: string
  executiveSummaryText?: string | null
  generatedAt?: string | null
  audits: TcaaAuditReportPdfAuditRow[]
  findingsByStatus: Record<string, number>
  capOpen: number
  capClosed: number
  auditPlans: {
    name: string
    intervalMonths: number
    lastDoneDate: string | null
    departmentName?: string | null
  }[]
  qualityObjectivesRows: TcaaAuditReportPdfQualityObjectiveRow[]
}

const NAVY: [number, number, number] = [27, 58, 107]
const ACCENT_BLUE: [number, number, number] = [46, 134, 193]
const GREEN: [number, number, number] = [30, 132, 73]
const ORANGE: [number, number, number] = [212, 104, 10]
const RED: [number, number, number] = [192, 57, 43]
const LIGHT_BLUE_FILL: [number, number, number] = [235, 245, 251]
const ALT_ROW: [number, number, number] = [245, 247, 250]
const GREY_TEXT: [number, number, number] = [120, 120, 120]

const FOOTER_RESERVE_MM = 16
const PAGE_MARGIN = 14
const BAR_W_MM = 1

const formatPeriodDate = (iso: string): string => {
  const d = iso.slice(0, 10)
  return d || '—'
}

const auditStatusBadgeStyle = (
  status: string
): { label: string; rgb: [number, number, number] } => {
  const s = status.toUpperCase()
  if (s === 'PLANNED') return { label: 'PLANNED', rgb: ACCENT_BLUE }
  if (s === 'ACTIVE') return { label: 'ACTIVE', rgb: ORANGE }
  if (s === 'CLOSED' || s === 'COMPLETED') {
    return { label: s === 'COMPLETED' ? 'COMPLETED' : 'CLOSED', rgb: GREEN }
  }
  return { label: status || '—', rgb: GREY_TEXT as [number, number, number] }
}

const addWrappedText = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeightMm: number
): number => {
  const lines = doc.splitTextToSize(text, maxWidth)
  doc.text(lines, x, y)
  return y + lines.length * lineHeightMm
}

const ensureSpace = (doc: jsPDF, y: number, needMm: number, pageH: number): number => {
  const limit = pageH - FOOTER_RESERVE_MM
  if (y + needMm > limit) {
    doc.addPage()
    return PAGE_MARGIN
  }
  return y
}

const drawSectionHeading = (doc: jsPDF, margin: number, y: number, title: string, countBadge?: string): number => {
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2])
  doc.rect(margin, y - 3.8, BAR_W_MM, 6.2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  const titleX = margin + 3.5
  doc.text(title, titleX, y)
  if (countBadge !== undefined) {
    const tw = doc.getTextWidth(title)
    const bx = titleX + tw + 3
    doc.setFontSize(7)
    const badgeW = Math.max(9, doc.getTextWidth(countBadge) + 3.5)
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2])
    doc.roundedRect(bx, y - 4.6, badgeW, 5.8, 0.6, 0.6, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(countBadge, bx + 2, y - 0.9)
  }
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  return y + 9
}

const drawRoundedBadge = (
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  rgb: [number, number, number]
): void => {
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  const padX = 2
  const w = doc.getTextWidth(label) + padX * 2
  const h = 4.5
  doc.setFillColor(rgb[0], rgb[1], rgb[2])
  doc.roundedRect(x, y - 3.2, w, h, 0.8, 0.8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text(label, x + padX, y)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
}

/** Clock face drawn with primitives — avoids Unicode (hourglass) unsupported by standard PDF fonts. */
const drawCapOpenWorkflowIcon = (
  doc: jsPDF,
  leftMm: number,
  topMm: number,
  rgb: [number, number, number]
): void => {
  const cx = leftMm + 3.6
  const cy = topMm + 5.8
  doc.setDrawColor(rgb[0], rgb[1], rgb[2])
  doc.setLineWidth(0.45)
  doc.circle(cx, cy, 3.2, 'S')
  doc.line(cx, cy, cx - 0.1, cy - 2.1)
  doc.line(cx, cy, cx + 1.9, cy + 0.5)
  doc.setLineWidth(0.2)
  doc.setDrawColor(0, 0, 0)
}

/** Check mark from line segments — avoids Unicode check glyph unsupported by standard PDF fonts. */
const drawCapClosedIcon = (
  doc: jsPDF,
  leftMm: number,
  topMm: number,
  rgb: [number, number, number]
): void => {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2])
  doc.setLineWidth(0.55)
  const x0 = leftMm + 1.4
  const y0 = topMm + 5.6
  const x1 = leftMm + 3.6
  const y1 = topMm + 7.9
  const x2 = leftMm + 7.0
  const y2 = topMm + 3.4
  doc.line(x0, y0, x1, y1)
  doc.line(x1, y1, x2, y2)
  doc.setLineWidth(0.2)
  doc.setDrawColor(0, 0, 0)
}

const drawFooters = (doc: jsPDF, input: TcaaAuditReportPdfInput, margin: number, maxW: number, pageW: number) => {
  const pages = doc.getNumberOfPages()
  const pageH = doc.internal.pageSize.getHeight()
  const generated = formatPeriodDate(input.generatedAt ?? new Date().toISOString())
  const custom = (input.reportFooterText ?? '').trim()

  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    const isLast = p === pages
    let fy = pageH - 11

    if (isLast && custom) {
      doc.setFontSize(8)
      doc.setTextColor(80, 80, 80)
      const block = doc.splitTextToSize(custom, maxW)
      const blockH = block.length * 3.6
      fy -= blockH + 2
      doc.text(block, margin, fy)
      fy += blockH + 3
    }

    doc.setDrawColor(220, 223, 230)
    doc.setLineWidth(0.35)
    doc.line(margin, fy - 4, pageW - margin, fy - 4)

    doc.setFontSize(8)
    doc.setTextColor(90, 90, 90)
    doc.text('Generated by Sky Aero QMS System', margin, fy)
    doc.text(`Printed: ${generated}`, pageW - margin, fy, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }
}

const findingCardCounts = (by: Record<string, number>) => {
  const n = (k: string) => by[k] ?? 0
  return {
    open: n('OPEN'),
    inProgress: n('IN_PROGRESS') + n('UNDER_REVIEW') + n('OVERDUE'),
    closed: n('CLOSED'),
  }
}

export const buildTcaaAuditReportPdf = (input: TcaaAuditReportPdfInput): Buffer => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = PAGE_MARGIN
  const maxW = pageW - margin * 2
  let y = margin

  const aoc = input.aocNumber?.trim() || '—'
  const periodStr = `${formatPeriodDate(input.periodStart)} to ${formatPeriodDate(input.periodEnd)}`
  const subtitle = `${input.periodLabel} | ${aoc} | Period: ${periodStr}`

  // 1. REPORT HEADER
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  y = addWrappedText(doc, 'TCAA / QMS Audit Report', margin, y, maxW, 7)
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(50, 50, 50)
  y = addWrappedText(doc, subtitle, margin, y + 1, maxW, 5)
  doc.setTextColor(0, 0, 0)
  y += 3
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2])
  doc.setLineWidth(0.9)
  doc.line(margin, y, margin + maxW, y)
  y += 8

  // 2. OPERATOR DETAILS
  y = drawSectionHeading(doc, margin, y, 'OPERATOR DETAILS')
  const genDate = formatPeriodDate(input.generatedAt ?? new Date().toISOString())
  const legal = input.operatorLegalName?.trim() || '—'
  const colGap = 6
  const colW = (maxW - colGap) / 2
  const x2 = margin + colW + colGap
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(60, 60, 60)
  doc.text('Legal Name', margin, y)
  doc.text('Report Period', x2, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(legal, margin, y)
  doc.text(`${input.periodLabel} (${periodStr})`, x2, y)
  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(60, 60, 60)
  doc.text('AOC Number', margin, y)
  doc.text('Generated Date', x2, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(aoc, margin, y)
  doc.text(genDate, x2, y)
  y += 10

  // 3. EXECUTIVE SUMMARY
  y = ensureSpace(doc, y, 28, pageH)
  y = drawSectionHeading(doc, margin, y, 'EXECUTIVE SUMMARY')
  const summaryText =
    (input.executiveSummaryText ?? '').trim() || 'No executive summary was provided for this report.'
  const cardPad = 4
  const cardInnerW = maxW - cardPad * 2 - 2
  const summaryLines = doc.splitTextToSize(summaryText, cardInnerW)
  const cardH = Math.max(16, summaryLines.length * 4.2 + cardPad * 2 + 2)
  y = ensureSpace(doc, y, cardH + 4, pageH)
  doc.setFillColor(LIGHT_BLUE_FILL[0], LIGHT_BLUE_FILL[1], LIGHT_BLUE_FILL[2])
  doc.rect(margin + 2, y, maxW - 2, cardH, 'F')
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2])
  doc.rect(margin, y, 1.2, cardH, 'F')
  doc.setFontSize(9)
  doc.setTextColor(30, 30, 30)
  doc.text(summaryLines, margin + 2 + cardPad, y + cardPad + 3.5)
  doc.setTextColor(0, 0, 0)
  y += cardH + 8

  // 4. AUDITS IN PERIOD
  const auditCount = input.audits.length
  y = ensureSpace(doc, y, 22, pageH)
  y = drawSectionHeading(doc, margin, y, 'AUDITS IN PERIOD', String(auditCount))

  const colAuditId = margin + 2
  const wAuditId = 22
  const colTitle = colAuditId + wAuditId
  const wTitle = 62
  const colStatus = colTitle + wTitle
  const colDept = colStatus + 24
  const wDept = 38
  const colFind = colDept + wDept
  const cp = margin + 2

  const headerH = 7
  y = ensureSpace(doc, y, headerH + 6, pageH)
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2])
  doc.rect(margin, y, maxW, headerH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text('Audit ID', colAuditId, y + 5)
  doc.text('Title', colTitle, y + 5)
  doc.text('Status', colStatus, y + 5)
  doc.text('Department', colDept, y + 5)
  doc.text('Findings', colFind, y + 5)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  y += headerH

  let rowIdx = 0
  for (const a of input.audits) {
    const titleLines = doc.splitTextToSize(a.title || '—', wTitle - 1)
    const rowBodyH = Math.max(6, titleLines.length * 3.8 + 3)
    y = ensureSpace(doc, y, rowBodyH + 2, pageH)
    const fill = rowIdx % 2 === 0 ? ALT_ROW : ([255, 255, 255] as [number, number, number])
    doc.setFillColor(fill[0], fill[1], fill[2])
    doc.rect(margin, y, maxW, rowBodyH, 'F')
    doc.setDrawColor(230, 232, 237)
    doc.rect(margin, y, maxW, rowBodyH, 'S')

    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)
    doc.text(a.auditNumber || '—', colAuditId, y + 5)
    doc.text(titleLines, colTitle, y + 4.5)

    const badge = auditStatusBadgeStyle(a.status)
    drawRoundedBadge(doc, colStatus, y + 5, badge.label, badge.rgb)

    const dept = a.departmentName?.trim() || '—'
    doc.setFont('helvetica', 'normal')
    doc.text(doc.splitTextToSize(dept, wDept - 1), colDept, y + 4.5)

    doc.setFont('helvetica', 'bold')
    if (a.findingsCount > 0) {
      doc.setTextColor(RED[0], RED[1], RED[2])
    } else {
      doc.setTextColor(GREY_TEXT[0], GREY_TEXT[1], GREY_TEXT[2])
    }
    doc.text(String(a.findingsCount), colFind, y + 5)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')

    y += rowBodyH
    rowIdx += 1
  }

  if (input.audits.length === 0) {
    y = ensureSpace(doc, y, 10, pageH)
    doc.setFillColor(ALT_ROW[0], ALT_ROW[1], ALT_ROW[2])
    doc.rect(margin, y, maxW, 8, 'F')
    doc.setFontSize(8)
    doc.setTextColor(GREY_TEXT[0], GREY_TEXT[1], GREY_TEXT[2])
    doc.text('No audits in this period.', margin + 2, y + 5.5)
    doc.setTextColor(0, 0, 0)
    y += 10
  }
  y += 6

  // 5. FINDINGS SUMMARY
  y = ensureSpace(doc, y, 32, pageH)
  y = drawSectionHeading(doc, margin, y, 'FINDINGS SUMMARY')
  const fc = findingCardCounts(input.findingsByStatus)
  const gap = 4
  const cardW = (maxW - gap * 2) / 3
  const cardH2 = 22
  const cards: { label: string; value: number; rgb: [number, number, number] }[] = [
    { label: 'OPEN', value: fc.open, rgb: RED },
    { label: 'IN_PROGRESS', value: fc.inProgress, rgb: ORANGE },
    { label: 'CLOSED', value: fc.closed, rgb: GREEN },
  ]
  for (let i = 0; i < 3; i++) {
    const cx = margin + i * (cardW + gap)
    doc.setDrawColor(220, 223, 230)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(cx, y, cardW, cardH2, 1.2, 1.2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(cards[i].rgb[0], cards[i].rgb[1], cards[i].rgb[2])
    doc.text(String(cards[i].value), cx + cardW / 2, y + 12, { align: 'center' })
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text(cards[i].label, cx + cardW / 2, y + 18, { align: 'center' })
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
  }
  y += cardH2 + 10

  // 6. CAP RECORDS
  y = ensureSpace(doc, y, 28, pageH)
  y = drawSectionHeading(doc, margin, y, 'CAP RECORDS')
  const capGap = 5
  const capCardW = (maxW - capGap) / 2
  const capCardH = 18
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(220, 223, 230)
  doc.roundedRect(margin, y, capCardW, capCardH, 1.2, 1.2, 'FD')
  doc.roundedRect(margin + capCardW + capGap, y, capCardW, capCardH, 1.2, 1.2, 'FD')
  drawCapOpenWorkflowIcon(doc, margin + 1, y + 1, ORANGE)
  drawCapClosedIcon(doc, margin + capCardW + capGap + 1, y + 1, GREEN)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(String(input.capOpen), margin + 12, y + 9)
  doc.text(String(input.capClosed), margin + capCardW + capGap + 12, y + 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(80, 80, 80)
  doc.text('Open workflow', margin + 3, y + 15)
  doc.text('Closed', margin + capCardW + capGap + 3, y + 15)
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(10)
  y += capCardH + 10

  // 7. QUALITY PROGRAMME
  y = ensureSpace(doc, y, 22, pageH)
  y = drawSectionHeading(doc, margin, y, 'QUALITY PROGRAMME')
  const hProg = 7
  y = ensureSpace(doc, y, hProg + 6, pageH)
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2])
  doc.rect(margin, y, maxW, hProg, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text('Programme', cp, y + 5)
  doc.text('Frequency', cp + 48, y + 5)
  doc.text('Last Completed', cp + 78, y + 5)
  doc.text('Department', cp + 118, y + 5)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  y += hProg

  let pIdx = 0
  for (const p of input.auditPlans) {
    const lastStr = p.lastDoneDate ? formatPeriodDate(p.lastDoneDate) : 'Not recorded'
    const freq = `Every ${p.intervalMonths} mo.`
    const rowH = 8
    y = ensureSpace(doc, y, rowH, pageH)
    const bg = pIdx % 2 === 0 ? ALT_ROW : ([255, 255, 255] as [number, number, number])
    doc.setFillColor(bg[0], bg[1], bg[2])
    doc.rect(margin, y, maxW, rowH, 'F')
    doc.setDrawColor(230, 232, 237)
    doc.rect(margin, y, maxW, rowH, 'S')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(p.name, cp, y + 5.5)
    doc.text(freq, cp + 48, y + 5.5)
    if (!p.lastDoneDate) {
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(GREY_TEXT[0], GREY_TEXT[1], GREY_TEXT[2])
      doc.text(lastStr, cp + 78, y + 5.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
    } else {
      doc.text(lastStr, cp + 78, y + 5.5)
    }
    doc.text(p.departmentName?.trim() || '—', cp + 118, y + 5.5)
    y += rowH
    pIdx += 1
  }
  if (input.auditPlans.length === 0) {
    y = ensureSpace(doc, y, 8, pageH)
    doc.setFillColor(ALT_ROW[0], ALT_ROW[1], ALT_ROW[2])
    doc.rect(margin, y, maxW, 8, 'F')
    doc.setFontSize(8)
    doc.setTextColor(GREY_TEXT[0], GREY_TEXT[1], GREY_TEXT[2])
    doc.text('No audit plans on file.', margin + 2, y + 5.5)
    y += 8
  }
  y += 8

  // 8. QUALITY OBJECTIVES
  y = ensureSpace(doc, y, 22, pageH)
  y = drawSectionHeading(doc, margin, y, 'QUALITY OBJECTIVES')
  const hQ = 7
  y = ensureSpace(doc, y, hQ + 6, pageH)
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2])
  doc.rect(margin, y, maxW, hQ, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text('Year', cp, y + 5)
  doc.text('Objective', cp + 22, y + 5)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  y += hQ

  let qIdx = 0
  for (const q of input.qualityObjectivesRows) {
    const isNotRecorded = !q.objectiveSummary || q.objectiveSummary === 'Not recorded'
    const objLines = isNotRecorded ? ['Not recorded'] : doc.splitTextToSize(q.objectiveSummary, maxW - 28)
    const rowHq = Math.max(8, objLines.length * 3.8 + 3)
    y = ensureSpace(doc, y, rowHq, pageH)
    const bgq = qIdx % 2 === 0 ? ALT_ROW : ([255, 255, 255] as [number, number, number])
    doc.setFillColor(bgq[0], bgq[1], bgq[2])
    doc.rect(margin, y, maxW, rowHq, 'F')
    doc.setDrawColor(230, 232, 237)
    doc.rect(margin, y, maxW, rowHq, 'S')
    doc.setFontSize(8)
    doc.text(String(q.year), cp, y + 5.5)
    if (isNotRecorded) {
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(GREY_TEXT[0], GREY_TEXT[1], GREY_TEXT[2])
      doc.text('Not recorded', cp + 22, y + 5.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
    } else {
      doc.text(objLines, cp + 22, y + 4.5)
    }
    y += rowHq
    qIdx += 1
  }
  if (input.qualityObjectivesRows.length === 0) {
    y = ensureSpace(doc, y, 8, pageH)
    doc.setFillColor(ALT_ROW[0], ALT_ROW[1], ALT_ROW[2])
    doc.rect(margin, y, maxW, 8, 'F')
    doc.setFontSize(8)
    doc.setTextColor(GREY_TEXT[0], GREY_TEXT[1], GREY_TEXT[2])
    doc.text('No quality objectives on file.', margin + 2, y + 5.5)
    y += 8
  }

  drawFooters(doc, input, margin, maxW, pageW)

  const out = doc.output('arraybuffer')
  return Buffer.from(out)
}
