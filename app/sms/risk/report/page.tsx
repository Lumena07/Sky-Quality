'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import {
  canManageSmsReport,
  canViewAllSmsReports,
  canViewDepartmentSmsReports,
} from '@/lib/sms-permissions'
import type { OperationalArea } from '@/lib/sms-permissions'
import {
  CONTRIBUTING_FACTORS,
  ICAO_HIGH_RISK_CATEGORIES,
  LOCATION_AREA_OPTIONS,
  OPERATIONAL_AREA_OPTIONS,
  SMS_REPORT_STATUSES,
  SMS_REPORT_TYPES,
} from '@/lib/sms-risk-constants'

const MAX_FILES = 5

type Me = {
  id: string
  roles: string[]
  departmentId: string | null
  safetyOperationalArea: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
}

type ReportRow = {
  id: string
  report_number: string
  report_type: string
  status: string
  occurred_at: string
  location_area: string
  location_text: string | null
  operational_area: string
  description: string
  is_anonymous: boolean
  reporter_id: string | null
  created_at: string
}

const labelReportType = (v: string) =>
  SMS_REPORT_TYPES.find((t) => t.value === v)?.label ?? v.replace(/_/g, ' ')

const labelArea = (v: string) =>
  LOCATION_AREA_OPTIONS.find((o) => o.value === v)?.label ??
  OPERATIONAL_AREA_OPTIONS.find((o) => o.value === v)?.label ??
  v

const labelStatus = (v: string) => SMS_REPORT_STATUSES.find((s) => s.value === v)?.label ?? v

