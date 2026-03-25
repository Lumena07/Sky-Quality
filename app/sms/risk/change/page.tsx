'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { formatDateOnly } from '@/lib/utils'
import { isAccountableManager, isDirectorOfSafety } from '@/lib/permissions'
import { INTRODUCES_HAZARDS, MOC_CHANGE_TYPES, MOC_STATUSES } from '@/lib/sms-workflow-constants'
import { LIKELIHOOD_LABELS, SEVERITY_LABELS, riskIndexToLevel } from '@/lib/sms-risk-constants'

type Me = { id: string; roles: string[] }

type MocRow = {
  id: string
  change_number: string
  title: string
  status: string
  operational_area: string
  proposed_by: string | null
  initial_risk_level: string | null
  initial_likelihood: number | null
  initial_severity: number | null
  sms_moc_hazard_links?: { hazard_id: string }[]
}

type HazardOpt = { id: string; hazard_number: string; title: string }

const SmsMocPage = () => {
  const [me, setMe] = useState<Me | null>(null)
  const [list, setList] = useState<MocRow[]>([])
  const [hazards, setHazards] = useState<HazardOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [changeType, setChangeType] = useState('OPERATIONAL')
  const [opArea, setOpArea] = useState('all')
  const [implDate, setImplDate] = useState('')
  const [introduces, setIntroduces] = useState('UNKNOWN')
  const [safetyNotes, setSafetyNotes] = useState('')
  const [likelihood, setLikelihood] = useState('3')
  const [severity, setSeverity] = useState('3')
  const [status, setStatus] = useState('DRAFT')
  const [hazardIds, setHazardIds] = useState<string[]>([])
  const [postReviewDate, setPostReviewDate] = useState('')
  const [postReviewOutcome, setPostReviewOutcome] = useState('')
  const [dosNotes, setDosNotes] = useState('')
  const [approvalConditions, setApprovalConditions] = useState('')
  const [showAmSign, setShowAmSign] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sms/moc', { credentials: 'same-origin' })
      if (res.ok) setList(await res.json())
      else setList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    fetch('/api/me', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then(setMe)
    fetch('/api/sms/hazards', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setHazards(d.map((x: HazardOpt) => ({ id: x.id, hazard_number: x.hazard_number, title: x.title }))) : []))
  }, [load])

  const riskPreview = () => {
    const L = Math.min(5, Math.max(1, Number(likelihood)))
    const S = Math.min(5, Math.max(1, Number(severity)))
    return riskIndexToLevel(L * S)
  }

  const openNew = () => {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setChangeType('OPERATIONAL')
    setOpArea('all')
    setImplDate('')
    setIntroduces('UNKNOWN')
    setSafetyNotes('')
    setLikelihood('3')
    setSeverity('3')
    setStatus('DRAFT')
    setHazardIds([])
    setPostReviewDate('')
    setPostReviewOutcome('')
    setDosNotes('')
    setApprovalConditions('')
    setShowAmSign(false)
    setDialogOpen(true)
  }

  const openEdit = async (id: string) => {
    const res = await fetch(`/api/sms/moc/${id}`, { credentials: 'same-origin' })
    if (!res.ok) return
    const d = await res.json()
    setEditingId(id)
    setTitle(d.title || '')
    setDescription(d.description || '')
    setChangeType(d.change_type || 'OPERATIONAL')
    setOpArea(d.operational_area || 'all')
    setImplDate(d.implementation_date ? d.implementation_date.slice(0, 10) : '')
    setIntroduces(d.introduces_new_hazards || 'UNKNOWN')
    setSafetyNotes(d.safety_impact_notes || '')
    setLikelihood(String(d.initial_likelihood ?? 3))
    setSeverity(String(d.initial_severity ?? 3))
    setStatus(d.status || 'DRAFT')
    const links = d.sms_moc_hazard_links ?? []
    setHazardIds(links.map((x: { hazard_id: string }) => String(x.hazard_id)))
    setPostReviewDate(d.post_review_date ? d.post_review_date.slice(0, 10) : '')
    setPostReviewOutcome(d.post_review_outcome || '')
    setDosNotes(d.dos_review_notes || '')
    setApprovalConditions(d.approval_conditions || '')
    setShowAmSign(false)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) return
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        changeType,
        operationalArea: opArea,
        implementationDate: implDate || null,
        introducesNewHazards: introduces,
        safetyImpactNotes: safetyNotes,
        initialLikelihood: Number(likelihood),
        initialSeverity: Number(severity),
        status,
        hazardIds,
        postReviewDate: postReviewDate || null,
        postReviewOutcome: postReviewOutcome || null,
      }
      if (editingId) {
        const res = await fetch(`/api/sms/moc/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          alert(err.error || 'Save failed')
          return
        }
      } else {
        const res = await fetch('/api/sms/moc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          alert(err.error || 'Create failed')
          return
        }
      }
      setDialogOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleDosReview = async () => {
    if (!editingId) return
    const res = await fetch(`/api/sms/moc/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        dosReviewNotes: dosNotes,
        statusAfterReview: 'UNDER_ASSESSMENT',
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed')
      return
    }
    load()
  }

  const handleDosApprove = async () => {
    if (!editingId) return
    const res = await fetch(`/api/sms/moc/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        approveAsDos: true,
        approvalStatus: approvalConditions.trim() ? 'APPROVED_WITH_CONDITIONS' : 'APPROVED',
        approvalConditions: approvalConditions.trim() || undefined,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed')
      return
    }
    setDialogOpen(false)
    load()
  }

  const handleAmSign = async (sig: string | null) => {
    if (!editingId || !sig) {
      setShowAmSign(false)
      return
    }
    const res = await fetch(`/api/sms/moc/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ amApprovalSignature: sig }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed')
      return
    }
    setShowAmSign(false)
    setDialogOpen(false)
    load()
  }

  const toggleHazard = (id: string) => {
    setHazardIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  const isDos = me && isDirectorOfSafety(me.roles)
  const isAm = me && isAccountableManager(me.roles)

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Management of change</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Formal safety assessment for operational, organisational, and systems changes.
          </p>
        </div>
        <Button type="button" onClick={openNew}>
          Propose change
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>MoC register</CardTitle>
          <CardDescription>{loading ? 'Loading…' : `${list.length} record(s)`}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2 font-medium">Number</th>
                <th className="p-2 font-medium">Title</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b hover:bg-muted/50"
                  tabIndex={0}
                  role="button"
                  onClick={() => openEdit(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openEdit(r.id)
                    }
                  }}
                >
                  <td className="p-2 font-mono text-xs">{r.change_number}</td>
                  <td className="p-2">{r.title}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">{r.initial_risk_level ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto" aria-describedby="moc-desc">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit MoC' : 'New MoC'}</DialogTitle>
            <DialogDescription id="moc-desc">Complete safety impact and risk assessment.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Change type</Label>
              <Select value={changeType} onValueChange={setChangeType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOC_CHANGE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Operational area</Label>
              <Select value={opArea} onValueChange={setOpArea}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="airline_ops">Airline Ops</SelectItem>
                  <SelectItem value="mro_maintenance">MRO</SelectItem>
                  <SelectItem value="airport_ground_ops">Airport-Ground</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Implementation date</Label>
              <Input type="date" value={implDate} onChange={(e) => setImplDate(e.target.value)} />
            </div>
            <div>
              <Label>New hazards?</Label>
              <Select value={introduces} onValueChange={setIntroduces}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTRODUCES_HAZARDS.map((x) => (
                    <SelectItem key={x.value} value={x.value}>
                      {x.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Likelihood (1–5)</Label>
              <Select value={likelihood} onValueChange={setLikelihood}>
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
            <div>
              <Label>Severity (1–5)</Label>
              <Select value={severity} onValueChange={setSeverity}>
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
            <p className="text-sm text-muted-foreground md:col-span-2">Risk band: {riskPreview()}</p>
            <div className="md:col-span-2">
              <Label>Safety impact notes</Label>
              <Textarea value={safetyNotes} onChange={(e) => setSafetyNotes(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOC_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Linked hazards</Label>
            <div className="max-h-28 overflow-y-auto rounded border p-2 text-sm">
              {hazards.map((h) => (
                <label key={h.id} className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={hazardIds.includes(h.id)} onChange={() => toggleHazard(h.id)} />
                  {h.hazard_number} — {h.title}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <Label>Post-implementation review date</Label>
              <Input type="date" value={postReviewDate} onChange={(e) => setPostReviewDate(e.target.value)} />
            </div>
            <div>
              <Label>Post-implementation outcome</Label>
              <Input value={postReviewOutcome} onChange={(e) => setPostReviewOutcome(e.target.value)} />
            </div>
          </div>

          {editingId && isDos && (
            <div className="space-y-2 border-t pt-4">
              <Label>DoS review notes</Label>
              <Textarea value={dosNotes} onChange={(e) => setDosNotes(e.target.value)} rows={2} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={handleDosReview}>
                  Record review
                </Button>
                <Input
                  placeholder="Approval conditions (optional)"
                  value={approvalConditions}
                  onChange={(e) => setApprovalConditions(e.target.value)}
                  className="max-w-xs"
                />
                <Button type="button" size="sm" onClick={handleDosApprove}>
                  Approve (DoS)
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    const reason = prompt('Rejection reason?')
                    if (!reason || !editingId) return
                    await fetch(`/api/sms/moc/${editingId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'same-origin',
                      body: JSON.stringify({ rejectionReason: reason }),
                    })
                    setDialogOpen(false)
                    load()
                  }}
                >
                  Reject
                </Button>
              </div>
            </div>
          )}

          {editingId && isAm && riskPreview() === 'UNACCEPTABLE' && (
            <div className="border-t pt-4">
              {!showAmSign ? (
                <Button type="button" variant="secondary" onClick={() => setShowAmSign(true)}>
                  Accountable Manager approval (unacceptable risk)
                </Button>
              ) : (
                <SignaturePad onConfirm={handleAmSign} onCancel={() => setShowAmSign(false)} />
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SmsMocPage
