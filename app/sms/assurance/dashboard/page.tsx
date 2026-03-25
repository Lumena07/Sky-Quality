'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { AlertTriangle, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
type SpiRow = {
  id: string
  spiCode: string
  name: string
  description: string | null
  measurementMethod: string | null
  dataSource: string
  reportingFrequency: string
  targetValue: number | null
  alertLevel: number | null
  calculationKey: string | null
  isSystemSpi: boolean
  currentValue: number
  alertState: string
  series: { period: string; value: number }[]
  extra?: { occurrenceBreakdown?: { byReportType: Record<string, number>; total: number } }
}

type DashboardPayload = {
  summary: {
    openHazards: number
    openInvestigations: number
    overdueCapas: number
    trainingCompliancePct: number
    nextAuditDue: string | null
    openMeetingActionsUser: number
    openMeetingActionsOrg: number
  }
  spis: SpiRow[]
  meetingCadence: {
    meetingType: string
    label: string
    lastHeldAt: string | null
    daysSince: number | null
    isOverdue: boolean
  }[]
  internalAuditCompliance: {
    area: string
    label: string
    lastClosedAt: string | null
    isOverdue: boolean
  }[]
}

const AssuranceDashboardPage = () => {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [expandedSpi, setExpandedSpi] = useState<string | null>(null)
  const [addSpiOpen, setAddSpiOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState<{ spiId: string; name: string } | null>(null)
  const [newSpi, setNewSpi] = useState({
    spiCode: '',
    name: '',
    reportingFrequency: 'MONTHLY',
    targetValue: '',
    alertLevel: '',
  })
  const [manualForm, setManualForm] = useState({ periodStart: '', periodEnd: '', value: '' })
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editSpi, setEditSpi] = useState<SpiRow | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    measurementMethod: '',
    reportingFrequency: '',
    targetValue: '',
    alertLevel: '',
  })
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
    isDefault: boolean
  } | null>(null)

  const isDos = roles.includes('DIRECTOR_OF_SAFETY')

  const loadDashboard = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch('/api/sms/assurance/dashboard', { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Failed to load dashboard')
      setData(await res.json())
    } catch {
      setLoadError('Could not load assurance dashboard.')
      setData(null)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    const run = async () => {
      const res = await fetch('/api/me', { credentials: 'same-origin' })
      if (!res.ok) return
      const me = await res.json()
      setRoles(Array.isArray(me.roles) ? me.roles : [])
    }
    run()
  }, [])

  const handleCreateSpi = async () => {
    const res = await fetch('/api/sms/spis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        spiCode: newSpi.spiCode,
        name: newSpi.name,
        reportingFrequency: newSpi.reportingFrequency,
        targetValue: newSpi.targetValue ? Number(newSpi.targetValue) : null,
        alertLevel: newSpi.alertLevel ? Number(newSpi.alertLevel) : null,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to create SPI')
      return
    }
    setAddSpiOpen(false)
    setNewSpi({ spiCode: '', name: '', reportingFrequency: 'MONTHLY', targetValue: '', alertLevel: '' })
    loadDashboard()
  }

  const handleOpenEdit = (spi: SpiRow) => {
    setEditSpi(spi)
    setEditForm({
      name: spi.name,
      description: spi.description ?? '',
      measurementMethod: spi.measurementMethod ?? '',
      reportingFrequency: spi.reportingFrequency,
      targetValue: spi.targetValue != null ? String(spi.targetValue) : '',
      alertLevel: spi.alertLevel != null ? String(spi.alertLevel) : '',
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editSpi || !editForm.name.trim()) return
    const res = await fetch(`/api/sms/spis/${editSpi.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        measurementMethod: editForm.measurementMethod,
        reportingFrequency: editForm.reportingFrequency.trim(),
        targetValue: editForm.targetValue === '' ? null : Number(editForm.targetValue),
        alertLevel: editForm.alertLevel === '' ? null : Number(editForm.alertLevel),
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to update SPI')
      return
    }
    setEditDialogOpen(false)
    setEditSpi(null)
    loadDashboard()
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    const res = await fetch(`/api/sms/spis/${id}`, { method: 'DELETE', credentials: 'same-origin' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to delete SPI')
      return
    }
    setDeleteTarget(null)
    setExpandedSpi((prev) => (prev === id ? null : prev))
    setEditDialogOpen(false)
    setEditSpi(null)
    loadDashboard()
  }

  const handleManualValue = async () => {
    if (!manualOpen) return
    const res = await fetch(`/api/sms/spis/${manualOpen.spiId}/values`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        periodStart: manualForm.periodStart,
        periodEnd: manualForm.periodEnd,
        value: Number(manualForm.value),
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to save value')
      return
    }
    setManualOpen(null)
    setManualForm({ periodStart: '', periodEnd: '', value: '' })
    loadDashboard()
  }

  const alertBadge = (state: string) => {
    if (state === 'critical') return <Badge variant="destructive">Alert</Badge>
    if (state === 'warning') return <Badge className="bg-amber-500 hover:bg-amber-600">Watch</Badge>
    return <Badge variant="secondary">OK</Badge>
  }

  if (loadError) {
    return (
      <div className="p-8">
        <p className="text-destructive">{loadError}</p>
        <Button type="button" className="mt-4" onClick={() => loadDashboard()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!data) {
    return <div className="p-8 text-muted-foreground">Loading safety performance dashboard…</div>
  }

  const { summary, spis, meetingCadence, internalAuditCompliance } = data

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Safety performance dashboard</h1>
          <p className="text-muted-foreground mt-1">
            SPI trends, summary indicators, and assurance cadence (last 12 months).
          </p>
        </div>
        {isDos ? (
          <Dialog open={addSpiOpen} onOpenChange={setAddSpiOpen}>
            <DialogTrigger asChild>
              <Button type="button" className="gap-2">
                <Plus className="h-4 w-4" aria-hidden />
                Add custom SPI
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>New manual SPI</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="space-y-2">
                  <Label htmlFor="spi-code">SPI code</Label>
                  <Input
                    id="spi-code"
                    value={newSpi.spiCode}
                    onChange={(e) => setNewSpi((p) => ({ ...p, spiCode: e.target.value }))}
                    placeholder="SPI-CUSTOM-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spi-name">Name</Label>
                  <Input
                    id="spi-name"
                    value={newSpi.name}
                    onChange={(e) => setNewSpi((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spi-freq">Reporting frequency</Label>
                  <Input
                    id="spi-freq"
                    value={newSpi.reportingFrequency}
                    onChange={(e) => setNewSpi((p) => ({ ...p, reportingFrequency: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="spi-target">Target (optional)</Label>
                    <Input
                      id="spi-target"
                      type="number"
                      value={newSpi.targetValue}
                      onChange={(e) => setNewSpi((p) => ({ ...p, targetValue: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spi-alert">Alert level (optional)</Label>
                    <Input
                      id="spi-alert"
                      type="number"
                      value={newSpi.alertLevel}
                      onChange={(e) => setNewSpi((p) => ({ ...p, alertLevel: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setAddSpiOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void handleCreateSpi()}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open hazards</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.openHazards}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open investigations</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.openInvestigations}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue CAPAs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{summary.overdueCapas}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Training compliance</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.trainingCompliancePct}%</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Next SMS audit due</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {summary.nextAuditDue ?? '—'}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meeting cadence</CardTitle>
            <CardDescription>SRB quarterly; SAG and Safety Committee monthly (indicative).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {meetingCadence.map((m) => (
              <div
                key={m.meetingType}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{m.label}</span>
                {m.isOverdue ? (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    Overdue
                  </span>
                ) : (
                  <span className="text-muted-foreground">On track</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Internal SMS audit coverage</CardTitle>
            <CardDescription>At least one internal SMS audit per operational area per year.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {internalAuditCompliance.map((a) => (
              <div
                key={a.area}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>{a.label}</span>
                {a.isOverdue ? (
                  <Badge variant="destructive">Overdue / none</Badge>
                ) : (
                  <Badge variant="secondary">Last {a.lastClosedAt}</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outstanding meeting actions</CardTitle>
          <CardDescription>Open actions assigned to you vs organisation total.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-8 text-lg">
          <div>
            <span className="text-muted-foreground text-sm block">Yours</span>
            <span className="font-semibold">{summary.openMeetingActionsUser}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-sm block">Organisation</span>
            <span className="font-semibold">{summary.openMeetingActionsOrg}</span>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">Safety performance indicators</h2>
        <div className="space-y-3">
          {spis.map((spi) => {
            const open = expandedSpi === spi.id
            return (
              <Card key={spi.id} className="overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/40"
                  onClick={() => setExpandedSpi(open ? null : spi.id)}
                  aria-expanded={open}
                >
                  {open ? (
                    <ChevronDown className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
                  ) : (
                    <ChevronRight className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{spi.name}</span>
                      {alertBadge(spi.alertState)}
                      <Badge variant="outline">{spi.dataSource}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{spi.description}</p>
                    <p className="text-sm mt-2">
                      Current: <strong>{spi.currentValue}</strong>
                      {spi.targetValue != null ? (
                        <span className="text-muted-foreground"> · Target {spi.targetValue}</span>
                      ) : null}
                    </p>
                  </div>
                  {isDos ? (
                    <div className="flex shrink-0 flex-wrap gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenEdit(spi)
                        }}
                        aria-label={`Edit ${spi.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 text-destructive border-destructive/50 hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget({
                            id: spi.id,
                            name: spi.name,
                            isDefault: spi.isSystemSpi,
                          })
                        }}
                        aria-label={`Delete ${spi.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Delete
                      </Button>
                      {!spi.calculationKey ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setManualOpen({ spiId: spi.id, name: spi.name })
                          }}
                        >
                          Add period value
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </button>
                {open ? (
                  <CardContent className="border-t border-border pb-6">
                    <dl className="grid gap-2 text-sm mb-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Measurement</dt>
                        <dd>{spi.measurementMethod ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Frequency</dt>
                        <dd>{spi.reportingFrequency}</dd>
                      </div>
                    </dl>
                    {spi.extra?.occurrenceBreakdown ? (
                      <p className="text-sm text-muted-foreground mb-4">
                        Latest month occurrence total: {spi.extra.occurrenceBreakdown.total} (see risk reporting for
                        detail).
                      </p>
                    ) : null}
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={spi.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} width={40} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            )
          })}
        </div>
      </div>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialogOpen(false)
            setEditSpi(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit safety performance indicator</DialogTitle>
          </DialogHeader>
          {editSpi ? (
            <div className="grid gap-3 py-2">
              <p className="text-sm text-muted-foreground">
                Code: <span className="font-mono text-foreground">{editSpi.spiCode}</span>
                {editSpi.calculationKey ? (
                  <span className="block mt-1">Auto-calculated metric; you can adjust labels, SPT, and alert level.</span>
                ) : null}
              </p>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-method">Measurement method</Label>
                <Textarea
                  id="edit-method"
                  value={editForm.measurementMethod}
                  onChange={(e) => setEditForm((p) => ({ ...p, measurementMethod: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-freq">Reporting frequency</Label>
                <Input
                  id="edit-freq"
                  value={editForm.reportingFrequency}
                  onChange={(e) => setEditForm((p) => ({ ...p, reportingFrequency: e.target.value }))}
                  placeholder="MONTHLY or QUARTERLY"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-spt">Safety performance target (SPT)</Label>
                  <Input
                    id="edit-spt"
                    type="number"
                    value={editForm.targetValue}
                    onChange={(e) => setEditForm((p) => ({ ...p, targetValue: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-alert">Alert level</Label>
                  <Input
                    id="edit-alert"
                    type="number"
                    value={editForm.alertLevel}
                    onChange={(e) => setEditForm((p) => ({ ...p, alertLevel: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditDialogOpen(false)
                setEditSpi(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSaveEdit()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete SPI?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove <strong>{deleteTarget?.name}</strong> from the register and delete all stored period values
            for it. Policy objectives linked to this SPI will be unlinked.
          </p>
          {deleteTarget?.isDefault ? (
            <p className="text-sm text-amber-700 dark:text-amber-500">
              This is a default indicator. It will not come back automatically; add a custom SPI or restore data manually
              if you need it again.
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleConfirmDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(manualOpen)} onOpenChange={(o) => !o && setManualOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record value — {manualOpen?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="p-start">Period start</Label>
              <Input
                id="p-start"
                type="date"
                value={manualForm.periodStart}
                onChange={(e) => setManualForm((p) => ({ ...p, periodStart: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-end">Period end</Label>
              <Input
                id="p-end"
                type="date"
                value={manualForm.periodEnd}
                onChange={(e) => setManualForm((p) => ({ ...p, periodEnd: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-val">Value</Label>
              <Input
                id="p-val"
                type="number"
                value={manualForm.value}
                onChange={(e) => setManualForm((p) => ({ ...p, value: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setManualOpen(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleManualValue()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AssuranceDashboardPage
