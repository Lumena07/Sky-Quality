'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { isAccountableManager, isDirectorOfSafety, isSafetyOfficer } from '@/lib/permissions'
import { REGULATORY_REPORT_TYPES } from '@/lib/sms-workflow-constants'

type Me = { id: string; roles: string[] }

type AuthRow = { id: string; name: string; code: string }

type RegRow = {
  id: string
  report_number: string
  regulatory_authority: string
  regulatory_authority_id: string | null
  report_type: string
  status: string
  initial_deadline_at: string | null
  submission_date: string | null
  sms_report_id: string | null
}

const countdownLabel = (deadlineIso: string | null): string => {
  if (!deadlineIso) return '—'
  const end = new Date(deadlineIso).getTime()
  const now = Date.now()
  const ms = end - now
  if (ms <= 0) return 'Past deadline'
  const h = Math.floor(ms / (1000 * 60 * 60))
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  return `${h}h ${m}m remaining`
}

const SmsRegulatoryPage = () => {
  const [me, setMe] = useState<Me | null>(null)
  const [list, setList] = useState<RegRow[]>([])
  const [authorities, setAuthorities] = useState<AuthRow[]>([])
  const [reports, setReports] = useState<{ id: string; report_number: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [authId, setAuthId] = useState('')
  const [reportType, setReportType] = useState('INITIAL')
  const [smsReportId, setSmsReportId] = useState('')
  const [submissionMethod, setSubmissionMethod] = useState('')
  const [authorityRef, setAuthorityRef] = useState('')

  const canManage = useMemo(
    () => me && (isDirectorOfSafety(me.roles) || isSafetyOfficer(me.roles)),
    [me]
  )
  const isAmView = useMemo(() => me && isAccountableManager(me.roles), [me])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sms/regulatory', { credentials: 'same-origin' })
      if (res.ok) setList(await res.json())
      else setList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    fetch('/api/me', { credentials: 'same-origin' }).then((r) => r.json()).then(setMe)
    fetch('/api/sms/regulatory-authorities', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => setAuthorities(Array.isArray(d) ? d : []))
    fetch('/api/sms/reports', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => setReports(Array.isArray(d) ? d : []))
  }, [load])

  const handleCreate = async () => {
    if (!authId) {
      alert('Select regulatory authority')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/sms/regulatory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          regulatoryAuthorityId: authId,
          reportType,
          smsReportId: smsReportId || null,
          submissionMethod: submissionMethod || null,
          authorityReferenceNumber: authorityRef || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed')
        return
      }
      setDialogOpen(false)
      setAuthId('')
      setSmsReportId('')
      setSubmissionMethod('')
      setAuthorityRef('')
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Regulatory reporting</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Mandatory occurrence reports to authorities. Initial notification often due within 72 hours of the event.
          </p>
        </div>
        {canManage && (
          <Button type="button" onClick={() => setDialogOpen(true)}>
            New regulatory report
          </Button>
        )}
      </div>

      {isAmView && !canManage && (
        <p className="text-sm text-muted-foreground">You have view-only access to regulatory records.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
          <CardDescription>{loading ? 'Loading…' : `${list.length} record(s)`}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2 font-medium">Number</th>
                <th className="p-2 font-medium">Authority</th>
                <th className="p-2 font-medium">Type</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">72h countdown</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="p-2 font-mono text-xs">{r.report_number}</td>
                  <td className="p-2">{r.regulatory_authority}</td>
                  <td className="p-2">{r.report_type}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">
                    <span
                      className={
                        r.initial_deadline_at &&
                        new Date(r.initial_deadline_at) < new Date() &&
                        r.status === 'SUBMITTED'
                          ? 'font-medium text-destructive'
                          : ''
                      }
                    >
                      {countdownLabel(r.initial_deadline_at)}
                    </span>
                    {r.initial_deadline_at && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (due {formatDateTime(r.initial_deadline_at)})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby="reg-desc">
          <DialogHeader>
            <DialogTitle>New regulatory report</DialogTitle>
            <DialogDescription id="reg-desc">
              Link an internal occurrence report to pre-fill the 72-hour initial notification deadline when possible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Regulatory authority</Label>
              <Select value={authId} onValueChange={setAuthId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {authorities.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Report type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGULATORY_REPORT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Linked internal occurrence (optional)</Label>
              <Select value={smsReportId || 'none'} onValueChange={(v) => setSmsReportId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {reports.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.report_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Submission method</Label>
              <Input value={submissionMethod} onChange={(e) => setSubmissionMethod(e.target.value)} />
            </div>
            <div>
              <Label>Authority reference number</Label>
              <Input value={authorityRef} onChange={(e) => setAuthorityRef(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SmsRegulatoryPage
