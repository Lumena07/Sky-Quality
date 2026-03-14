'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AuditReportDocument } from '@/components/audits/audit-report-document'
import type { AuditReportData, ChecklistItemReport } from '@/lib/export/pdf'
import { formatDate, formatDateOnly } from '@/lib/utils'
import '@/app/audit-report.css'

const DOCUMENTED_IMPLEMENTED_LABELS: Record<string, string> = {
  DOCUMENTED_IMPLEMENTED: 'Documented and Implemented',
  DOCUMENTED_NOT_IMPLEMENTED: 'Documented and Not Implemented',
  NOT_DOCUMENTED_IMPLEMENTED: 'Not Documented and Implemented',
  NOT_DOCUMENTED_NOT_IMPLEMENTED: 'Not Documented and Not Implemented',
}

const normalizeItems = (checklist: any): any[] => {
  if (!checklist) return []
  const raw =
    checklist.Items ?? checklist.ChecklistItem ?? checklist.items ?? []
  return Array.isArray(raw) ? raw : []
}

export default function AuditReportPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const reportContainerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<AuditReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const autoDownloadAttempted = useRef(false)

  useEffect(() => {
    if (!params.id || typeof params.id !== 'string') return

    const fetchReportData = async () => {
      setLoading(true)
      setError(null)
      try {
        const auditRes = await fetch(`/api/audits/${params.id}`)
        if (!auditRes.ok) {
          setError('Audit not found')
          return
        }
        const audit = await auditRes.json()

        let responsesToUse: any[] = []
        try {
          const responsesRes = await fetch(
            `/api/audits/${params.id}/checklist/responses`
          )
          if (responsesRes.ok) {
            const responsesData = await responsesRes.json()
            responsesToUse = Array.isArray(responsesData) ? responsesData : []
          }
        } catch {
          // no responses
        }

        const auditFindings = audit.Findings ?? audit.findings ?? []
        const auditFindingsById = new Map(
          auditFindings.map((f: any) => [f.id, f])
        )
        const auditFindingsByNumber = new Map(
          auditFindings.map((f: any) => [f.findingNumber, f])
        )
        const checklistData = audit.Checklist ?? audit.checklist
        const items = normalizeItems(checklistData)
        const itemsById = new Map(items.map((item: any) => [item.id, item]))

        const getRef = (r: any, item: any) =>
          r?.ChecklistItem?.ref ??
          r?.checklist_item?.ref ??
          item?.ref ??
          '—'
        const getAuditQuestion = (r: any, item: any) =>
          r?.ChecklistItem?.auditQuestion ??
          r?.ChecklistItem?.audit_question ??
          r?.checklist_item?.auditQuestion ??
          r?.checklist_item?.audit_question ??
          item?.auditQuestion ??
          item?.audit_question ??
          item?.content ??
          item?.text ??
          '—'
        const getStatus = (r: any) =>
          r?.documentedImplementedStatus ?? r?.documented_implemented_status
        const getCompliant = (r: any) => r?.isCompliant ?? r?.is_compliant
        const getNotes = (r: any) => r?.notes ?? null

        const checklistItems: ChecklistItemReport[] =
          responsesToUse.length > 0
            ? responsesToUse.map((response: any) => {
                const cid =
                  response.checklistItemId ?? response.checklist_item_id
                const item = cid ? itemsById.get(cid) : null
                const documentedImplementedStatus = getStatus(response)
                const documentedImplementedLabel =
                  documentedImplementedStatus != null
                    ? (DOCUMENTED_IMPLEMENTED_LABELS[
                        documentedImplementedStatus
                      ] ?? documentedImplementedStatus)
                    : '—'
                const isCompliant = getCompliant(response)
                const compliance: 'Compliant' | 'Non-Compliant' | 'Not reviewed' =
                  isCompliant === true
                    ? 'Compliant'
                    : isCompliant === false
                      ? 'Non-Compliant'
                      : 'Not reviewed'
                const responseFindings = response?.findings ?? []
                const findingsForReport: {
                  findingNumber: string
                  description: string
                  priority: string | null
                }[] = responseFindings.map((f: any) => {
                  const full =
                    auditFindingsById.get(f.id) ??
                    auditFindingsByNumber.get(f.findingNumber)
                  return {
                    findingNumber: f.findingNumber ?? (full as any)?.findingNumber ?? '—',
                    description: f.description ?? (full as any)?.description ?? '',
                    priority: (full as any)?.priority ?? f.priority ?? null,
                  }
                })
                return {
                  ref: getRef(response, item),
                  content: getAuditQuestion(response, item),
                  documentedImplementedLabel,
                  compliance,
                  objectiveEvidence: getNotes(response),
                  findings:
                    findingsForReport.length > 0 ? findingsForReport : undefined,
                }
              })
            : items.map((item: any) => {
                const response = responsesToUse.find(
                  (r: any) =>
                    (r.checklistItemId ?? r.checklist_item_id) === item.id
                )
                const documentedImplementedLabel =
                  getStatus(response) != null
                    ? (DOCUMENTED_IMPLEMENTED_LABELS[getStatus(response)!] ??
                        getStatus(response))
                    : '—'
                const isCompliant = getCompliant(response)
                const compliance: 'Compliant' | 'Non-Compliant' | 'Not reviewed' =
                  isCompliant === true
                    ? 'Compliant'
                    : isCompliant === false
                      ? 'Non-Compliant'
                      : 'Not reviewed'
                const responseFindings = response?.findings ?? []
                const findingsForReport: {
                  findingNumber: string
                  description: string
                  priority: string | null
                }[] = responseFindings.map((f: any) => {
                  const full =
                    auditFindingsById.get(f.id) ??
                    auditFindingsByNumber.get(f.findingNumber)
                  return {
                    findingNumber: f.findingNumber ?? (full as any)?.findingNumber ?? '—',
                    description: f.description ?? (full as any)?.description ?? '',
                    priority: (full as any)?.priority ?? f.priority ?? null,
                  }
                })
                return {
                  ref: item.ref ?? null,
                  content:
                    item.auditQuestion ??
                    item.audit_question ??
                    item.content ??
                    item.text ??
                    '—',
                  documentedImplementedLabel,
                  compliance,
                  objectiveEvidence: getNotes(response),
                  findings:
                    findingsForReport.length > 0 ? findingsForReport : undefined,
                }
              })

        let compliantCount = 0
        let nonCompliantCount = 0
        let notReviewedCount = 0
        let totalFindings = 0
        checklistItems.forEach((item) => {
          if (item.compliance === 'Compliant') compliantCount++
          else if (item.compliance === 'Non-Compliant') nonCompliantCount++
          else notReviewedCount++
          if (item.findings) totalFindings += item.findings.length
        })
        const overallResult =
          nonCompliantCount > 0
            ? 'Non-compliant items identified; findings raised.'
            : notReviewedCount > 0
              ? 'Partially reviewed; no non-compliances identified to date.'
              : 'All reviewed items compliant.'

        const reportPayload: AuditReportData = {
          auditNumber: audit.auditNumber,
          title: audit.title,
          reportTitle: `${audit.title} Audit Report`,
          auditDate: audit.startDate
            ? formatDateOnly(String(audit.startDate))
            : '—',
          department: audit.department?.name ?? 'N/A',
          base: audit.base ?? '—',
          scope: audit.scope ?? '—',
          auditors: (audit.Auditors ?? audit.auditors ?? []).map((a: any) =>
            a.Organization?.name ?? a.organization?.name
              ? (a.Organization ?? a.organization).name
              : a.User ?? a.user
                ? `${(a.User ?? a.user).firstName} ${(a.User ?? a.user).lastName}`
                : '—'
          ),
          auditees: (audit.Auditees ?? audit.auditees ?? []).map((a: any) =>
            a.Organization?.name ?? a.organization?.name
              ? (a.Organization ?? a.organization).name
              : a.User ?? a.user
                ? `${(a.User ?? a.user).firstName} ${(a.User ?? a.user).lastName}`
                : a.name ?? a.email ?? '—'
          ),
          executiveSummary: {
            overallResult,
            checklistItemsReviewed: checklistItems.length,
            numberOfFindings: totalFindings,
            complianceSummary: `Compliant: ${compliantCount}, Non-compliant: ${nonCompliantCount}, Not reviewed: ${notReviewedCount}.`,
            compliantCount,
            nonCompliantCount,
            notReviewedCount,
          },
          conclusion: '',
          generatedDate: new Date().toLocaleDateString(),
          checklistItems:
            checklistItems.length > 0 ? checklistItems : undefined,
        }

        setData(reportPayload)
      } catch (err) {
        setError('Failed to load report')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [params.id])

  const handleDownloadPdf = useCallback(async () => {
    if (!reportContainerRef.current || !data) return
    setDownloadingPdf(true)
    try {
      const html2pdf = (await import('html2pdf.js')).default
      const filename = `Audit-Report-${data.auditNumber}-${Date.now()}.pdf`
      const opt = {
        margin: 10,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      }
      await html2pdf().set(opt).from(reportContainerRef.current).save()
    } catch (err) {
      console.error('PDF download failed:', err)
    } finally {
      setDownloadingPdf(false)
    }
  }, [data])

  useEffect(() => {
    const autoDownload = searchParams.get('autoDownload') === '1'
    if (!autoDownload || !data || autoDownloadAttempted.current) return
    autoDownloadAttempted.current = true
    const timer = setTimeout(() => {
      handleDownloadPdf()
    }, 800)
    return () => clearTimeout(timer)
  }, [data, searchParams, handleDownloadPdf])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading report…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 p-4">
        <p className="text-gray-600">{error ?? 'Report not available'}</p>
        <Link href={`/audits/${params.id}`}>
          <Button variant="outline">Back to Audit</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-4xl mx-auto px-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Link href={`/audits/${params.id}`}>
            <Button variant="outline" size="sm">
              Back to Audit
            </Button>
          </Link>
          <Button
            variant="default"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            aria-label="Download PDF"
          >
            {downloadingPdf ? 'Generating…' : 'Download PDF'}
          </Button>
        </div>
        <div ref={reportContainerRef}>
          <AuditReportDocument data={data} />
        </div>
      </div>
    </div>
  )
}
