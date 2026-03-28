import jsPDF from 'jspdf'

/** Landscape matrix export: one row per user, columns from string key/value rows (same shape as Excel export). */
export const exportTrainingComplianceMatrixToPdf = (
  rows: Record<string, string>[],
  filename?: string
) => {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 8
  const maxY = pageH - margin
  let y = margin

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Training compliance matrix', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Generated ${new Date().toISOString().slice(0, 10)}`, margin, y)
  y += 6

  const colCount = Math.max(1, headers.length)
  const usableW = pageW - 2 * margin
  const colW = usableW / colCount
  const headerRowH = 10
  const dataRowH = 6

  const drawTableHeader = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    let x = margin
    for (const h of headers) {
      const lines = doc.splitTextToSize(h, colW - 1)
      doc.text(lines.slice(0, 3).join('\n'), x + 0.5, y + 3)
      x += colW
    }
    y += headerRowH
    doc.setFont('helvetica', 'normal')
  }

  drawTableHeader()

  for (const row of rows) {
    if (y + dataRowH > maxY) {
      doc.addPage()
      y = margin
      drawTableHeader()
    }
    doc.setFontSize(5.5)
    let x = margin
    for (const h of headers) {
      const cell = String(row[h] ?? '')
      const lines = doc.splitTextToSize(cell, colW - 1)
      doc.text(lines.slice(0, 2).join('\n'), x + 0.5, y + 3)
      x += colW
    }
    y += dataRowH
  }

  doc.save(filename || `Training-Compliance-${Date.now()}.pdf`)
}
