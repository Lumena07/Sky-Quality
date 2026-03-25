'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ClipboardList, Loader2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  SMS_AUDIT_TYPE_OPTIONS,
  getDefaultSmsAuditChecklist,
  type ChecklistItem,
} from '@/lib/sms-audit-checklist-templates'
import { internalAuditComplianceByArea } from '@/lib/sms-internal-audit-compliance'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type AuditRow = {
  id: string
  audit_number: string
  title: string
  audit_type: string
  operational_area: string
  status: string
  planned_date: string | null
  actual_date: string | null
  lead_auditor_id: string | null
  audit_team_user_ids?: string[]
  scope: string | null
  checklist: ChecklistItem[]
  report_url: string | null
  dos_signoff_at: string | null
}

type FindingRow = {
  id: string
  finding_number: string
  description: string
  category: string
  linked_sms_element: string | null
  risk_level: string | null
  linked_capa_id: string | null
  status: string
}

const STATUS_OPTIONS = ['PLANNED', 'IN_PROGRESS', 'PENDING_REVIEW', 'CLOSED'] as const

const SmsAssuranceAuditsPage = () => {
  const [tab, setTab] = useState('list')
  const [audits, setAudits] = useState<AuditRow[]>([])
  const [calendar, setCalendar] = useState<{ smsAudits: AuditRow[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ audit: AuditRow; findings: FindingRow[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  const [form, setForm] = useState({
    title: '',
    auditType: 'INTERNAL_SMS_AUDIT',
    operationalArea: 'airline_ops',
    plannedDate: '',
    scope: '',
  })

  const [newFinding, setNewFinding] = useState({
    description: '',
    category: 'OBSERVATION',
  })

  const compliance = useMemo(
    () =>
      internalAuditComplianceByArea(
        audits.map((a) => ({
          operational_area: a.operational_area,
          audit_type: a.audit_type,
          status: a.status,
          actual_date: a.actual_date,
          planned_date: a.planned_date,
        }))
      ),
    [audits]
  )

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sms/audits', { credentials: 'same-origin' })
      if (res.ok) setAudits(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCalendar = useCallback(async () => {
    const res = await fetch('/api/sms/audits/calendar', { credentials: 'same-origin' })
    if (res.ok) setCalendar(await res.json())
  }, [])

  useEffect(() => {
    loadList()
    loadCalendar()
  }, [loadList, loadCalendar])

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('auditId')
    if (id) setSelectedId(id)
  }, [])

  useEffect(() => {
    const run = async () => {
      const res = await fetch('/api/me', { credentials: 'same-origin' })
      if (!res.ok) return
      const me = await res.json()
      const r = Array.isArray(me.roles) ? me.roles : []
      setCanEdit(
        r.includes('DIRECTOR_OF_SAFETY') || r.includes('SAFETY_OFFICER') || r.includes('QUALITY_MANAGER')
      )
    }
    run()
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/sms/audits/${id}`, { credentials: 'same-origin' })
      if (res.ok) {
        const j = await res.json()
        setDetail({ audit: j.audit, findings: j.findings ?? [] })
      }
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId, loadDetail])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const res = await fetch('/api/sms/audits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        title: form.title,
        auditType: form.auditType,
        operationalArea: form.operationalArea,
        plannedDate: form.plannedDate || null,
        scope: form.scope || null,
        useDefaultChecklist: true,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to create audit')
      return
    }
    const created = await res.json()
    setForm({ title: '', auditType: 'INTERNAL_SMS_AUDIT', operationalArea: 'airline_ops', plannedDate: '', scope: '' })
    await loadList()
    await loadCalendar()
    setSelectedId(created.id)
    setTab('list')
  }

  const patchAudit = async (patch: Record<string, unknown>) => {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sms/audits/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Update failed')
        return
      }
      await loadDetail(selectedId)
      await loadList()
      await loadCalendar()
    } finally {
      setSaving(false)
    }
  }

  const handleChecklistChange = (items: ChecklistItem[]) => {
    if (!detail) return
    setDetail({ ...detail, audit: { ...detail.audit, checklist: items } })
  }

  const handleSaveChecklist = () => {
    if (!detail) return
    void patchAudit({ checklist: detail.audit.checklist })
  }

  const handleAddFinding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId || !newFinding.description.trim()) return
    const res = await fetch(`/api/sms/audits/${selectedId}/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        description: newFinding.description,
        category: newFinding.category,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed')
      return
    }
    setNewFinding({ description: '', category: 'OBSERVATION' })
    await loadDetail(selectedId)
  }

  const displayChecklist = (a: AuditRow) =>
    a.checklist?.length ? a.checklist : getDefaultSmsAuditChecklist(a.audit_type)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Safety audits and surveys</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Plan SMS audits, manage findings, and track internal audit coverage by operational area.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {compliance.map((c) => (
          <Badge
            key={c.area}
            variant={c.isOverdue ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {c.label}: {c.isOverdue ? 'overdue / none' : `last ${c.lastClosedAt}`}
          </Badge>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <ClipboardList className="h-4 w-4" aria-hidden />
            Audits
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="h-4 w-4" aria-hidden />
            Schedule
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6 mt-4">
          {canEdit ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New audit</CardTitle>
                <CardDescription>Creates an audit with the default checklist for the selected type.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={form.auditType}
                      onValueChange={(v) => setForm((p) => ({ ...p, auditType: v }))}
                    >
                      <SelectTrigger aria-label="Audit type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SMS_AUDIT_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Operational area</Label>
                    <Select
                      value={form.operationalArea}
                      onValueChange={(v) => setForm((p) => ({ ...p, operationalArea: v }))}
                    >
                      <SelectTrigger aria-label="Operational area">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="airline_ops">Airline</SelectItem>
                        <SelectItem value="mro_maintenance">MRO</SelectItem>
                        <SelectItem value="airport_ground_ops">Airport</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan">Planned date</Label>
                    <Input
                      id="plan"
                      type="date"
                      value={form.plannedDate}
                      onChange={(e) => setForm((p) => ({ ...p, plannedDate: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="scope">Scope</Label>
                    <Textarea
                      id="scope"
                      value={form.scope}
                      onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" className="gap-2">
                      <Plus className="h-4 w-4" aria-hidden />
                      Create audit
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Audit register</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
                ) : (
                  audits.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        selectedId === a.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="font-medium">{a.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {a.audit_number} · {a.status} · {a.planned_date ?? 'no date'}
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detail</CardTitle>
              </CardHeader>
              <CardContent>
                {detailLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading detail" />
                ) : !detail ? (
                  <p className="text-sm text-muted-foreground">Select an audit to view details.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge variant="outline">{detail.audit.status}</Badge>
                      {detail.audit.dos_signoff_at ? <Badge>DoS sign-off</Badge> : null}
                    </div>
                    {canEdit ? (
                      <div className="grid gap-2">
                        <Label htmlFor="st">Status</Label>
                        <Select
                          value={detail.audit.status}
                          onValueChange={(v) => void patchAudit({ status: v })}
                          disabled={saving}
                        >
                          <SelectTrigger id="st" aria-label="Audit status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Closing an audit records Director of Safety sign-off (DoS only).
                        </p>
                      </div>
                    ) : null}
                    <div>
                      <h3 className="text-sm font-medium mb-2">Checklist</h3>
                      <ul className="space-y-2">
                        {displayChecklist(detail.audit).map((item, idx) => (
                          <li key={item.id ?? idx} className="flex gap-2 text-sm border rounded-md p-2">
                            <input
                              type="checkbox"
                              checked={Boolean(item.done)}
                              disabled={!canEdit}
                              onChange={(e) => {
                                const list = [...displayChecklist(detail.audit)]
                                list[idx] = { ...list[idx], done: e.target.checked }
                                handleChecklistChange(list)
                              }}
                              aria-label={`Done: ${item.label}`}
                            />
                            <span className="flex-1">{item.label}</span>
                          </li>
                        ))}
                      </ul>
                      {canEdit ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="mt-2"
                          disabled={saving}
                          onClick={() => handleSaveChecklist()}
                        >
                          Save checklist
                        </Button>
                      ) : null}
                    </div>

                    {canEdit ? (
                      <form onSubmit={handleAddFinding} className="space-y-2 border-t pt-4">
                        <h3 className="text-sm font-medium">Add finding</h3>
                        <Textarea
                          value={newFinding.description}
                          onChange={(e) => setNewFinding((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Description"
                          rows={2}
                        />
                        <Select
                          value={newFinding.category}
                          onValueChange={(v) => setNewFinding((p) => ({ ...p, category: v }))}
                        >
                          <SelectTrigger aria-label="Finding category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OBSERVATION">Observation</SelectItem>
                            <SelectItem value="NON_CONFORMANCE">Non-conformance</SelectItem>
                            <SelectItem value="MAJOR_NON_CONFORMANCE">Major non-conformance</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button type="submit" size="sm">
                          Add finding
                        </Button>
                      </form>
                    ) : null}

                    <div className="border-t pt-4">
                      <h3 className="text-sm font-medium mb-2">Findings</h3>
                      <ul className="space-y-2 text-sm">
                        {detail.findings.map((f) => (
                          <li key={f.id} className="rounded-md border border-border p-2">
                            <div className="font-medium">
                              {f.finding_number} · {f.category}
                            </div>
                            <p className="text-muted-foreground mt-1">{f.description}</p>
                            <Badge variant="outline" className="mt-1">
                              {f.status}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Planned and actual dates</CardTitle>
              <CardDescription>SMS audits (from register).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(calendar?.smsAudits ?? []).map((a) => (
                <div key={a.id} className="flex justify-between border-b border-border py-2">
                  <span className="font-medium">{a.title}</span>
                  <span className="text-muted-foreground">
                    plan {a.planned_date ?? '—'} · actual {a.actual_date ?? '—'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default SmsAssuranceAuditsPage
