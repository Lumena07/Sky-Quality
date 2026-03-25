'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { SmsTiptapEditor } from '@/components/sms/sms-tiptap-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { canApproveSmsPolicy, canManageSmsPolicy } from '@/lib/sms-permissions'
import { formatDate } from '@/lib/utils'

type PolicyRow = {
  id: string
  version_number: string
  policy_text: string | null
  effective_date: string
  review_due_date: string | null
  status: string
  am_signed_name: string | null
  am_signed_at: string | null
  submitted_for_signature_at: string | null
}

type ObjectiveRow = {
  id: string
  title: string
  description: string | null
  owner_id: string | null
  target_date: string | null
  status: string
  linked_spi_id: string | null
  policy_version_id: string | null
}

type SpiOpt = { id: string; spi_code: string; name: string }

const statusBadgeVariant = (s: string) => {
  if (s === 'ACTIVE') return 'default' as const
  if (s === 'PENDING_AM_SIGNATURE') return 'secondary' as const
  if (s === 'SUPERSEDED') return 'outline' as const
  return 'secondary' as const
}

const SafetyPolicyStatementInner = () => {
  const searchParams = useSearchParams()
  const fromPortal = searchParams.get('from') === 'my-safety'
  const signParam = searchParams.get('sign')

  const [roles, setRoles] = useState<string[] | null>(null)
  const [policies, setPolicies] = useState<PolicyRow[]>([])
  const [objectives, setObjectives] = useState<ObjectiveRow[]>([])
  const [spis, setSpis] = useState<SpiOpt[]>([])
  const [portalData, setPortalData] = useState<{ policy: PolicyRow | null; objectives: ObjectiveRow[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formVersion, setFormVersion] = useState('')
  const [formEffective, setFormEffective] = useState('')
  const [formReview, setFormReview] = useState('')
  const [formStatus, setFormStatus] = useState('DRAFT')
  const [formHtml, setFormHtml] = useState('<p></p>')

  const [objTitle, setObjTitle] = useState('')
  const [objOwner, setObjOwner] = useState('')
  const [objTarget, setObjTarget] = useState('')
  const [objStatus, setObjStatus] = useState('ON_TRACK')
  const [objSpi, setObjSpi] = useState<string>('')

  const [signOpen, setSignOpen] = useState(false)
  const [signName, setSignName] = useState('')

  const manage = roles ? canManageSmsPolicy(roles) : false
  const approve = roles ? canApproveSmsPolicy(roles) : false
  const readOnlyStaff = Boolean(roles && !manage && !approve)
  const usePortalLayout = fromPortal || readOnlyStaff
  const showEditor = Boolean(manage && !fromPortal && !readOnlyStaff)

  const loadPolicies = useCallback(async () => {
    const res = await fetch('/api/sms/policy', { credentials: 'same-origin' })
    if (!res.ok) return
    const data = await res.json()
    setPolicies(Array.isArray(data) ? data : [])
  }, [])

  const loadObjectives = useCallback(async () => {
    const res = await fetch('/api/sms/policy/objectives', { credentials: 'same-origin' })
    if (!res.ok) return
    const data = await res.json()
    setObjectives(Array.isArray(data) ? data : [])
  }, [])

  const loadSpis = useCallback(async () => {
    const res = await fetch('/api/sms/spis', { credentials: 'same-origin' })
    if (!res.ok) return
    const data = await res.json()
    setSpis(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    const run = async () => {
      const me = await fetch('/api/me', { credentials: 'same-origin' })
      const meJson = me.ok ? await me.json() : {}
      setRoles(Array.isArray(meJson.roles) ? meJson.roles : [])

      const needPortal = fromPortal || (Array.isArray(meJson.roles) && !canManageSmsPolicy(meJson.roles) && !canApproveSmsPolicy(meJson.roles))
      if (needPortal) {
        const pr = await fetch('/api/sms/policy?mode=portal', { credentials: 'same-origin' })
        if (pr.ok) {
          const j = await pr.json()
          setPortalData({
            policy: j.policy ?? null,
            objectives: Array.isArray(j.objectives) ? j.objectives : [],
          })
        }
        setLoading(false)
        return
      }

      await Promise.all([loadPolicies(), loadObjectives(), loadSpis()])
      setLoading(false)
    }
    run()
  }, [fromPortal, loadPolicies, loadObjectives, loadSpis])

  useEffect(() => {
    if (!signParam || !approve || fromPortal) return
    const p = policies.find((x) => x.id === signParam)
    if (p?.status === 'PENDING_AM_SIGNATURE') setSignOpen(true)
  }, [signParam, approve, policies, fromPortal])

  const selectedPolicy = useMemo(
    () => policies.find((p) => p.id === selectedId) ?? null,
    [policies, selectedId]
  )

  const handleSelectPolicy = (p: PolicyRow) => {
    setSelectedId(p.id)
    setFormVersion(p.version_number)
    setFormEffective(p.effective_date?.slice(0, 10) ?? '')
    setFormReview(p.review_due_date?.slice(0, 10) ?? '')
    setFormStatus(p.status)
    setFormHtml(p.policy_text || '<p></p>')
  }

  const handleNewPolicy = () => {
    setSelectedId(null)
    setFormVersion('')
    setFormEffective('')
    setFormReview('')
    setFormStatus('DRAFT')
    setFormHtml('<p></p>')
  }

  const handleSavePolicy = async () => {
    if (!formVersion.trim() || !formEffective.trim()) {
      alert('Version number and effective date are required.')
      return
    }
    setSaving(true)
    try {
      if (selectedId) {
        const res = await fetch(`/api/sms/policy/${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            versionNumber: formVersion.trim(),
            effectiveDate: formEffective,
            reviewDueDate: formReview || null,
            policyText: formHtml,
            status: formStatus,
          }),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          alert((e as { error?: string }).error ?? 'Update failed')
          return
        }
      } else {
        const res = await fetch('/api/sms/policy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            versionNumber: formVersion.trim(),
            effectiveDate: formEffective,
            reviewDueDate: formReview || null,
            policyText: formHtml,
            status: formStatus,
          }),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          alert((e as { error?: string }).error ?? 'Create failed')
          return
        }
        const created = await res.json()
        setSelectedId(created.id)
      }
      await loadPolicies()
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitSignature = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sms/policy/${selectedId}/submit-for-signature`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? 'Submit failed')
        return
      }
      await loadPolicies()
      const updated = await res.json()
      handleSelectPolicy(updated)
    } finally {
      setSaving(false)
    }
  }

  const handleSignConfirm = async () => {
    const id = signParam || selectedId
    if (!id) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sms/policy/${id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ signedName: signName.trim() || 'Accountable Manager' }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? 'Sign failed')
        return
      }
      setSignOpen(false)
      await loadPolicies()
    } finally {
      setSaving(false)
    }
  }

  const handleAddObjective = async () => {
    if (!objTitle.trim()) {
      alert('Title is required')
      return
    }
    const activePolicy = policies.find((p) => p.status === 'ACTIVE')
    const policyVersionId = selectedId && ['DRAFT', 'UNDER_REVIEW'].includes(String(selectedPolicy?.status))
      ? selectedId
      : activePolicy?.id ?? null

    const res = await fetch('/api/sms/policy/objectives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        title: objTitle.trim(),
        ownerId: objOwner.trim() || null,
        targetDate: objTarget || null,
        status: objStatus,
        linkedSpiId: objSpi || null,
        policyVersionId,
      }),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      alert((e as { error?: string }).error ?? 'Failed to add objective')
      return
    }
    setObjTitle('')
    setObjOwner('')
    setObjTarget('')
    setObjSpi('')
    await loadObjectives()
  }

  const handleDeleteObjective = async (oid: string) => {
    if (!confirm('Delete this objective?')) return
    const res = await fetch(`/api/sms/policy/objectives/${oid}`, { method: 'DELETE', credentials: 'same-origin' })
    if (!res.ok) {
      alert('Delete failed')
      return
    }
    await loadObjectives()
  }

  if (roles === null || loading) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (usePortalLayout) {
    const pol = portalData?.policy
    const objs = portalData?.objectives ?? []
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Safety Policy</h1>
          <p className="text-sm text-muted-foreground mt-1">Current active policy (read only).</p>
        </div>
        {!pol ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">No active safety policy is published yet.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>Version {pol.version_number}</CardTitle>
                  <Badge>ACTIVE</Badge>
                </div>
                <CardDescription>
                  Effective {formatDate(pol.effective_date)}
                  {pol.review_due_date && ` · Review due ${formatDate(pol.review_due_date)}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="sms-policy-html text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2"
                  dangerouslySetInnerHTML={{ __html: pol.policy_text || '<p>—</p>' }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Safety objectives</CardTitle>
                <CardDescription>Measurable objectives linked to safety performance indicators.</CardDescription>
              </CardHeader>
              <CardContent>
                {objs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No objectives listed.</p>
                ) : (
                  <ul className="space-y-3" role="list">
                    {objs.map((o) => (
                      <li key={o.id} className="rounded-md border p-3 text-sm">
                        <div className="font-medium">{o.title}</div>
                        {o.description && <p className="text-muted-foreground mt-1">{o.description}</p>}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>Status: {o.status}</span>
                          {o.target_date && <span>Target: {o.target_date}</span>}
                          {o.linked_spi_id && <span>SPI: {o.linked_spi_id.slice(0, 8)}…</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
        {fromPortal ? (
          <Button asChild variant="outline">
            <Link href="/sms/my-safety">Back to My Safety</Link>
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Safety Policy &amp; Objectives</h1>
          <p className="text-sm text-muted-foreground mt-1">1.1 — Policy statement, versioning, and measurable objectives.</p>
        </div>
        {manage && (
          <Button type="button" variant="outline" onClick={handleNewPolicy}>
            New version
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Policy versions</CardTitle>
          <CardDescription>Select a row to edit when status is Draft or Under Review.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-2">Version</th>
                <th className="pb-2 pr-2">Status</th>
                <th className="pb-2 pr-2">Effective</th>
                <th className="pb-2 pr-2">Review due</th>
                <th className="pb-2">AM signed</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border/60 cursor-pointer hover:bg-muted/40"
                  onClick={() => handleSelectPolicy(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSelectPolicy(p)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Select policy version ${p.version_number}`}
                >
                  <td className="py-2 pr-2 font-medium">{p.version_number}</td>
                  <td className="py-2 pr-2">
                    <Badge variant={statusBadgeVariant(p.status)}>{p.status}</Badge>
                  </td>
                  <td className="py-2 pr-2">{formatDate(p.effective_date)}</td>
                  <td className="py-2 pr-2">{p.review_due_date ? formatDate(p.review_due_date) : '—'}</td>
                  <td className="py-2">
                    {p.am_signed_at ? `${p.am_signed_name ?? '—'} · ${formatDate(p.am_signed_at)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {policies.length === 0 && <p className="text-sm text-muted-foreground py-4">No policy versions yet.</p>}
        </CardContent>
      </Card>

      {approve && signParam && (
        <Dialog open={signOpen} onOpenChange={setSignOpen}>
          <DialogContent className="sm:max-w-md" aria-describedby="sign-policy-desc">
            <DialogHeader>
              <DialogTitle>Sign safety policy</DialogTitle>
              <DialogDescription id="sign-policy-desc">
                Your name and the current time will be recorded as the Accountable Manager approval. The policy becomes Active for all staff.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="sign-name">Displayed name</Label>
              <Input
                id="sign-name"
                value={signName}
                onChange={(e) => setSignName(e.target.value)}
                placeholder="Accountable Manager"
                aria-label="Signature display name"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setSignOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSignConfirm} disabled={saving}>
                {saving ? 'Signing…' : 'Sign and activate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showEditor && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedId ? 'Edit policy' : 'Create policy'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pol-version">Version number *</Label>
                <Input
                  id="pol-version"
                  value={formVersion}
                  onChange={(e) => setFormVersion(e.target.value)}
                  aria-required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pol-status">Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger id="pol-status" aria-label="Policy status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pol-effective">Effective date *</Label>
                <Input
                  id="pol-effective"
                  type="date"
                  value={formEffective}
                  onChange={(e) => setFormEffective(e.target.value)}
                  aria-required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pol-review">Review due date</Label>
                <Input
                  id="pol-review"
                  type="date"
                  value={formReview}
                  onChange={(e) => setFormReview(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Policy text</Label>
              <SmsTiptapEditor content={formHtml} onChange={setFormHtml} editable />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleSavePolicy} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {selectedId && ['DRAFT', 'UNDER_REVIEW'].includes(formStatus) && (
                <Button type="button" variant="secondary" onClick={handleSubmitSignature} disabled={saving}>
                  Submit for AM signature
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {manage && (
        <Card>
          <CardHeader>
            <CardTitle>Safety objectives</CardTitle>
            <CardDescription>Link objectives to SPIs (Pillar 3). New rows attach to the selected draft policy, or the active policy if none.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="obj-title">Title *</Label>
                <Input id="obj-title" value={objTitle} onChange={(e) => setObjTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obj-owner">Owner user ID</Label>
                <Input id="obj-owner" value={objOwner} onChange={(e) => setObjOwner(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obj-target">Target date</Label>
                <Input id="obj-target" type="date" value={objTarget} onChange={(e) => setObjTarget(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={objStatus} onValueChange={setObjStatus}>
                  <SelectTrigger aria-label="Objective status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ON_TRACK">On Track</SelectItem>
                    <SelectItem value="AT_RISK">At Risk</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                    <SelectItem value="ACHIEVED">Achieved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>SPI</Label>
                <Select value={objSpi || 'none'} onValueChange={(v) => setObjSpi(v === 'none' ? '' : v)}>
                  <SelectTrigger aria-label="Linked SPI">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {spis.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.spi_code} — {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="button" onClick={handleAddObjective}>
              Add objective
            </Button>
            <ul className="space-y-2 divide-y" role="list">
              {objectives.map((o) => {
                const spi = spis.find((s) => s.id === o.linked_spi_id)
                return (
                  <li key={o.id} className="flex flex-wrap items-start justify-between gap-2 pt-3 text-sm">
                    <div>
                      <div className="font-medium">{o.title}</div>
                      <div className="text-muted-foreground text-xs mt-1">
                        {o.status}
                        {o.target_date && ` · ${o.target_date}`}
                        {spi && ` · ${spi.spi_code}`}
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteObjective(o.id)}>
                      Delete
                    </Button>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {approve && !manage && (
        <p className="text-sm text-muted-foreground">
          Use the Accountable Manager dashboard or the link in your notification to sign pending policies.
        </p>
      )}
    </div>
  )
}

const loadingFallback = (
  <div className="space-y-4 p-6">
    <p className="text-sm text-muted-foreground">Loading…</p>
  </div>
)

const SafetyPolicyStatementPage = () => (
  <Suspense fallback={loadingFallback}>
    <SafetyPolicyStatementInner />
  </Suspense>
)

export default SafetyPolicyStatementPage
