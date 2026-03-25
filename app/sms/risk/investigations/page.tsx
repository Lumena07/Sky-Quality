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
import { isDirectorOfSafety } from '@/lib/permissions'
import { INVESTIGATION_STATUSES, ROOT_CAUSE_METHODS } from '@/lib/sms-workflow-constants'

type Me = { id: string; roles: string[] }

type InvRow = {
  id: string
  investigation_number: string
  status: string
  lead_id: string | null
  target_completion_date: string | null
  opened_at: string
  operational_area: string
}

type ReportOpt = { id: string; report_number: string }

const FISH_KEYS = [
  { key: 'PEOPLE', label: 'People' },
  { key: 'PROCESS', label: 'Process' },
  { key: 'EQUIPMENT', label: 'Equipment' },
  { key: 'ENVIRONMENT', label: 'Environment' },
  { key: 'MANAGEMENT', label: 'Management' },
  { key: 'OTHER', label: 'Other' },
] as const

const SmsInvestigationsPage = () => {
  const [me, setMe] = useState<Me | null>(null)
  const [list, setList] = useState<InvRow[]>([])
  const [reports, setReports] = useState<ReportOpt[]>([])
  const [users, setUsers] = useState<{ id: string; firstName?: string; lastName?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [leadId, setLeadId] = useState('')
  const [status, setStatus] = useState('OPEN')
  const [targetDate, setTargetDate] = useState('')
  const [reportIds, setReportIds] = useState<string[]>([])
  const [teamUserIds, setTeamUserIds] = useState<string[]>([])
  const [eventDescription, setEventDescription] = useState('')
  const [immediateCauses, setImmediateCauses] = useState('')
  const [contributingText, setContributingText] = useState('')
  const [rootMethod, setRootMethod] = useState('FISHBONE')
  const [fishbone, setFishbone] = useState<Record<string, string>>({})
  const [fiveWhys, setFiveWhys] = useState<string[]>([''])
  const [rootCauseAnalysis, setRootCauseAnalysis] = useState('')
  const [safetyDeficiencies, setSafetyDeficiencies] = useState('')
  const [legacyRecommendations, setLegacyRecommendations] = useState('')
  const [requiresReg, setRequiresReg] = useState(false)
  const [regNotifDate, setRegNotifDate] = useState('')
  const [regRef, setRegRef] = useState('')
  const [reportFileUrl, setReportFileUrl] = useState('')
  const [recommendations, setRecommendations] = useState<
    { id: string; description: string; capa_id: string | null; sort_order: number }[]
  >([])
  const [newRecDesc, setNewRecDesc] = useState('')
  const [newRecCapaDue, setNewRecCapaDue] = useState('')
  const [showCloseSign, setShowCloseSign] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sms/investigations', { credentials: 'same-origin' })
      if (res.ok) setList(await res.json())
      else setList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList()
    fetch('/api/me', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then(setMe)
    fetch('/api/sms/reports', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => setReports(Array.isArray(d) ? d : []))
    fetch('/api/users', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d.slice(0, 200) : []))
  }, [loadList])

  const structuredPayload = () => {
    if (rootMethod === 'FISHBONE') {
      return { method: 'FISHBONE', fishbone }
    }
    return { method: 'FIVE_WHYS', fiveWhys: fiveWhys.filter((x) => x.trim()) }
  }

  const openNew = () => {
    setEditingId(null)
    setLeadId(me?.id ?? '')
    setStatus('OPEN')
    setTargetDate('')
    setReportIds([])
    setTeamUserIds([])
    setEventDescription('')
    setImmediateCauses('')
    setContributingText('')
    setRootMethod('FISHBONE')
    setFishbone({})
    setFiveWhys([''])
    setRootCauseAnalysis('')
    setSafetyDeficiencies('')
    setLegacyRecommendations('')
    setRequiresReg(false)
    setRegNotifDate('')
    setRegRef('')
    setReportFileUrl('')
    setRecommendations([])
    setNewRecDesc('')
    setNewRecCapaDue('')
    setShowCloseSign(false)
    setDialogOpen(true)
  }

  const openEdit = async (id: string) => {
    const res = await fetch(`/api/sms/investigations/${id}`, { credentials: 'same-origin' })
    if (!res.ok) return
    const d = await res.json()
    setEditingId(id)
    setLeadId(d.lead_id || '')
    setStatus(d.status || 'OPEN')
    setTargetDate(d.target_completion_date ? d.target_completion_date.slice(0, 10) : '')
    const rids = (d.sms_investigation_reports ?? []).map((x: { report_id: string }) => String(x.report_id))
    setReportIds(rids)
    const tids = (d.sms_investigation_team ?? []).map((x: { user_id: string }) => String(x.user_id))
    setTeamUserIds(tids)
    setEventDescription(d.event_description || '')
    setImmediateCauses(d.immediate_causes || '')
    setContributingText(d.contributing_factors || '')
    const s = d.contributing_factors_structured
    if (s && typeof s === 'object' && s.method === 'FIVE_WHYS' && Array.isArray(s.fiveWhys)) {
      setRootMethod('FIVE_WHYS')
      setFiveWhys(s.fiveWhys.length ? s.fiveWhys : [''])
    } else if (s && typeof s === 'object' && s.fishbone) {
      setRootMethod('FISHBONE')
      setFishbone(s.fishbone as Record<string, string>)
    } else {
      setRootMethod('FISHBONE')
      setFishbone({})
    }
    setRootCauseAnalysis(d.root_cause_analysis || '')
    setSafetyDeficiencies(d.safety_deficiencies || '')
    setLegacyRecommendations(d.recommendations || '')
    setRequiresReg(Boolean(d.requires_regulatory_notification))
    setRegNotifDate(d.regulatory_notification_date ? d.regulatory_notification_date.slice(0, 16) : '')
    setRegRef(d.regulatory_reference || '')
    setReportFileUrl(d.report_file_url || '')
    setShowCloseSign(false)

    const recRes = await fetch(`/api/sms/investigations/${id}/recommendations`, { credentials: 'same-origin' })
    if (recRes.ok) setRecommendations(await recRes.json())
    else setRecommendations([])

    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const team = teamUserIds.map((userId) => ({ userId }))
      const payload = {
        leadId: leadId || null,
        targetCompletionDate: targetDate || null,
        status,
        reportIds,
        team,
        eventDescription,
        immediateCauses,
        contributingFactors: contributingText,
        contributingFactorsStructured: structuredPayload(),
        rootCauseMethod: rootMethod,
        rootCauseAnalysis,
        safetyDeficiencies,
        recommendations: legacyRecommendations,
        requiresRegulatoryNotification: requiresReg,
        regulatoryNotificationDate: regNotifDate ? new Date(regNotifDate).toISOString() : null,
        regulatoryReference: regRef || null,
        reportFileUrl: reportFileUrl || null,
      }
      if (editingId) {
        const res = await fetch(`/api/sms/investigations/${editingId}`, {
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
        const res = await fetch('/api/sms/investigations', {
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
      loadList()
    } finally {
      setSaving(false)
    }
  }

  const handleAddRecommendation = async () => {
    if (!editingId || !newRecDesc.trim()) return
    const body: Record<string, unknown> = {
      description: newRecDesc.trim(),
      createCapa: Boolean(newRecCapaDue),
    }
    if (newRecCapaDue) {
      body.targetCompletionDate = newRecCapaDue
      body.capaType = 'CORRECTIVE'
      body.priority = 'MEDIUM'
    }
    const res = await fetch(`/api/sms/investigations/${editingId}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed')
      return
    }
    setNewRecDesc('')
    setNewRecCapaDue('')
    const recRes = await fetch(`/api/sms/investigations/${editingId}/recommendations`, { credentials: 'same-origin' })
    if (recRes.ok) setRecommendations(await recRes.json())
  }

  const handleUploadReport = async (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    const fd = new FormData()
    fd.append('file', f)
    fd.append('entityType', 'sms-investigation')
    fd.append('entityId', editingId || 'new')
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) return
    const data = await res.json()
    if (data.fileUrl) setReportFileUrl(data.fileUrl)
  }

  const handleClosureSign = async (sig: string | null) => {
    if (!editingId || !sig) {
      setShowCloseSign(false)
      return
    }
    const res = await fetch(`/api/sms/investigations/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ closureSignature: sig }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Closure failed')
      return
    }
    setShowCloseSign(false)
    setDialogOpen(false)
    loadList()
  }

  const toggleReport = (id: string) => {
    setReportIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleTeamUser = (id: string) => {
    setTeamUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const isDos = me && isDirectorOfSafety(me.roles)

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Safety investigations</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Open from occurrence reports or independently. Structured root-cause templates; link each recommendation to a
            CAPA before closure.
          </p>
        </div>
        <Button type="button" onClick={openNew}>
          New investigation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Investigations</CardTitle>
          <CardDescription>{loading ? 'Loading…' : `${list.length} record(s)`}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2 font-medium">Number</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Target</th>
                <th className="p-2 font-medium">Area</th>
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
                  <td className="p-2 font-mono text-xs">{r.investigation_number}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">{r.target_completion_date ? formatDateOnly(r.target_completion_date) : '—'}</td>
                  <td className="p-2">{r.operational_area}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto" aria-describedby="inv-dlg-desc">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit investigation' : 'New investigation'}</DialogTitle>
            <DialogDescription id="inv-dlg-desc">
              Complete sections below. Use fishbone or 5-Whys for contributing factors structure.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Lead user ID</Label>
              <Input value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="User id" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVESTIGATION_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target completion</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Linked occurrence reports</Label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded border p-2 text-sm">
              {reports.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={reportIds.includes(r.id)} onChange={() => toggleReport(r.id)} />
                  {r.report_number}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Team members</Label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded border p-2 text-sm">
              {users.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={teamUserIds.includes(u.id)} onChange={() => toggleTeamUser(u.id)} />
                  {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.id}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Event description</Label>
            <Textarea value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Immediate causes</Label>
            <Textarea value={immediateCauses} onChange={(e) => setImmediateCauses(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Contributing factors (free text)</Label>
            <Textarea value={contributingText} onChange={(e) => setContributingText(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Structured method</Label>
            <Select value={rootMethod} onValueChange={setRootMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOT_CAUSE_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {rootMethod === 'FISHBONE' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {FISH_KEYS.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Textarea
                    value={fishbone[key] ?? ''}
                    onChange={(e) => setFishbone((prev) => ({ ...prev, [key]: e.target.value }))}
                    rows={2}
                  />
                </div>
              ))}
            </div>
          )}

          {rootMethod === 'FIVE_WHYS' && (
            <div className="space-y-2">
              {fiveWhys.map((w, i) => (
                <div key={i} className="flex gap-2">
                  <span className="w-16 shrink-0 text-sm text-muted-foreground">Why {i + 1}</span>
                  <Input
                    value={w}
                    onChange={(e) => {
                      const next = [...fiveWhys]
                      next[i] = e.target.value
                      setFiveWhys(next)
                    }}
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setFiveWhys((p) => [...p, ''])}>
                Add why
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label>Root cause analysis</Label>
            <Textarea value={rootCauseAnalysis} onChange={(e) => setRootCauseAnalysis(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Safety deficiencies identified</Label>
            <Textarea value={safetyDeficiencies} onChange={(e) => setSafetyDeficiencies(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Recommendations (legacy notes)</Label>
            <Textarea
              value={legacyRecommendations}
              onChange={(e) => setLegacyRecommendations(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={requiresReg} onChange={(e) => setRequiresReg(e.target.checked)} />
              Mandatory regulatory notification
            </label>
          </div>
          {requiresReg && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Notification date</Label>
                <Input
                  type="datetime-local"
                  value={regNotifDate}
                  onChange={(e) => setRegNotifDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Authority reference</Label>
                <Input value={regRef} onChange={(e) => setRegRef(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Investigation report file</Label>
            <Input type="file" onChange={(e) => handleUploadReport(e.target.files)} />
            {reportFileUrl && (
              <a href={reportFileUrl} className="text-sm text-primary underline" target="_blank" rel="noreferrer">
                Current file
              </a>
            )}
          </div>

          {editingId && (
            <div className="space-y-2 border-t pt-4">
              <h3 className="font-medium">Recommendations and CAPAs</h3>
              <ul className="space-y-1 text-sm">
                {recommendations.map((rec) => (
                  <li key={rec.id}>
                    {rec.description} — {rec.capa_id ? `CAPA linked` : 'No CAPA'}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="New recommendation"
                  value={newRecDesc}
                  onChange={(e) => setNewRecDesc(e.target.value)}
                />
                <Input
                  type="date"
                  value={newRecCapaDue}
                  onChange={(e) => setNewRecCapaDue(e.target.value)}
                  title="If set, creates CAPA with this due date"
                />
                <Button type="button" variant="secondary" onClick={handleAddRecommendation}>
                  Add
                </Button>
              </div>
            </div>
          )}

          {editingId && isDos && (
            <div className="border-t pt-4">
              {!showCloseSign ? (
                <Button type="button" variant="secondary" onClick={() => setShowCloseSign(true)}>
                  Close investigation (Director of Safety sign-off)
                </Button>
              ) : (
                <SignaturePad onConfirm={handleClosureSign} onCancel={() => setShowCloseSign(false)} />
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
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

export default SmsInvestigationsPage
