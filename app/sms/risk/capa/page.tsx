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
import { formatDateOnly } from '@/lib/utils'
import { isDirectorOfSafety, isSafetyOfficer } from '@/lib/permissions'
import {
  CAPA_PRIORITIES,
  CAPA_SOURCE_TYPES,
  CAPA_STATUSES,
  CAPA_TYPES,
  EFFECTIVENESS_OUTCOMES,
} from '@/lib/sms-workflow-constants'

type Me = { id: string; roles: string[] }

type CapaRow = {
  id: string
  capa_number: string
  capa_type: string
  description: string
  status: string
  displayStatus?: string
  isOverdue?: boolean
  target_completion_date: string
  assigned_owner_id: string | null
  priority: string
  completion_evidence: string | null
  effectiveness_outcome: string | null
}

const SmsCapaPage = () => {
  const [me, setMe] = useState<Me | null>(null)
  const [list, setList] = useState<CapaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CapaRow | null>(null)
  const [saving, setSaving] = useState(false)

  const [description, setDescription] = useState('')
  const [capaType, setCapaType] = useState('CORRECTIVE')
  const [sourceType, setSourceType] = useState('manual')
  const [sourceId, setSourceId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [status, setStatus] = useState('OPEN')
  const [completionEvidence, setCompletionEvidence] = useState('')
  const [attachments, setAttachments] = useState<{ fileUrl: string; name: string }[]>([])
  const [effectiveness, setEffectiveness] = useState('EFFECTIVE')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sms/capas', { credentials: 'same-origin' })
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
      .then((u) => {
        setMe(u)
        setOwnerId(u.id ?? '')
      })
  }, [load])

  const openNew = () => {
    setEditing(null)
    setDescription('')
    setCapaType('CORRECTIVE')
    setSourceType('manual')
    setSourceId('')
    setOwnerId(me?.id ?? '')
    setTargetDate('')
    setPriority('MEDIUM')
    setStatus('OPEN')
    setCompletionEvidence('')
    setAttachments([])
    setDialogOpen(true)
  }

  const openEdit = async (id: string) => {
    const res = await fetch(`/api/sms/capas/${id}`, { credentials: 'same-origin' })
    if (!res.ok) return
    const d = await res.json()
    setEditing(d)
    setDescription(d.description || '')
    setCapaType(String(d.capa_type || 'CORRECTIVE').toUpperCase())
    setSourceType(d.source_type || 'manual')
    setSourceId(d.source_id || '')
    setOwnerId(d.assigned_owner_id || '')
    setTargetDate(d.target_completion_date ? d.target_completion_date.slice(0, 10) : '')
    setPriority(String(d.priority || 'MEDIUM').toUpperCase())
    setStatus(String(d.status || 'OPEN').toUpperCase())
    setCompletionEvidence(d.completion_evidence || '')
    setAttachments(Array.isArray(d.completion_attachments) ? d.completion_attachments : [])
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!description.trim() || !targetDate) return
    setSaving(true)
    try {
      if (editing) {
        const res = await fetch(`/api/sms/capas/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            description: description.trim(),
            targetCompletionDate: targetDate,
            status,
            completionEvidence: completionEvidence || null,
            completionAttachments: attachments,
            assignedOwnerId: ownerId || null,
            capaType,
            priority,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          alert(err.error || 'Save failed')
          return
        }
      } else {
        const res = await fetch('/api/sms/capas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            description: description.trim(),
            capaType,
            sourceType,
            sourceId: sourceId || null,
            assignedOwnerId: ownerId || null,
            targetCompletionDate: targetDate,
            priority,
            status,
          }),
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

  const handleEffectiveness = async () => {
    if (!editing) return
    const res = await fetch(`/api/sms/capas/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ effectivenessOutcome: effectiveness }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed')
      return
    }
    setDialogOpen(false)
    load()
  }

  const handleUpload = async (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    const fd = new FormData()
    fd.append('file', f)
    fd.append('entityType', 'sms-capa')
    fd.append('entityId', editing?.id || 'new')
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) return
    const data = await res.json()
    if (data.fileUrl) {
      setAttachments((a) => [...a, { fileUrl: data.fileUrl, name: data.fileName || f.name }])
    }
  }

  const canVerify = me && (isDirectorOfSafety(me.roles) || isSafetyOfficer(me.roles))

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Corrective and preventive actions</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            CAPAs from investigations, hazards, audits, and meetings. Overdue items notify owner, Safety Officers, and
            Director of Safety.
          </p>
        </div>
        <Button type="button" onClick={openNew}>
          New CAPA
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CAPA register</CardTitle>
          <CardDescription>{loading ? 'Loading…' : `${list.length} record(s)`}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2 font-medium">Number</th>
                <th className="p-2 font-medium">Type</th>
                <th className="p-2 font-medium">Due</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Priority</th>
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
                  <td className="p-2 font-mono text-xs">{r.capa_number}</td>
                  <td className="p-2">{r.capa_type}</td>
                  <td className="p-2">{formatDateOnly(r.target_completion_date)}</td>
                  <td className="p-2">
                    <span className={r.isOverdue ? 'font-semibold text-destructive' : ''}>
                      {r.displayStatus || r.status}
                    </span>
                  </td>
                  <td className="p-2">{r.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto" aria-describedby="capa-desc">
          <DialogHeader>
            <DialogTitle>{editing ? editing.capa_number : 'New CAPA'}</DialogTitle>
            <DialogDescription id="capa-desc">Track actions through completion and effectiveness.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Type</Label>
                <Select value={capaType} onValueChange={setCapaType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAPA_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAPA_PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Source</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAPA_SOURCE_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source record ID</Label>
              <Input value={sourceId} onChange={(e) => setSourceId(e.target.value)} placeholder="UUID or reference" />
            </div>
            <div>
              <Label>Assigned owner (user id)</Label>
              <Input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} />
            </div>
            <div>
              <Label>Target completion</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
            <div>
              <Label>Workflow status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAPA_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Completion evidence</Label>
              <Textarea value={completionEvidence} onChange={(e) => setCompletionEvidence(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Attachments</Label>
              <Input type="file" onChange={(e) => handleUpload(e.target.files)} />
              <ul className="mt-1 text-xs">
                {attachments.map((a) => (
                  <li key={a.fileUrl}>
                    <a href={a.fileUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                      {a.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            {editing && canVerify && (
              <div className="border-t pt-3">
                <Label>Effectiveness verification</Label>
                <Select value={effectiveness} onValueChange={setEffectiveness}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EFFECTIVENESS_OUTCOMES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" className="mt-2" variant="secondary" onClick={handleEffectiveness}>
                  Submit verification
                </Button>
              </div>
            )}
          </div>

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

export default SmsCapaPage
