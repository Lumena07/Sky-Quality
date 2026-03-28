'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { canSeeTcaaMandatoryNotification } from '@/lib/permissions'

type FindingOption = { id: string; findingNumber: string; description: string | null; status: string }

type MeApiResponse = {
  roles?: unknown
  departmentId?: string | null
}

const TcaaMandatoryNotificationPage = () => {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [findings, setFindings] = useState<FindingOption[]>([])

  const [tcaaSubTab, setTcaaSubTab] = useState<'register' | 'reports'>('register')
  const [tcaaRows, setTcaaRows] = useState<any[]>([])
  const [tcaaLoading, setTcaaLoading] = useState(false)
  const [tcaaFindingId, setTcaaFindingId] = useState('')
  const [tcaaNotes, setTcaaNotes] = useState('')
  const [tcaaSaving, setTcaaSaving] = useState(false)

  const [reportLogs, setReportLogs] = useState<
    Array<{
      id: string
      reportType: string
      periodLabel: string
      generatedAt: string
      pdfFileUrl: string | null
      generatedById: string
      GeneratedBy?: { firstName?: string; lastName?: string; email?: string }
    }>
  >([])
  const [reportLogsLoading, setReportLogsLoading] = useState(false)
  const [reportKind, setReportKind] = useState<'QUARTERLY' | 'YEARLY'>('QUARTERLY')
  const [reportYear, setReportYear] = useState(() => new Date().getFullYear())
  const [reportQuarter, setReportQuarter] = useState<1 | 2 | 3 | 4>(() => {
    const m = new Date().getMonth()
    return (m < 3 ? 1 : m < 6 ? 2 : m < 9 ? 3 : 4) as 1 | 2 | 3 | 4
  })
  const [executiveSummary, setExecutiveSummary] = useState('')
  const [reportGenerating, setReportGenerating] = useState(false)
  const [qmsSettingsHint, setQmsSettingsHint] = useState<{ operatorLegalName?: string | null; aocNumber?: string | null } | null>(null)
  const [qmsIdentityLocked, setQmsIdentityLocked] = useState(false)
  const [qmsSettingsOperator, setQmsSettingsOperator] = useState('')
  const [qmsSettingsAoc, setQmsSettingsAoc] = useState('')
  const [qmsSettingsFooter, setQmsSettingsFooter] = useState('')
  const [qmsSettingsSaving, setQmsSettingsSaving] = useState(false)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((res): Promise<MeApiResponse> =>
        res.ok ? res.json() : Promise.resolve({})
      )
      .then((d) => {
        const r = Array.isArray(d.roles) ? (d.roles as string[]) : []
        if (!canSeeTcaaMandatoryNotification(r)) {
          router.replace('/dashboard')
          return
        }
        setChecked(true)
      })
      .catch(() => setChecked(true))
  }, [router])

  const fetchFindingsForPicker = async () => {
    try {
      const res = await fetch('/api/findings', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data)) return
      setFindings(
        data.map((f: any) => ({
          id: f.id,
          findingNumber: f.findingNumber,
          description: f.description ?? null,
          status: f.status,
        }))
      )
    } catch {
      setFindings([])
    }
  }

  const fetchTcaa = async () => {
    setTcaaLoading(true)
    try {
      const res = await fetch('/api/tcaa-mandatory-notifications', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setTcaaRows(Array.isArray(data) ? data : [])
      } else {
        setTcaaRows([])
      }
    } catch {
      setTcaaRows([])
    } finally {
      setTcaaLoading(false)
    }
  }

  useEffect(() => {
    if (!checked) return
    fetchFindingsForPicker()
    fetchTcaa()
  }, [checked])

  const fetchReportLogs = async () => {
    setReportLogsLoading(true)
    try {
      const res = await fetch('/api/qms/audit-reports', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setReportLogs(Array.isArray(data) ? data : [])
      } else {
        setReportLogs([])
      }
    } catch {
      setReportLogs([])
    } finally {
      setReportLogsLoading(false)
    }
  }

  useEffect(() => {
    if (!checked || tcaaSubTab !== 'reports') return
    fetchReportLogs()
    fetch('/api/qms/settings', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setQmsSettingsHint(d && typeof d === 'object' ? d : null)
        if (d && typeof d === 'object') {
          setQmsIdentityLocked(Boolean((d as { identityLocked?: boolean }).identityLocked))
          setQmsSettingsOperator(String(d.operatorLegalName ?? ''))
          setQmsSettingsAoc(String(d.aocNumber ?? ''))
          setQmsSettingsFooter(String(d.reportFooterText ?? ''))
        }
      })
      .catch(() => {
        setQmsSettingsHint(null)
        setQmsIdentityLocked(false)
      })
  }, [checked, tcaaSubTab])

  const getQuarterRangeUtc = (year: number, q: 1 | 2 | 3 | 4): { start: Date; end: Date; label: string } => {
    const starts = [`${year}-01-01`, `${year}-04-01`, `${year}-07-01`, `${year}-10-01`] as const
    const ends = [`${year}-03-31`, `${year}-06-30`, `${year}-09-30`, `${year}-12-31`] as const
    const idx = q - 1
    return {
      start: new Date(`${starts[idx]}T00:00:00.000Z`),
      end: new Date(`${ends[idx]}T23:59:59.999Z`),
      label: `Q${q} ${year}`,
    }
  }

  const handleGenerateReport = async () => {
    let periodStart: Date
    let periodEnd: Date
    let periodLabel: string
    let reportType: string
    if (reportKind === 'QUARTERLY') {
      const r = getQuarterRangeUtc(reportYear, reportQuarter)
      periodStart = r.start
      periodEnd = r.end
      periodLabel = r.label
      reportType = 'Quarterly Audit Report'
    } else {
      periodStart = new Date(`${reportYear}-01-01T00:00:00.000Z`)
      periodEnd = new Date(`${reportYear}-12-31T23:59:59.999Z`)
      periodLabel = `Annual ${reportYear}`
      reportType = 'Yearly Audit Report'
    }
    setReportGenerating(true)
    try {
      const res = await fetch('/api/qms/audit-reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          periodLabel,
          reportType,
          executiveSummaryText: executiveSummary.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert((data as { error?: string }).error ?? 'Failed to generate report')
        return
      }
      const url = (data as { pdfFileUrl?: string }).pdfFileUrl
      if (url && typeof window !== 'undefined') {
        window.open(url.startsWith('http') ? url : `${window.location.origin}${url}`, '_blank', 'noopener,noreferrer')
      }
      await fetchReportLogs()
    } finally {
      setReportGenerating(false)
    }
  }

  if (!checked) {
    return (
      <MainLayout>
        <div className="p-8 text-muted-foreground">Loading…</div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">TCAA mandatory notification</h1>
          <p className="text-muted-foreground mt-2">
            Regulatory notification register for TCAA and quarterly / yearly audit report generation.{' '}
            <Link href="/findings" className="text-primary underline">
              Findings &amp; CAP
            </Link>
          </p>
        </div>

        <Tabs value={tcaaSubTab} onValueChange={(v) => setTcaaSubTab(v as 'register' | 'reports')}>
          <TabsList aria-label="TCAA sections">
            <TabsTrigger value="register">Notification register</TabsTrigger>
            <TabsTrigger value="reports">Audit report generation</TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>TCAA mandatory notification register</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Entries for regulatory notification to TCAA. P1 findings not closed on time are added automatically by the
                  system; you can also add manual rows for any finding.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <form
                  className="space-y-4 rounded-lg border p-4"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!tcaaFindingId) {
                      alert('Select a finding')
                      return
                    }
                    setTcaaSaving(true)
                    try {
                      const res = await fetch('/api/tcaa-mandatory-notifications', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                          findingId: tcaaFindingId,
                          notes: tcaaNotes.trim() || null,
                        }),
                      })
                      if (res.ok) {
                        setTcaaNotes('')
                        setTcaaFindingId('')
                        await fetchTcaa()
                      } else {
                        alert((await res.json().catch(() => ({}))).error ?? 'Failed to add')
                      }
                    } finally {
                      setTcaaSaving(false)
                    }
                  }}
                >
                  <p className="text-sm font-medium">Add manual notification</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tcaa-finding">Finding</Label>
                      <Select value={tcaaFindingId} onValueChange={setTcaaFindingId}>
                        <SelectTrigger id="tcaa-finding" aria-label="Select finding for TCAA register">
                          <SelectValue placeholder="Select finding" />
                        </SelectTrigger>
                        <SelectContent>
                          {findings
                            .filter((f) => f.status !== 'CLOSED')
                            .map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.findingNumber} — {String(f.description ?? '').slice(0, 60)}
                                {(f.description?.length ?? 0) > 60 ? '…' : ''}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="tcaa-notes">Notes (optional)</Label>
                      <Textarea
                        id="tcaa-notes"
                        value={tcaaNotes}
                        onChange={(e) => setTcaaNotes(e.target.value)}
                        rows={2}
                        placeholder="Context for TCAA notification…"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={tcaaSaving || !tcaaFindingId}>
                    {tcaaSaving ? 'Saving…' : 'Add to register'}
                  </Button>
                </form>

                {tcaaLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : tcaaRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No entries yet.</p>
                ) : (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-2 font-medium">Source</th>
                          <th className="text-left p-2 font-medium">Finding</th>
                          <th className="text-left p-2 font-medium">Notes</th>
                          <th className="text-left p-2 font-medium">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tcaaRows.map((row) => {
                          const fn = row.Finding?.findingNumber ?? row.findingId
                          const fid = row.findingId
                          return (
                            <tr key={row.id} className="border-t">
                              <td className="p-2 align-top">
                                <Badge variant="outline">{row.source}</Badge>
                              </td>
                              <td className="p-2 align-top">
                                <Link href={`/findings/${fid}`} className="text-primary underline font-medium">
                                  {fn}
                                </Link>
                              </td>
                              <td className="p-2 align-top text-muted-foreground whitespace-pre-wrap">
                                {row.notes ?? '—'}
                              </td>
                              <td className="p-2 align-top text-muted-foreground">
                                {row.createdAt ? formatDate(row.createdAt) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>QMS settings (report cover)</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Operator legal name and AOC number print on TCAA audit report PDFs. Optional footer text can be used in
                  future report layouts.
                  {qmsIdentityLocked ? (
                    <>
                      {' '}
                      After both are saved, operator legal name and AOC number cannot be changed; you can still update the
                      footer.
                    </>
                  ) : null}
                </p>
              </CardHeader>
              <CardContent className="space-y-3 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor={qmsIdentityLocked ? 'qms-operator-readonly' : 'qms-operator'}>Operator legal name</Label>
                  {qmsIdentityLocked ? (
                    <div
                      id="qms-operator-readonly"
                      className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm min-h-10 flex items-center"
                      aria-label="Operator legal name for reports (locked after save)"
                      tabIndex={0}
                    >
                      {qmsSettingsOperator.trim() ? qmsSettingsOperator : '—'}
                    </div>
                  ) : (
                    <Input
                      id="qms-operator"
                      value={qmsSettingsOperator}
                      onChange={(e) => setQmsSettingsOperator(e.target.value)}
                      placeholder="e.g. Operator Ltd"
                      aria-label="Operator legal name for reports"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={qmsIdentityLocked ? 'qms-aoc-readonly' : 'qms-aoc'}>AOC number</Label>
                  {qmsIdentityLocked ? (
                    <div
                      id="qms-aoc-readonly"
                      className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm min-h-10 flex items-center"
                      aria-label="AOC number for reports (locked after save)"
                      tabIndex={0}
                    >
                      {qmsSettingsAoc.trim() ? qmsSettingsAoc : '—'}
                    </div>
                  ) : (
                    <Input
                      id="qms-aoc"
                      value={qmsSettingsAoc}
                      onChange={(e) => setQmsSettingsAoc(e.target.value)}
                      placeholder="e.g. TZ-123"
                      aria-label="AOC number for reports"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qms-footer">Report footer (optional)</Label>
                  <Textarea
                    id="qms-footer"
                    value={qmsSettingsFooter}
                    onChange={(e) => setQmsSettingsFooter(e.target.value)}
                    rows={2}
                    placeholder="Optional line for report footer…"
                    aria-label="Optional report footer text"
                  />
                </div>
                <Button
                  type="button"
                  disabled={qmsSettingsSaving}
                  onClick={async () => {
                    setQmsSettingsSaving(true)
                    try {
                      const body = qmsIdentityLocked
                        ? { reportFooterText: qmsSettingsFooter.trim() || null }
                        : {
                            operatorLegalName: qmsSettingsOperator.trim() || null,
                            aocNumber: qmsSettingsAoc.trim() || null,
                            reportFooterText: qmsSettingsFooter.trim() || null,
                          }
                      const res = await fetch('/api/qms/settings', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify(body),
                      })
                      if (!res.ok) {
                        alert((await res.json().catch(() => ({}))).error ?? 'Failed to save')
                        return
                      }
                      const data = await res.json()
                      setQmsSettingsHint(data)
                      setQmsIdentityLocked(Boolean((data as { identityLocked?: boolean }).identityLocked))
                    } finally {
                      setQmsSettingsSaving(false)
                    }
                  }}
                  aria-label="Save QMS report settings"
                >
                  {qmsSettingsSaving ? 'Saving…' : 'Save QMS settings'}
                </Button>
                {qmsSettingsHint && (
                  <p className="text-xs text-muted-foreground">
                    Saved cover preview: {qmsSettingsHint.operatorLegalName?.trim() || '—'} — AOC{' '}
                    {qmsSettingsHint.aocNumber?.trim() || '—'}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Audit report generation</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Generate quarterly or yearly PDF reports from audits, findings, CAP and programme data.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="rep-kind">Report type</Label>
                    <Select value={reportKind} onValueChange={(v) => setReportKind(v as 'QUARTERLY' | 'YEARLY')}>
                      <SelectTrigger id="rep-kind" aria-label="Report type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QUARTERLY">Quarterly Audit Report</SelectItem>
                        <SelectItem value="YEARLY">Yearly Audit Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rep-year">Year</Label>
                    <Select
                      value={String(reportYear)}
                      onValueChange={(v) => setReportYear(parseInt(v, 10))}
                    >
                      <SelectTrigger id="rep-year" aria-label="Report year">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4].map((offset) => {
                          const y = new Date().getFullYear() - offset
                          return (
                            <SelectItem key={y} value={String(y)}>
                              {y}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  {reportKind === 'QUARTERLY' && (
                    <div className="space-y-2">
                      <Label htmlFor="rep-q">Quarter</Label>
                      <Select
                        value={String(reportQuarter)}
                        onValueChange={(v) => setReportQuarter(parseInt(v, 10) as 1 | 2 | 3 | 4)}
                      >
                        <SelectTrigger id="rep-q" aria-label="Quarter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Q1</SelectItem>
                          <SelectItem value="2">Q2</SelectItem>
                          <SelectItem value="3">Q3</SelectItem>
                          <SelectItem value="4">Q4</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exec-sum">Executive summary / AM statement (optional)</Label>
                  <Textarea
                    id="exec-sum"
                    value={executiveSummary}
                    onChange={(e) => setExecutiveSummary(e.target.value)}
                    rows={4}
                    placeholder="Short narrative for the report…"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={reportGenerating}
                  aria-label="Generate PDF report"
                >
                  {reportGenerating ? 'Generating…' : 'Generate and download PDF'}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Report history</CardTitle>
                <p className="text-sm text-muted-foreground">Previously generated reports.</p>
              </CardHeader>
              <CardContent>
                {reportLogsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : reportLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reports yet.</p>
                ) : (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-2 font-medium">Date</th>
                          <th className="text-left p-2 font-medium">Type / period</th>
                          <th className="text-left p-2 font-medium">Generated by</th>
                          <th className="text-left p-2 font-medium">PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportLogs.map((row) => {
                          const gen = row.GeneratedBy ?? (row as { generatedBy?: { firstName?: string } }).generatedBy
                          const byName = gen
                            ? [gen.firstName, (gen as { lastName?: string }).lastName].filter(Boolean).join(' ') ||
                              (gen as { email?: string }).email ||
                              '—'
                            : '—'
                          return (
                            <tr key={row.id} className="border-t">
                              <td className="p-2 text-muted-foreground">
                                {row.generatedAt ? formatDate(row.generatedAt) : '—'}
                              </td>
                              <td className="p-2">
                                <div className="font-medium">{row.reportType}</div>
                                <div className="text-muted-foreground text-xs">{row.periodLabel}</div>
                              </td>
                              <td className="p-2">{byName}</td>
                              <td className="p-2">
                                {row.pdfFileUrl ? (
                                  <a
                                    href={row.pdfFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline"
                                  >
                                    Open
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}

export default TcaaMandatoryNotificationPage
