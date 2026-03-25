'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { SmsTiptapEditor } from '@/components/sms/sms-tiptap-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { canManageSmsPolicy } from '@/lib/sms-permissions'
import { formatDate } from '@/lib/utils'

type ErpRow = {
  id: string
  version_number: string
  erp_text: string | null
  file_url: string | null
  review_cycle_months: number
  next_review_date: string | null
  is_active: boolean
  status: string
  sections_json: Record<string, string> | null
}

type DrillRow = {
  id: string
  planned_date: string | null
  drill_type: string | null
  participants: string | null
  actual_date: string | null
  outcome: string | null
  deficiencies: string | null
  corrective_actions: string | null
}

type ContactRow = {
  id: string
  name: string
  role: string | null
  primary_phone: string | null
  secondary_phone: string | null
  available_24_7: boolean
}

const SECTION_KEYS = [
  { key: 'activation', label: 'Activation criteria' },
  { key: 'notification_tree', label: 'Notification tree' },
  { key: 'roles', label: 'Roles & responsibilities during emergency' },
  { key: 'comms', label: 'Communication procedures' },
  { key: 'recovery', label: 'Recovery procedures' },
  { key: 'external_interfaces', label: 'Interfaces with external agencies' },
] as const

const defaultSections = (): Record<string, string> =>
  Object.fromEntries(SECTION_KEYS.map(({ key }) => [key, ''])) as Record<string, string>