const SmsRiskReportPage = () => {
  const [me, setMe] = useState<Me | null>(null)
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [saving, setSaving] = useState(false)

  const [isAnonymous, setIsAnonymous] = useState(false)
  const [reportType, setReportType] = useState<string>(SMS_REPORT_TYPES[0].value)
  const [occurredAt, setOccurredAt] = useState('')
  const [locationArea, setLocationArea] = useState<string>(LOCATION_AREA_OPTIONS[0].value)
  const [locationText, setLocationText] = useState('')
  const [operationalArea, setOperationalArea] = useState<string>('airline_ops')
  const [description, setDescription] = useState('')
  const [whatHappened, setWhatHappened] = useState('')
  const [immediateActions, setImmediateActions] = useState('')
  const [affectedParty, setAffectedParty] = useState('')
  const [contributing, setContributing] = useState<string[]>([])
  const [icao, setIcao] = useState<string[]>([])
  const [attachments, setAttachments] = useState<
    { name: string; fileUrl: string; fileType: string; fileSize: number }[]
  >([])

  const [anonymousDialogOpen, setAnonymousDialogOpen] = useState(false)
  const [lastAnonymousNumber, setLastAnonymousNumber] = useState<string | null>(null)
  const [selectedReviewReportId, setSelectedReviewReportId] = useState<string | null>(null)
  const [promotionSaving, setPromotionSaving] = useState(false)
  const [promotionDraftTitle, setPromotionDraftTitle] = useState('')
  const [promotionDraftDescription, setPromotionDraftDescription] = useState('')
  const [promotionHazardCategory, setPromotionHazardCategory] = useState('')

  const fetchMe = useCallback(async () => {
    const res = await fetch('/api/me', { credentials: 'same-origin' })
    if (!res.ok) return
    const data = await res.json()
    setMe(data)
  }, [])

  const fetchReports = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch('/api/sms/reports', { credentials: 'same-origin' })
      if (!res.ok) {
        setReports([])
        return
      }
      const data = await res.json()
      setReports(Array.isArray(data) ? data : [])
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const listTitle = useMemo(() => {
    if (!me) return 'Your reports'
    if (canViewAllSmsReports(me.roles)) return 'All reports'
    if (canViewDepartmentSmsReports(me.roles)) return 'Reports in your department'
    return 'Your reports'
  }, [me])

  const handleToggleFactor = (value: string) => {
    setContributing((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    )
  }

  const handleToggleIcao = (value: string) => {
    setIcao((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]))
  }

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    const remaining = MAX_FILES - attachments.length
    if (remaining <= 0) return
    const files = Array.from(fileList).slice(0, remaining)
    const next = [...attachments]
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('entityType', 'sms-report')
      fd.append('entityId', 'draft')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) continue
      const data = await res.json()
      if (data.fileUrl) {
        next.push({
          name: data.fileName || file.name,
          fileUrl: data.fileUrl,
          fileType: data.fileType || file.type,
          fileSize: data.fileSize ?? file.size,
        })
      }
    }
    setAttachments(next)
  }

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (description.trim().length < 50) return
    if (!occurredAt) return

    setSaving(true)
    try {
      const res = await fetch('/api/sms/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          isAnonymous,
          reportType,
          occurredAt: new Date(occurredAt).toISOString(),
          locationArea,
          locationText: locationArea === 'other' ? locationText : null,
          operationalArea,
          description: description.trim(),
          whatHappened: whatHappened.trim() || null,
          immediateActions: immediateActions.trim() || null,
          affectedParty: affectedParty.trim() || null,
          contributingFactors: contributing,
          icaoCategories: icao,
          attachments,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Failed to submit report')
        return
      }
      if (isAnonymous && data.report_number) {
        setLastAnonymousNumber(String(data.report_number))
        setAnonymousDialogOpen(true)
      }
      setDescription('')
      setWhatHappened('')
      setImmediateActions('')
      setAffectedParty('')
      setContributing([])
      setIcao([])
      setAttachments([])
      setLocationText('')
      setIsAnonymous(false)
      fetchReports()
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/sms/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to update status')
      return
    }
    fetchReports()
  }

  const selectedReviewReport = useMemo(
    () => reports.find((r) => r.id === selectedReviewReportId) ?? null,
    [reports, selectedReviewReportId]
  )

  useEffect(() => {
    if (!selectedReviewReport) return
    setPromotionDraftTitle(`${labelReportType(selectedReviewReport.report_type)} from ${selectedReviewReport.report_number}`)
    setPromotionDraftDescription(selectedReviewReport.description || '')
    setPromotionHazardCategory('')
  }, [selectedReviewReport])

  const canPromote = (row: ReportRow) => {
    if (!me) return false
    if (!canManageSmsReport(me.roles, me.safetyOperationalArea as OperationalArea | null, row.operational_area as OperationalArea)) {
      return false
    }
    return row.status === 'NEW' || row.status === 'UNDER_REVIEW'
  }

  const handlePromote = async () => {
    if (!selectedReviewReport) return
    setPromotionSaving(true)
    try {
      const res = await fetch(`/api/sms/reports/${selectedReviewReport.id}/promote`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Failed to promote report')
        return
      }
      alert(`Promoted to hazard register: ${data?.hazard?.hazard_number ?? 'Created'}`)
      setSelectedReviewReportId(null)
      await fetchReports()
    } finally {
      setPromotionSaving(false)
    }
  }

  const canPatch = (row: ReportRow) =>
    me &&
    canManageSmsReport(me.roles, me.safetyOperationalArea as OperationalArea | null, row.operational_area as OperationalArea)

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hazard and occurrence reporting</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Submit a safety report in a few steps. Reports are assigned a unique number and reviewed by the safety team.
        </p>
      </div>

      <Card className="border-primary/20 shadow-sm">
        <CardHeader>
          <CardTitle>New report</CardTitle>
          <CardDescription>All required fields are marked. Describe what you observed clearly.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-wrap items-start gap-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    id="anonymous"
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                    aria-describedby="anonymous-notice"
                  />
                  <Label htmlFor="anonymous" className="font-medium">
                    Submit anonymously
                  </Label>
                </div>
                <p id="anonymous-notice" className="text-sm text-muted-foreground">
                  {isAnonymous
                    ? 'Anonymous mode is on: your account and department are not stored with this report. You will not see it under “My reports” afterwards — save your reference number from the confirmation dialog.'
                    : 'When anonymous is off, the safety team can see who submitted the report.'}
                </p>
              </div>
            </div>

            {!isAnonymous && me && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium text-foreground">Reporter</p>
                <p className="text-muted-foreground">
                  {[me.firstName, me.lastName].filter(Boolean).join(' ') || me.email || me.id}
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reportType">Report type *</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger id="reportType" aria-label="Report type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SMS_REPORT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="occurredAt">Date and time of observation or occurrence *</Label>
                <Input
                  id="occurredAt"
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  required
                  aria-required
                />
              </div>
              <div className="space-y-2">
                <Label>Location *</Label>
                <Select value={locationArea} onValueChange={setLocationArea}>
                  <SelectTrigger aria-label="Location area">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_AREA_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {locationArea === 'other' && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="locationText">Location details *</Label>
                  <Input
                    id="locationText"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    required
                    placeholder="Describe the location"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Operational area *</Label>
                <Select value={operationalArea} onValueChange={setOperationalArea}>
                  <SelectTrigger aria-label="Operational area">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATIONAL_AREA_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description * (min. 50 characters)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={50}
                rows={4}
                className="resize-y"
                aria-describedby="desc-count"
              />
              <p id="desc-count" className="text-xs text-muted-foreground">
                {description.trim().length}/50 minimum
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatHappened">What happened / what was observed</Label>
              <Textarea
                id="whatHappened"
                value={whatHappened}
                onChange={(e) => setWhatHappened(e.target.value)}
                rows={3}
                className="resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="immediateActions">Immediate actions taken</Label>
              <Textarea
                id="immediateActions"
                value={immediateActions}
                onChange={(e) => setImmediateActions(e.target.value)}
                rows={3}
                className="resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="affectedParty">Who or what was affected</Label>
              <Textarea
                id="affectedParty"
                value={affectedParty}
                onChange={(e) => setAffectedParty(e.target.value)}
                rows={2}
                className="resize-y"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Contributing factors</legend>
              <div className="flex flex-wrap gap-3">
                {CONTRIBUTING_FACTORS.map((f) => (
                  <label key={f.value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={contributing.includes(f.value)}
                      onChange={() => handleToggleFactor(f.value)}
                      className="h-4 w-4 rounded border-input"
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">ICAO high risk category (optional)</legend>
              <div className="flex flex-wrap gap-3">
                {ICAO_HIGH_RISK_CATEGORIES.map((c) => (
                  <label key={c.value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={icao.includes(c.value)}
                      onChange={() => handleToggleIcao(c.value)}
                      className="h-4 w-4 rounded border-input"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="files">Attachments (up to {MAX_FILES} files)</Label>
              <Input
                id="files"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => handleUploadFiles(e.target.files)}
                disabled={attachments.length >= MAX_FILES}
                aria-label="Upload attachments"
              />
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {attachments.map((a, i) => (
                    <li key={a.fileUrl} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                      <a href={a.fileUrl} className="truncate text-primary underline" target="_blank" rel="noreferrer">
                        {a.name}
                      </a>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveAttachment(i)}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button type="submit" size="lg" disabled={saving} className="w-full sm:w-auto">
              {saving ? 'Submitting…' : 'Submit report'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{listTitle}</CardTitle>
          <CardDescription>
            {loadingList ? 'Loading…' : `${reports.length} report(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {reports.length === 0 && !loadingList ? (
            <p className="text-sm text-muted-foreground">No reports to show.</p>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2 font-medium">Number</th>
                  <th className="p-2 font-medium">Type</th>
                  <th className="p-2 font-medium">When</th>
                  <th className="p-2 font-medium">Location</th>
                  <th className="p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="p-2 font-mono text-xs">{r.report_number}</td>
                    <td className="p-2">{labelReportType(r.report_type)}</td>
                    <td className="p-2 whitespace-nowrap">{formatDateTime(r.occurred_at)}</td>
                    <td className="p-2">{labelArea(r.location_area)}</td>
                    <td className="p-2">
                      {canPatch(r) ? (
                        <Select value={r.status} onValueChange={(v) => handleStatusChange(r.id, v)}>
                          <SelectTrigger className="h-8 w-[200px]" aria-label={`Status for ${r.report_number}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SMS_REPORT_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        labelStatus(r.status)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {me && canViewAllSmsReports(me.roles) && (
        <Card>
          <CardHeader>
            <CardTitle>Safety Officer review workspace</CardTitle>
            <CardDescription>
              Review incoming reports and promote valid items into the hazard register as separate records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select report for review</Label>
              <Select value={selectedReviewReportId ?? 'NONE'} onValueChange={(v) => setSelectedReviewReportId(v === 'NONE' ? null : v)}>
                <SelectTrigger aria-label="Select report for review">
                  <SelectValue placeholder="Choose a report" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {reports.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.report_number} — {labelReportType(r.report_type)} — {labelStatus(r.status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedReviewReport && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border p-4">
                  <h3 className="text-sm font-semibold">Incoming report</h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Report number</dt>
                      <dd className="font-mono">{selectedReviewReport.report_number}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Type / status</dt>
                      <dd>{labelReportType(selectedReviewReport.report_type)} / {labelStatus(selectedReviewReport.status)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Observed at</dt>
                      <dd>{formatDateTime(selectedReviewReport.occurred_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Operational area</dt>
                      <dd>{labelArea(selectedReviewReport.operational_area)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Description</dt>
                      <dd className="whitespace-pre-wrap">{selectedReviewReport.description}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-md border p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Create hazard register entry</h3>
                  <div className="space-y-2">
                    <Label htmlFor="promote-title">Hazard title</Label>
                    <Input
                      id="promote-title"
                      value={promotionDraftTitle}
                      onChange={(e) => setPromotionDraftTitle(e.target.value)}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promote-desc">Hazard description</Label>
                    <Textarea
                      id="promote-desc"
                      value={promotionDraftDescription}
                      onChange={(e) => setPromotionDraftDescription(e.target.value)}
                      rows={5}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hazard category (optional after promotion)</Label>
                    <Select value={promotionHazardCategory || 'NONE'} onValueChange={(v) => setPromotionHazardCategory(v === 'NONE' ? '' : v)}>
                      <SelectTrigger aria-label="Hazard category">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">None</SelectItem>
                        <SelectItem value="AIRSPACE">Airspace</SelectItem>
                        <SelectItem value="AIRCRAFT">Aircraft</SelectItem>
                        <SelectItem value="PERSONNEL">Personnel</SelectItem>
                        <SelectItem value="GROUND_EQUIPMENT">Ground Equipment</SelectItem>
                        <SelectItem value="INFRASTRUCTURE">Infrastructure</SelectItem>
                        <SelectItem value="PROCEDURES">Procedures</SelectItem>
                        <SelectItem value="WEATHER">Weather</SelectItem>
                        <SelectItem value="ORGANISATIONAL">Organisational</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleStatusChange(selectedReviewReport.id, 'UNDER_REVIEW')}
                      disabled={!canPromote(selectedReviewReport) || selectedReviewReport.status !== 'NEW'}
                    >
                      Mark under review
                    </Button>
                    <Button
                      type="button"
                      onClick={handlePromote}
                      disabled={!canPromote(selectedReviewReport) || promotionSaving}
                    >
                      {promotionSaving ? 'Promoting…' : 'Promote to risk register'}
                    </Button>
                    <Button asChild type="button" variant="outline">
                      <Link href="/sms/risk/register">Open hazard register</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={anonymousDialogOpen} onOpenChange={setAnonymousDialogOpen}>
        <DialogContent aria-describedby="anon-dialog-desc">
          <DialogHeader>
            <DialogTitle>Report submitted anonymously</DialogTitle>
            <DialogDescription id="anon-dialog-desc">
              Save this reference number. You will not be able to retrieve this report from your account later.
            </DialogDescription>
          </DialogHeader>
          <p className="font-mono text-lg font-semibold">{lastAnonymousNumber}</p>
          <DialogFooter>
            <Button type="button" onClick={() => setAnonymousDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SmsRiskReportPage
