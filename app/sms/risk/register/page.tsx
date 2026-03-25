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
import { SignaturePad } from '@/components/audits/signature-pad'
import { RiskMatrix } from '@/components/sms/risk-matrix'
import { formatDateOnly } from '@/lib/utils'
import { isAccountableManager, isDirectorOfSafety } from '@/lib/permissions'
import {
  HAZARD_CATEGORIES,
  HAZARD_SOURCE_TYPES,
  HAZARD_STATUSES,
  ICAO_HIGH_RISK_CATEGORIES,
  LIKELIHOOD_LABELS,
  MITIGATION_CONTROL_TYPES,
  MITIGATION_STATUSES,
  SEVERITY_LABELS,
  hazardPlotCoords,
  riskIndexToLevel,
} from '@/lib/sms-risk-constants'

type Me = { id: string; roles: string[] }

type MitigationRow = {
  id: string
  hazard_id: string
  description: string
  control_type: string
  owner_id: string | null
  due_date: string | null
  status: string
}

type DraftMitigationRow = {
  temp_id: string
  description: string
  control_type: string
  owner_id: string | null
  due_date: string | null
  status: string
}

type HazardRow = {
  id: string
  hazard_number: string
  title: string
  description: string
  source_type: string
  source_report_id: string | null
  operational_area: string
  hazard_category: string | null
  icao_high_risk_categories?: string[] | null
  identified_at: string
  initial_likelihood: number | null
  initial_severity: number | null
  initial_risk_index: number | null
  initial_risk_level: string | null
  residual_likelihood: number | null
  residual_severity: number | null
  residual_risk_index: number | null
  residual_risk_level: string | null
  risk_acceptance_status: string | null
  risk_accepted_by: string | null
  risk_accepted_at: string | null
  risk_acceptance_signature: string | null
  status: string
  review_date: string | null
  sms_hazard_mitigations?: MitigationRow[] | null
}

type ReportOption = { id: string; report_number: string; report_type: string }

const labelSource = (v: string) => HAZARD_SOURCE_TYPES.find((s) => s.value === v)?.label ?? v
const labelHazardStatus = (v: string) => HAZARD_STATUSES.find((s) => s.value === v)?.label ?? v
const labelMitigationStatus = (v: string) => MITIGATION_STATUSES.find((s) => s.value === v)?.label ?? v
const labelControl = (v: string) => MITIGATION_CONTROL_TYPES.find((c) => c.value === v)?.label ?? v