const SmsErpPageInner = () => {
  const searchParams = useSearchParams()
  const fromMySafety = searchParams.get('from') === 'my-safety'

  const [roles, setRoles] = useState<string[] | null>(null)
  const [list, setList] = useState<ErpRow[]>([])
  const [selected, setSelected] = useState<ErpRow | null>(null)
  const [drills, setDrills] = useState<DrillRow[]>([])
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)

  const [formVersion, setFormVersion] = useState('')
  const [formHtml, setFormHtml] = useState('<p></p>')
  const [sections, setSections] = useState<Record<string, string>>(defaultSections())
  const [cycle, setCycle] = useState('12')
  const [nextRev, setNextRev] = useState('')
  const [status, setStatus] = useState('DRAFT')
  const [erpFile, setErpFile] = useState<File | null>(null)
  const [savingManual, setSavingManual] = useState(false)
  const [savingActivation, setSavingActivation] = useState(false)
  /** When true, skip auto-selecting first version so user can POST a new manual without merging into v1. */
  const [preferNewManual, setPreferNewManual] = useState(false)

  const [dPlan, setDPlan] = useState('')
  const [dType, setDType] = useState('')
  const [dPart, setDPart] = useState('')

  const [cName, setCName] = useState('')
  const [cRole, setCRole] = useState('')
  const [cP1, setCP1] = useState('')
  const [cP2, setCP2] = useState('')
  const [c247, setC247] = useState(false)

  const manage = roles ? canManageSmsPolicy(roles) : false

  const loadDetail = useCallback(async (row: ErpRow) => {
    setSelected(row)
    const res = await fetch(`/api/sms/erp/${row.id}`, { credentials: 'same-origin' })
    if (!res.ok) {
      setDrills([])
      setContacts([])
      return
    }
    const j = await res.json()
    setSelected(j)
    setDrills(j.drills ?? [])
    setContacts(j.contacts ?? [])
    setFormVersion(j.version_number)
    setFormHtml(j.erp_text || '<p></p>')
    setSections({ ...defaultSections(), ...(j.sections_json ?? {}) })
    setCycle(String(j.review_cycle_months ?? 12))
    setNextRev(j.next_review_date?.slice(0, 10) ?? '')
    setStatus(j.status ?? 'DRAFT')
  }, [])

  const loadList = useCallback(async () => {
    const url = fromMySafety ? '/api/sms/erp?portal=my-safety' : '/api/sms/erp'
    const res = await fetch(url, { credentials: 'same-origin' })
    if (!res.ok) return
    const data = await res.json()
    const arr = Array.isArray(data) ? data : []
    setList(arr)
    if (arr.length > 0 && fromMySafety) {
      await loadDetail(arr[0])
    }
  }, [fromMySafety, loadDetail])

  useEffect(() => {
    const run = async () => {
      const me = await fetch('/api/me', { credentials: 'same-origin' })
      const meJson = me.ok ? await me.json() : {}
      setRoles(Array.isArray(meJson.roles) ? meJson.roles : [])
      setLoading(false)
    }
    run()
  }, [])

  useEffect(() => {
    if (roles === null) return
    loadList()
  }, [roles, loadList])

  useEffect(() => {
    if (roles === null) return
    if (fromMySafety) return
    if (list.length === 0) return
    if (manage) return
    void loadDetail(list[0])
  }, [roles, manage, fromMySafety, list, loadDetail])

  /** Policy managers only see drills/contacts when a version is selected; auto-pick the first row like read-only users. */
  useEffect(() => {
    if (roles === null) return
    if (!manage || fromMySafety) return
    if (list.length === 0) return
    if (selected !== null) return
    if (preferNewManual) return
    void loadDetail(list[0])
  }, [roles, manage, fromMySafety, list, selected, loadDetail, preferNewManual])

  const uploadErpPdf = async (entityId: string): Promise<string | null> => {
    if (!erpFile) return null
    const fd = new FormData()
    fd.append('file', erpFile)
    fd.append('entityType', 'sms-erp')
    fd.append('entityId', entityId)
    const up = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' })
    if (!up.ok) return null
    const uj = await up.json()
    return uj.fileUrl ?? null
  }

  /** Section 1 only: POST new row (defaults for activation) or PATCH manual fields for selected version. */
  const handleSaveManual = async () => {
    if (!formVersion.trim()) {
      alert('Version number is required')
      return
    }
    setSavingManual(true)
    try {
      const isNew = preferNewManual || !selected
      let fileUrl: string | null | undefined
      if (erpFile) {
        fileUrl = await uploadErpPdf(isNew ? 'new' : selected!.id)
      }

      if (selected && !preferNewManual) {
        const body: Record<string, unknown> = {
          versionNumber: formVersion.trim(),
          reviewCycleMonths: Number(cycle) || 12,
          nextReviewDate: nextRev || null,
          status,
        }
        if (fileUrl !== null && fileUrl !== undefined) body.fileUrl = fileUrl
        const res = await fetch(`/api/sms/erp/${selected.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          alert('Failed to save ERP manual')
          return
        }
        setErpFile(null)
        await loadList()
        await loadDetail(selected)
        return
      }

      const res = await fetch('/api/sms/erp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          versionNumber: formVersion.trim(),
          erpText: '<p></p>',
          fileUrl: fileUrl ?? null,
          reviewCycleMonths: Number(cycle) || 12,
          nextReviewDate: nextRev || null,
          status,
          sectionsJson: {},
        }),
      })
      if (!res.ok) {
        alert('Failed to save ERP manual')
        return
      }
      const created = (await res.json()) as ErpRow
      setPreferNewManual(false)
      setErpFile(null)
      await loadList()
      await loadDetail(created)
    } finally {
      setSavingManual(false)
    }
  }

  /** Section 2 only: PATCH narrative + sections_json. */
  const handleSaveActivation = async () => {
    if (!selected) {
      alert('Select a version or save the ERP manual first')
      return
    }
    setSavingActivation(true)
    try {
      const res = await fetch(`/api/sms/erp/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          erpText: formHtml,
          sectionsJson: sections,
        }),
      })
      if (!res.ok) {
        alert('Failed to save ERP activation')
        return
      }
      await loadList()
      await loadDetail(selected)
    } finally {
      setSavingActivation(false)
    }
  }

  const handleStartNewManualVersion = () => {
    setPreferNewManual(true)
    setSelected(null)
    setDrills([])
    setContacts([])
    setFormVersion('')
    setFormHtml('<p></p>')
    setSections(defaultSections())
    setCycle('12')
    setNextRev('')
    setStatus('DRAFT')
    setErpFile(null)
  }

  const handleSelectVersion = (r: ErpRow) => {
    setPreferNewManual(false)
    void loadDetail(r)
  }

  if (roles === null || loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (fromMySafety) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Emergency Response Plan</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/sms/my-safety">Back to My Safety</Link>
        </Button>
        {!selected ? (
          <p className="text-sm text-muted-foreground">No published ERP available.</p>
        ) : (
          <ErpReadOnlyView erp={selected} drills={drills} contacts={contacts} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Emergency Response Plan</h1>
        <p className="text-sm text-muted-foreground mt-1">1.4 — ERP body, sections, drills, contacts, review cycle.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Versions</CardTitle>
            {manage && list.length > 0 && (
              <Button type="button" variant="secondary" size="sm" onClick={handleStartNewManualVersion}>
                New ERP manual version
              </Button>
            )}
          </div>
          <CardDescription>Select a version to edit, or add a new manual version.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.map((r) => (
            <Button
              key={r.id}
              type="button"
              variant={selected?.id === r.id && !preferNewManual ? 'default' : 'outline'}
              className="mr-2 mb-2"
              onClick={() => handleSelectVersion(r)}
            >
              v{r.version_number} · {r.status}
            </Button>
          ))}
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No ERP versions yet. Use Section 1 below to save the manual PDF and metadata first. Drills and contacts
              (Sections 3–4) are available after a version exists.
            </p>
          )}
        </CardContent>
      </Card>

      {manage && (list.length === 0 || preferNewManual) && (
        <Card id="erp-section-1-new">
          <CardHeader>
            <CardTitle>1 — ERP manual (PDF)</CardTitle>
            <CardDescription>
              Controlled manual: version, review cycle, PDF upload. This section saves on its own.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="e-ver-new">Version *</Label>
                <Input id="e-ver-new" value={formVersion} onChange={(e) => setFormVersion(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-cycle-new">Review cycle (months)</Label>
                <Input id="e-cycle-new" value={cycle} onChange={(e) => setCycle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-next-new">Next review date</Label>
                <Input id="e-next-new" type="date" value={nextRev} onChange={(e) => setNextRev(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-st-new">Status</Label>
                <select
                  id="e-st-new"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  aria-label="ERP status"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-pdf-new">ERP manual PDF</Label>
              <Input id="e-pdf-new" type="file" accept="application/pdf" onChange={(e) => setErpFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button type="button" onClick={handleSaveManual} disabled={savingManual}>
              {savingManual ? 'Saving…' : 'Save ERP manual'}
            </Button>
          </CardContent>
        </Card>
      )}

      {manage && selected && !preferNewManual && (
        <Card>
          <CardHeader>
            <CardTitle>1 — ERP manual (PDF)</CardTitle>
            <CardDescription>Version {selected.version_number} — save only manual fields and PDF.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="e-ver-edit">Version *</Label>
                <Input id="e-ver-edit" value={formVersion} onChange={(e) => setFormVersion(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-cycle-edit">Review cycle (months)</Label>
                <Input id="e-cycle-edit" value={cycle} onChange={(e) => setCycle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-next-edit">Next review date</Label>
                <Input id="e-next-edit" type="date" value={nextRev} onChange={(e) => setNextRev(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-st-edit">Status</Label>
                <select
                  id="e-st-edit"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  aria-label="ERP status"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-pdf-edit">Replace ERP manual PDF</Label>
              <Input id="e-pdf-edit" type="file" accept="application/pdf" onChange={(e) => setErpFile(e.target.files?.[0] ?? null)} />
              {selected.file_url && !erpFile && (
                <a
                  href={selected.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline text-sm"
                >
                  Current PDF
                </a>
              )}
            </div>
            <Button type="button" onClick={handleSaveManual} disabled={savingManual}>
              {savingManual ? 'Saving…' : 'Save ERP manual'}
            </Button>
          </CardContent>
        </Card>
      )}

      {manage && selected && !preferNewManual && (
        <Card>
          <CardHeader>
            <CardTitle>2 — ERP activation</CardTitle>
            <CardDescription>
              ERP narrative and activation criteria. Saves separately from the manual PDF (Section 1).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ERP narrative</Label>
              <SmsTiptapEditor content={formHtml} onChange={setFormHtml} editable />
            </div>
            {SECTION_KEYS.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`esec-${key}`}>{label}</Label>
                <Textarea
                  id={`esec-${key}`}
                  rows={4}
                  value={sections[key] ?? ''}
                  onChange={(e) => setSections((s) => ({ ...s, [key]: e.target.value }))}
                />
              </div>
            ))}
            <Button type="button" onClick={handleSaveActivation} disabled={savingActivation}>
              {savingActivation ? 'Saving…' : 'Save ERP activation'}
            </Button>
          </CardContent>
        </Card>
      )}

      {manage && (list.length === 0 || preferNewManual) && (
        <Card>
          <CardHeader>
            <CardTitle>2 — ERP activation</CardTitle>
            <CardDescription>Available after Section 1 is saved.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Save the ERP manual (Section 1) first. You can then edit the narrative and activation criteria for that
              version.
            </p>
          </CardContent>
        </Card>
      )}

      {manage && selected && !preferNewManual && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>3 — Drills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-3">
                <Input type="date" value={dPlan} onChange={(e) => setDPlan(e.target.value)} aria-label="Planned date" />
                <Input placeholder="Type" value={dType} onChange={(e) => setDType(e.target.value)} />
                <Input placeholder="Participants" value={dPart} onChange={(e) => setDPart(e.target.value)} />
              </div>
              <Button
                type="button"
                onClick={async () => {
                  await fetch(`/api/sms/erp/${selected.id}/drills`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                      plannedDate: dPlan || null,
                      drillType: dType,
                      participants: dPart,
                    }),
                  })
                  setDPlan('')
                  setDType('')
                  setDPart('')
                  await loadDetail(selected)
                }}
              >
                Add drill
              </Button>
              <ul className="space-y-2 text-sm">
                {drills.map((d) => (
                  <li key={d.id} className="border rounded p-2 space-y-1">
                    <div>
                      Planned {d.planned_date ?? '—'} · {d.drill_type ?? '—'}
                    </div>
                    <Input
                      type="date"
                      className="max-w-xs"
                      defaultValue={d.actual_date?.slice(0, 10) ?? ''}
                      aria-label="Actual date"
                      onBlur={async (e) => {
                        await fetch(`/api/sms/erp/${selected.id}/drills/${d.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'same-origin',
                          body: JSON.stringify({ actualDate: e.target.value || null }),
                        })
                        await loadDetail(selected)
                      }}
                    />
                    <Textarea
                      placeholder="Outcome"
                      defaultValue={d.outcome ?? ''}
                      onBlur={async (e) => {
                        await fetch(`/api/sms/erp/${selected.id}/drills/${d.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'same-origin',
                          body: JSON.stringify({ outcome: e.target.value }),
                        })
                        await loadDetail(selected)
                      }}
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4 — Emergency contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-2">
                <Input placeholder="Name *" value={cName} onChange={(e) => setCName(e.target.value)} />
                <Input placeholder="Role" value={cRole} onChange={(e) => setCRole(e.target.value)} />
                <Input placeholder="Primary phone" value={cP1} onChange={(e) => setCP1(e.target.value)} />
                <Input placeholder="Secondary phone" value={cP2} onChange={(e) => setCP2(e.target.value)} />
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input type="checkbox" checked={c247} onChange={(e) => setC247(e.target.checked)} />
                  Available 24/7
                </label>
              </div>
              <Button
                type="button"
                onClick={async () => {
                  if (!cName.trim()) return
                  await fetch(`/api/sms/erp/${selected.id}/contacts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                      name: cName.trim(),
                      role: cRole,
                      primaryPhone: cP1,
                      secondaryPhone: cP2,
                      available247: c247,
                    }),
                  })
                  setCName('')
                  setCRole('')
                  setCP1('')
                  setCP2('')
                  setC247(false)
                  await loadDetail(selected)
                }}
              >
                Add contact
              </Button>
              <ul className="text-sm space-y-2">
                {contacts.map((c) => (
                  <li key={c.id} className="border rounded p-2 flex flex-wrap justify-between gap-2">
                    <span>
                      {c.name} · {c.role ?? '—'} · {c.primary_phone ?? '—'}
                      {c.available_24_7 && (
                        <Badge className="ml-2" variant="secondary">
                          24/7
                        </Badge>
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await fetch(`/api/sms/erp/${selected.id}/contacts/${c.id}`, {
                          method: 'DELETE',
                          credentials: 'same-origin',
                        })
                        await loadDetail(selected)
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      {!manage && !fromMySafety && selected && (
        <ErpReadOnlyView erp={selected} drills={drills} contacts={contacts} />
      )}
    </div>
  )
}

const SmsErpPage = () => (
  <Suspense
    fallback={
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    }
  >
    <SmsErpPageInner />
  </Suspense>
)

const ErpReadOnlyView = ({
  erp,
  drills,
  contacts,
}: {
  erp: ErpRow
  drills: DrillRow[]
  contacts: ContactRow[]
}) => {
  const sj = { ...defaultSections(), ...(erp.sections_json ?? {}) }
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1 — ERP manual (PDF)</CardTitle>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline">v{erp.version_number}</Badge>
            <Badge>{erp.status}</Badge>
          </div>
          <CardDescription>
            Review every {erp.review_cycle_months} month(s)
            {erp.next_review_date ? ` · Next review: ${formatDate(erp.next_review_date)}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {erp.file_url ? (
            <a href={erp.file_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
              Download ERP manual (PDF)
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">No PDF uploaded.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2 — ERP activation</CardTitle>
          <CardDescription>ERP narrative and activation criteria</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className="text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_p]:my-2"
            dangerouslySetInnerHTML={{ __html: erp.erp_text || '<p>—</p>' }}
          />
          <div className="space-y-4 border-t pt-4">
            {SECTION_KEYS.map(({ key, label }) => (
              <div key={key}>
                <h3 className="text-sm font-medium">{label}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{sj[key] || '—'}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3 — Drills</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2">
            {drills.map((d) => (
              <li key={d.id} className="border rounded p-2">
                <div className="font-medium">{d.drill_type ?? 'Drill'}</div>
                <div className="text-muted-foreground text-xs mt-1">
                  Planned {d.planned_date ?? '—'} · Actual {d.actual_date ?? '—'}
                </div>
                {d.outcome && <p className="mt-2">{d.outcome}</p>}
              </li>
            ))}
          </ul>
          {drills.length === 0 && <p className="text-sm text-muted-foreground">No drills recorded.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">4 — Emergency contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2">
            {contacts.map((c) => (
              <li key={c.id} className="border rounded p-2">
                <div className="font-medium">{c.name}</div>
                <div className="text-muted-foreground">{c.role}</div>
                <div>{c.primary_phone}</div>
                {c.secondary_phone && <div>{c.secondary_phone}</div>}
                {c.available_24_7 && <Badge className="mt-1">24/7</Badge>}
              </li>
            ))}
          </ul>
          {contacts.length === 0 && <p className="text-sm text-muted-foreground">No emergency contacts recorded.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

export default SmsErpPage
