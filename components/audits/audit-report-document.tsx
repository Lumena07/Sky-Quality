'use client'

import type {
  AuditReportData,
  ChecklistItemReport,
  FindingReport,
} from '@/lib/export/pdf'

interface AuditReportDocumentProps {
  data: AuditReportData
}

const getComplianceBadgeClass = (compliance: string): string => {
  switch (compliance) {
    case 'Compliant':
      return 'report-badge report-badge-compliant'
    case 'Non-Compliant':
      return 'report-badge report-badge-noncompliant'
    case 'Partially Compliant':
      return 'report-badge report-badge-partial'
    default:
      return 'report-badge report-badge-neutral'
  }
}

const getPriorityBadgeClass = (priority: string | null | undefined): string => {
  if (!priority) return 'report-badge report-badge-priority'
  const p = String(priority).toUpperCase()
  if (p === 'P1') return 'report-badge report-badge-p1'
  if (p === 'P2') return 'report-badge report-badge-p2'
  if (p === 'P3') return 'report-badge report-badge-p3'
  return 'report-badge report-badge-priority'
}

export const AuditReportDocument = ({ data }: AuditReportDocumentProps) => {
  const reportTitle = data.reportTitle ?? `${data.title} Audit Report`
  const summary = data.executiveSummary

  return (
    <article className="audit-report" role="document" aria-label="Audit Report">
      <header className="report-header">
        <h1 className="report-title">{reportTitle}</h1>
      </header>

      <main className="report-main">
        <section className="report-section">
          <h2 className="report-section-title">1. Audit Details</h2>
          <div className="report-details-grid">
            <div className="report-detail-item">
              <span className="report-detail-label">Audit Number</span>
              <span className="report-detail-value">{data.auditNumber}</span>
            </div>
            <div className="report-detail-item">
              <span className="report-detail-label">Audit Date</span>
              <span className="report-detail-value">{data.auditDate}</span>
            </div>
            <div className="report-detail-item">
              <span className="report-detail-label">Department</span>
              <span className="report-detail-value">{data.department}</span>
            </div>
            <div className="report-detail-item">
              <span className="report-detail-label">Base/Location</span>
              <span className="report-detail-value">{data.base}</span>
            </div>
          </div>
        </section>

        <section className="report-section">
          <h2 className="report-section-title">2. Scope</h2>
          <p className="report-body-text">{data.scope}</p>
        </section>

        <section className="report-section">
          <h2 className="report-section-title">3. Audit Team</h2>
          <div className="report-team-block">
            <p className="report-body-text">
              <strong>Auditors:</strong>{' '}
              {data.auditors.length > 0 ? data.auditors.join(', ') : '—'}
            </p>
            <p className="report-body-text">
              <strong>Auditees:</strong>{' '}
              {data.auditees.length > 0 ? data.auditees.join(', ') : '—'}
            </p>
          </div>
        </section>

        {summary && (
          <section className="report-section report-section-summary">
            <h2 className="report-section-title">4. Executive Summary</h2>
            <div className="report-summary-grid">
              <div className="report-summary-item">
                <span className="report-detail-label">Overall Result</span>
                <span className="report-detail-value">{summary.overallResult}</span>
              </div>
              <div className="report-summary-item">
                <span className="report-detail-label">
                  Number of Checklist Items Reviewed
                </span>
                <span className="report-detail-value">
                  {summary.checklistItemsReviewed}
                </span>
              </div>
              <div className="report-summary-item">
                <span className="report-detail-label">Number of Findings</span>
                <span className="report-detail-value">
                  {summary.numberOfFindings}
                </span>
              </div>
            </div>
            <p className="report-body-text report-compliance-summary">
              <strong>Compliance Summary:</strong> {summary.complianceSummary}
            </p>
          </section>
        )}

        {data.checklistItems && data.checklistItems.length > 0 && (
          <section className="report-section">
            <h2 className="report-section-title">5. Checklist Items</h2>
            <div className="report-checklist-list">
              {data.checklistItems.map((item: ChecklistItemReport, index: number) => (
                <ChecklistItemCard
                  key={index}
                  item={item}
                  index={index}
                  getComplianceBadgeClass={getComplianceBadgeClass}
                  getPriorityBadgeClass={getPriorityBadgeClass}
                />
              ))}
            </div>
          </section>
        )}

        {data.conclusion && data.conclusion.trim() && (
          <section className="report-section">
            <h2 className="report-section-title">6. Conclusion</h2>
            <p className="report-body-text">{data.conclusion}</p>
          </section>
        )}
      </main>

      <footer className="report-footer">
        <p className="report-footer-text">
          Generated on {data.generatedDate}
        </p>
      </footer>
    </article>
  )
}

interface ChecklistItemCardProps {
  item: ChecklistItemReport
  index: number
  getComplianceBadgeClass: (c: string) => string
  getPriorityBadgeClass: (p: string | null | undefined) => string
}

const ChecklistItemCard = ({
  item,
  index,
  getComplianceBadgeClass,
  getPriorityBadgeClass,
}: ChecklistItemCardProps) => (
  <div className="report-card">
    <div className="report-card-header">
      <span className="report-card-item-num">Item {index + 1}</span>
      <span className="report-card-ref">Ref: {item.ref ?? '—'}</span>
    </div>
    <div className="report-card-body">
      <p className="report-card-label">Audit question</p>
      <p className="report-card-question">{item.content}</p>
      <div className="report-card-meta">
        <span className="report-meta-label">Category:</span>
        <span className="report-meta-value">{item.documentedImplementedLabel}</span>
      </div>
      <div className="report-card-meta">
        <span className="report-meta-label">Compliance:</span>
        <span className={getComplianceBadgeClass(item.compliance)}>
          {item.compliance}
        </span>
      </div>
      {item.compliance === 'Compliant' && (
        <div className="report-card-evidence">
          <p className="report-card-label">Objective Evidence</p>
          <p className="report-body-text">
            {(item.objectiveEvidence ?? '').trim() || '—'}
          </p>
        </div>
      )}
      {item.compliance === 'Non-Compliant' &&
        item.findings &&
        item.findings.length > 0 && (
          <div className="report-card-findings">
            <p className="report-card-label">Findings</p>
            <ul className="report-findings-list">
              {item.findings.map((f: FindingReport, i: number) => (
                <li key={i} className="report-finding-item">
                  <span className="report-finding-header">
                    <span className="report-finding-number">{f.findingNumber}</span>
                    <span className={getPriorityBadgeClass(f.priority)}>
                      {f.priority ?? '—'}
                    </span>
                  </span>
                  <p className="report-finding-description">{f.description || '—'}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  </div>
)