const SmsHazardRegisterPage = () => {
  const [me, setMe] = useState<Me | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [hazards, setHazards] = useState<HazardRow[]>([])
  const [loading, setLoading] = useState(true)

  const [filterArea, setFilterArea] = useState<string>('all')
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterIcao, setFilterIcao] = useState<string[]>([])
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [matrixBand, setMatrixBand] = useState<'ACCEPTABLE' | 'ALARP' | 'UNACCEPTABLE' | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<HazardRow | null>(null)
  const [creating, setCreating] = useState(false)

  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSource, setFormSource] = useState('MANUAL_INTERNAL_REVIEW')
  const [formReportId, setFormReportId] = useState<string>('')
  const [formOperationalArea, setFormOperationalArea] = useState('all')
  const [formCategory, setFormCategory] = useState<string>('')
  const [formIcao, setFormIcao] = useState<string[]>([])
  const [formIdentifiedAt, setFormIdentifiedAt] = useState('')
  const [formReviewDate, setFormReviewDate] = useState('')
  const [formInitialL, setFormInitialL] = useState('3')
  const [formInitialS, setFormInitialS] = useState('3')
  const [formResidualL, setFormResidualL] = useState('')
  const [formStatus, setFormStatus] = useState('OPEN')
  const [saving, setSaving] = useState(false)

  const [reports, setReports] = useState<ReportOption[]>([])
  const [mitigations, setMitigations] = useState<MitigationRow[]>([])
  const [draftMitigations, setDraftMitigations] = useState<DraftMitigationRow[]>([])
  const [mitDesc, setMitDesc] = useState('')
  const [mitControl, setMitControl] = useState('ADMINISTRATIVE')
  const [mitOwner, setMitOwner] = useState('')
  const [mitDue, setMitDue] = useState('')
  const [mitStatus, setMitStatus] = useState('OPEN')
  const [quickMitOpen, setQuickMitOpen] = useState(false)

  const [showSignature, setShowSignature] = useState(false)

  const fetchMe = useCallback(async () => {
    const res = await fetch('/api/me', { credentials: 'same-origin' })
    if (!res.ok) return
    setMe(await res.json())
  }, [])

  const loadHazards = useCallback(async () => {
    setLoading(true)
    setForbidden(false)
    try {
      const res = await fetch('/api/sms/hazards', { credentials: 'same-origin' })
      if (res.status === 403) {
        setForbidden(true)
        setHazards([])
        return
      }
      if (!res.ok) {
        setHazards([])
        return
      }
      const data = await res.json()
      setHazards(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadReportsForLink = useCallback(async () => {
    const res = await fetch('/api/sms/reports', { credentials: 'same-origin' })
    if (!res.ok) return
    const data = await res.json()
    setReports(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  useEffect(() => {
    loadHazards()
  }, [loadHazards])

  const toggleFilterIcao = (v: string) => {
    setFilterIcao((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  const filteredHazards = useMemo(() => {
    return hazards.filter((h) => {
      if (filterArea !== 'all' && h.operational_area !== filterArea) return false
      if (filterStatus !== 'all' && h.status !== filterStatus) return false
      const coords = hazardPlotCoords(h)
      if (filterRiskLevel !== 'all' && coords.level !== filterRiskLevel) return false
      if (filterIcao.length > 0) {
        const cats = h.icao_high_risk_categories ?? []
        if (!filterIcao.some((f) => cats.includes(f))) return false
      }
      if (filterDateFrom) {
        const d = (h.identified_at || '').slice(0, 10)
        if (d < filterDateFrom) return false
      }
      if (filterDateTo) {
        const d = (h.identified_at || '').slice(0, 10)
        if (d > filterDateTo) return false
      }
      if (matrixBand != null && coords.level !== matrixBand) return false
      return true
    })
  }, [hazards, filterArea, filterRiskLevel, filterStatus, filterIcao, filterDateFrom, filterDateTo, matrixBand])

  const openNew = () => {
    setCreating(true)
    setEditing(null)
    setFormTitle('')
    setFormDescription('')
    setFormSource('MANUAL_INTERNAL_REVIEW')
    setFormReportId('')
    setFormOperationalArea('all')
    setFormCategory('')
    setFormIcao([])
    const now = new Date()
    setFormIdentifiedAt(now.toISOString().slice(0, 16))
    setFormReviewDate('')
    setFormInitialL('3')
    setFormInitialS('3')
    setFormResidualL('')
    setFormStatus('OPEN')
    setMitigations([])
    setDraftMitigations([])
    setMitDesc('')
    setMitControl('ADMINISTRATIVE')
    setMitOwner('')
    setMitDue('')
    setMitStatus('OPEN')
    setQuickMitOpen(false)
    setShowSignature(false)
    setDialogOpen(true)
    loadReportsForLink()
  }

  const openEdit = (h: HazardRow) => {
    setCreating(false)
    setEditing(h)
    setFormTitle(h.title)
    setFormDescription(h.description)
    setFormSource(h.source_type)
    setFormReportId(h.source_report_id ?? '')
    setFormOperationalArea(h.operational_area)
    setFormCategory(h.hazard_category ?? '')
    setFormIcao([...(h.icao_high_risk_categories ?? [])])
    setFormIdentifiedAt(h.identified_at ? h.identified_at.slice(0, 16) : '')
    setFormReviewDate(h.review_date ?? '')
    setFormInitialL(String(h.initial_likelihood ?? 1))
    setFormInitialS(String(h.initial_severity ?? 1))
    setFormResidualL(h.residual_likelihood != null ? String(h.residual_likelihood) : '')
    setFormStatus(h.status)
    setMitigations(h.sms_hazard_mitigations ?? [])
    setDraftMitigations([])
    setMitDesc('')
    setMitControl('ADMINISTRATIVE')
    setMitOwner('')
    setMitDue('')
    setMitStatus('OPEN')
    setQuickMitOpen(false)
    setShowSignature(false)
    setDialogOpen(true)
    loadReportsForLink()
  }

  const toggleFormIcao = (v: string) => {
    setFormIcao((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  const createDraftMitigation = (): DraftMitigationRow | null => {
    if (!mitDesc.trim()) {
      alert('Mitigation description is required')
      return null
    }
    return {
      temp_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      description: mitDesc.trim(),
      control_type: mitControl,
      owner_id: mitOwner.trim() || null,
      due_date: mitDue || null,
      status: mitStatus,
    }
  }

  const resetMitigationForm = () => {
    setMitDesc('')
    setMitControl('ADMINISTRATIVE')
    setMitOwner('')
    setMitDue('')
    setMitStatus('OPEN')
  }

  const persistDraftMitigations = async (
    hazardId: string,
    drafts: DraftMitigationRow[]
  ): Promise<{ failed: DraftMitigationRow[]; created: MitigationRow[] }> => {
    const failed: DraftMitigationRow[] = []
    const created: MitigationRow[] = []
    for (const d of drafts) {
      const res = await fetch(`/api/sms/hazards/${hazardId}/mitigations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          description: d.description,
          controlType: d.control_type,
          ownerId: d.owner_id,
          dueDate: d.due_date,
          status: d.status,
        }),
      })
      if (!res.ok) {
        failed.push(d)
      } else {
        created.push((await res.json()) as MitigationRow)
      }
    }
    return { failed, created }
  }

  const handleSaveHazard = async () => {
    if (!formTitle.trim() || !formDescription.trim()) return
    if (formSource === 'LINKED_REPORT' && !formReportId.trim()) {
      alert('Select a linked report')
      return
    }
    setSaving(true)
    try {
      const basePayload: Record<string, unknown> = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        sourceType: formSource === 'LINKED_REPORT' ? 'LINKED_REPORT' : formSource,
        sourceReportId: formSource === 'LINKED_REPORT' ? formReportId : null,
        operationalArea: formOperationalArea,
        hazardCategory: formCategory || null,
        icaoHighRiskCategories: formIcao,
        identifiedAt: new Date(formIdentifiedAt).toISOString(),
        reviewDate: formReviewDate || null,
        initialLikelihood: Number(formInitialL),
        initialSeverity: Number(formInitialS),
        status: formStatus,
      }
      if (!creating && formResidualL !== '') {
        basePayload.residualLikelihood = Number(formResidualL)
      }

      if (creating) {
        const res = await fetch('/api/sms/hazards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(basePayload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          alert(err.error || 'Failed to create')
          return
        }
        const createdHazard = (await res.json()) as HazardRow
        if (draftMitigations.length > 0) {
          const { failed } = await persistDraftMitigations(createdHazard.id, draftMitigations)
          if (failed.length > 0) {
            setCreating(false)
            setEditing(createdHazard)
            setDraftMitigations(failed)
            setMitigations([])
            await loadHazards()
            alert(
              `${failed.length} mitigation(s) could not be saved. They are still listed as drafts; use the button to retry.`
            )
            return
          }
        }
      } else if (editing) {
        const res = await fetch(`/api/sms/hazards/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(basePayload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          alert(err.error || 'Failed to save')
          return
        }
      }
      setDialogOpen(false)
      setDraftMitigations([])
      await loadHazards()
    } finally {
      setSaving(false)
    }
  }

  const handleDosAccept = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sms/hazards/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ dosRiskAcceptance: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed')
        return
      }
      const updated = await res.json()
      setEditing(updated)
      setMitigations(updated.sms_hazard_mitigations ?? mitigations)
      loadHazards()
    } finally {
      setSaving(false)
    }
  }

  const handleAmSign = async (dataUrl: string | null) => {
    if (!editing || !dataUrl) {
      setShowSignature(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/sms/hazards/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ riskAcceptanceSignature: dataUrl }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed')
        return
      }
      const updated = await res.json()
      setEditing(updated)
      setShowSignature(false)
      loadHazards()
    } finally {
      setSaving(false)
    }
  }

  const handleAddMitigationBeforeSave = async () => {
    const draft = createDraftMitigation()
    if (!draft) return

    if (creating) {
      setDraftMitigations((prev) => [...prev, draft])
      resetMitigationForm()
      setQuickMitOpen(false)
      return
    }

    if (!editing) return
    const res = await fetch(`/api/sms/hazards/${editing.id}/mitigations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        description: draft.description,
        controlType: draft.control_type,
        ownerId: draft.owner_id,
        dueDate: draft.due_date,
        status: draft.status,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to add mitigation')
      return
    }
    const row = (await res.json()) as MitigationRow
    setMitigations((m) => [...m, row])
    resetMitigationForm()
    setQuickMitOpen(false)
    loadHazards()
  }

  const handleDeleteMitigation = async (mid: string, isDraft = false) => {
    if (isDraft) {
      setDraftMitigations((prev) => prev.filter((x) => x.temp_id !== mid))
      return
    }
    if (!editing) return
    const res = await fetch(`/api/sms/hazards/${editing.id}/mitigations/${mid}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
    if (!res.ok) return
    setMitigations((m) => m.filter((x) => x.id !== mid))
    loadHazards()
  }

  const residualLevelPreview = useMemo(() => {
    const L =
      formResidualL !== '' ? Number(formResidualL) : Number(formInitialL || 1)
    const S = Number(formInitialS || 1)
    if (Number.isNaN(L) || Number.isNaN(S)) return null
    return riskIndexToLevel(L * S)
  }, [formResidualL, formInitialL, formInitialS])

  if (forbidden) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Hazard register</CardTitle>
            <CardDescription>You do not have access to the hazard register.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hazard register and risk matrix</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Central register of identified hazards. After mitigations, residual risk uses the same consequence severity
            as the initial assessment; only residual likelihood is reassessed. Use the matrix to see exposure by
            likelihood and severity.
          </p>
        </div>
        <Button type="button" onClick={openNew}>
          New hazard
        </Button>
      </div>

      <RiskMatrix hazards={hazards} selectedBand={matrixBand} onBandSelect={setMatrixBand} />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Operational area</Label>
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="airline_ops">Airline Ops</SelectItem>
                <SelectItem value="mro_maintenance">MRO-Maintenance</SelectItem>
                <SelectItem value="airport_ground_ops">Airport-Ground Ops</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Risk level (current)</Label>
            <Select value={filterRiskLevel} onValueChange={setFilterRiskLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ACCEPTABLE">Acceptable</SelectItem>
                <SelectItem value="ALARP">Tolerable / ALARP</SelectItem>
                <SelectItem value="UNACCEPTABLE">Unacceptable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {HAZARD_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Identified from</Label>
            <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Identified to</Label>
            <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
          </div>
          <div className="md:col-span-2 lg:col-span-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">ICAO high risk category</legend>
              <div className="flex flex-wrap gap-3">
                {ICAO_HIGH_RISK_CATEGORIES.map((c) => (
                  <label key={c.value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filterIcao.includes(c.value)}
                      onChange={() => toggleFilterIcao(c.value)}
                      className="h-4 w-4 rounded border-input"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hazards ({filteredHazards.length})</CardTitle>
          <CardDescription>{loading ? 'Loading…' : 'Click a row to edit.'}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2 font-medium">ID</th>
                <th className="p-2 font-medium">Title</th>
                <th className="p-2 font-medium">Area</th>
                <th className="p-2 font-medium">Initial</th>
                <th className="p-2 font-medium">Residual</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Review</th>
                <th className="p-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredHazards.map((h) => {
                const c = hazardPlotCoords(h)
                return (
                  <tr
                    key={h.id}
                    className="cursor-pointer border-b border-border/60 hover:bg-muted/50"
                    tabIndex={0}
                    role="button"
                    aria-label={`Edit hazard ${h.hazard_number}`}
                    onClick={() => openEdit(h)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openEdit(h)
                      }
                    }}
                  >
                    <td className="p-2 font-mono text-xs">{h.hazard_number}</td>
                    <td className="p-2">{h.title}</td>
                    <td className="p-2">{h.operational_area}</td>
                    <td className="p-2">
                      {h.initial_risk_level} ({h.initial_risk_index})
                    </td>
                    <td className="p-2">
                      {c.level} ({c.index})
                    </td>
                    <td className="p-2">{labelHazardStatus(h.status)}</td>
                    <td className="p-2 whitespace-nowrap">
                      {h.review_date ? formatDateOnly(h.review_date) : '—'}
                    </td>
                    <td className="p-2">{labelSource(h.source_type)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" aria-describedby="hazard-dialog-desc">
          <DialogHeader>
            <DialogTitle>{creating ? 'New hazard' : `Edit ${editing?.hazard_number ?? ''}`}</DialogTitle>
            <DialogDescription id="hazard-dialog-desc">
              Record the initial likelihood and consequence (severity), then mitigations. Set residual likelihood only
              after controls are in place; consequence stays the same as initial severity. Acceptance applies to
              residual risk.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="hz-title">Title *</Label>
              <Input id="hz-title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="hz-desc">Description *</Label>
              <Textarea id="hz-desc" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={formSource} onValueChange={setFormSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HAZARD_SOURCE_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formSource === 'LINKED_REPORT' && (
              <div className="space-y-2">
                <Label>Linked report</Label>
                <Select value={formReportId} onValueChange={setFormReportId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report" />
                  </SelectTrigger>
                  <SelectContent>
                    {reports.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.report_number} — {r.report_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Operational area</Label>
              <Select value={formOperationalArea} onValueChange={setFormOperationalArea}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="airline_ops">Airline Ops</SelectItem>
                  <SelectItem value="mro_maintenance">MRO-Maintenance</SelectItem>
                  <SelectItem value="airport_ground_ops">Airport-Ground Ops</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hazard category</Label>
              <Select value={formCategory || 'NONE'} onValueChange={(v) => setFormCategory(v === 'NONE' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {HAZARD_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hz-ident">Identified at</Label>
              <Input
                id="hz-ident"
                type="datetime-local"
                value={formIdentifiedAt}
                onChange={(e) => setFormIdentifiedAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hz-review">Review date</Label>
              <Input
                id="hz-review"
                type="date"
                value={formReviewDate}
                onChange={(e) => setFormReviewDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Initial likelihood (1–5)</Label>
              <Select value={formInitialL} onValueChange={setFormInitialL}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} — {LIKELIHOOD_LABELS[n]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Initial severity (1–5)</Label>
              <Select value={formInitialS} onValueChange={setFormInitialS}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} — {SEVERITY_LABELS[n]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hazard status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HAZARD_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">ICAO high risk categories</legend>
            <div className="flex flex-wrap gap-3">
              {ICAO_HIGH_RISK_CATEGORIES.map((c) => (
                <label key={c.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formIcao.includes(c.value)}
                    onChange={() => toggleFormIcao(c.value)}
                    className="h-4 w-4 rounded border-input"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>

          {(creating || editing) && (
            <div className="space-y-6 border-t pt-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Mitigations</h3>
                <Button type="button" variant="outline" onClick={() => setQuickMitOpen(true)}>
                  Add mitigation before saving risk
                </Button>
              </div>
              {creating && draftMitigations.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Draft mitigations are staged locally and will be saved when you create the hazard.
                </p>
              )}
              {!creating && draftMitigations.length > 0 && (
                <p className="text-xs text-amber-700">
                  {draftMitigations.length} draft mitigation(s) still unsaved. Use the button above to retry adding them.
                </p>
              )}
              <ul className="space-y-2 text-sm">
                {draftMitigations.map((m) => (
                  <li key={m.temp_id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1">
                    <span>
                      {m.description} — {labelControl(m.control_type)} — {labelMitigationStatus(m.status)}{' '}
                      <span className="text-xs text-muted-foreground">(Draft)</span>
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteMitigation(m.temp_id, true)}>
                      Remove
                    </Button>
                  </li>
                ))}
                {mitigations.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1">
                    <span>
                      {m.description} — {labelControl(m.control_type)} — {labelMitigationStatus(m.status)}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteMitigation(m.id)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={handleSaveHazard} disabled={saving}>
              {saving ? 'Saving…' : creating ? 'Create' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quickMitOpen} onOpenChange={setQuickMitOpen}>
        <DialogContent aria-describedby="quick-mitigation-desc">
          <DialogHeader>
            <DialogTitle>Add mitigation before saving risk</DialogTitle>
            <DialogDescription id="quick-mitigation-desc">
              Add mitigation details now. {creating ? 'It will be saved with the hazard.' : 'It will be saved immediately.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="mit-desc">Mitigation description *</Label>
              <Textarea
                id="mit-desc"
                placeholder="Control description"
                value={mitDesc}
                onChange={(e) => setMitDesc(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Control type</Label>
              <Select value={mitControl} onValueChange={setMitControl}>
                <SelectTrigger aria-label="Mitigation control type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MITIGATION_CONTROL_TYPES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={mitStatus} onValueChange={setMitStatus}>
                <SelectTrigger aria-label="Mitigation status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MITIGATION_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mit-owner">Owner user id (optional)</Label>
              <Input id="mit-owner" value={mitOwner} onChange={(e) => setMitOwner(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mit-due">Due date</Label>
              <Input id="mit-due" type="date" value={mitDue} onChange={(e) => setMitDue(e.target.value)} />
            </div>
            <div className="space-y-3 md:col-span-2 border-t border-border/60 pt-4">
              <h3 className="text-sm font-semibold">Residual risk (after mitigations)</h3>
              <p className="text-sm text-muted-foreground">
                Consequence severity matches the initial assessment and does not change with controls. Estimate residual
                likelihood while adding mitigations.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Residual likelihood (1-5)</Label>
                  <Select value={formResidualL || 'NONE'} onValueChange={(v) => setFormResidualL(v === 'NONE' ? '' : v)}>
                    <SelectTrigger aria-label="Residual likelihood">
                      <SelectValue placeholder="Same as initial until set" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Same as initial likelihood</SelectItem>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} - {LIKELIHOOD_LABELS[n]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Consequence severity (from initial assessment)</Label>
                  <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    {formInitialS} {' - '}
                    {SEVERITY_LABELS[Number(formInitialS) as keyof typeof SEVERITY_LABELS] ?? '-'}
                  </p>
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Residual preview</p>
                <p className="text-muted-foreground">
                  {residualLevelPreview
                    ? `Index ${(formResidualL !== '' ? Number(formResidualL) : Number(formInitialL || 1)) * Number(formInitialS || 1)} - Band: ${residualLevelPreview}. Acceptance: ${editing?.risk_acceptance_status ?? '-'}`
                    : '-'}
                </p>
                {residualLevelPreview === 'ALARP' &&
                  me &&
                  isDirectorOfSafety(me.roles) &&
                  editing &&
                  editing.risk_acceptance_status !== 'ACCEPTED_BY_DOS' && (
                    <Button type="button" className="mt-2" variant="secondary" onClick={handleDosAccept} disabled={saving}>
                      Accept ALARP (Director of Safety)
                    </Button>
                  )}
                {residualLevelPreview === 'UNACCEPTABLE' &&
                  me &&
                  isAccountableManager(me.roles) &&
                  editing &&
                  editing.risk_acceptance_status !== 'ACCEPTED_BY_AM' &&
                  !showSignature && (
                    <Button type="button" className="mt-2" variant="secondary" onClick={() => setShowSignature(true)}>
                      Sign acceptance (Accountable Manager)
                    </Button>
                  )}
                {showSignature && (
                  <div className="mt-3">
                    <SignaturePad
                      onConfirm={handleAmSign}
                      onCancel={() => setShowSignature(false)}
                      disabled={saving}
                    />
                  </div>
                )}
                {editing?.risk_acceptance_signature && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground">Stored signature</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={editing?.risk_acceptance_signature}
                      alt="Risk acceptance signature"
                      className="mt-1 max-h-24 rounded border bg-white"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setQuickMitOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddMitigationBeforeSave}>
              Add mitigation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SmsHazardRegisterPage
