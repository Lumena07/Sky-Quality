'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  canSeeExternalServiceProviders,
  isQualityManager,
} from '@/lib/permissions'
import { getSlaExpiryStatus } from '@/lib/sla-status'
import { formatDate } from '@/lib/utils'
import { Pencil, Plus, Trash2, Upload } from 'lucide-react'

type SlaRow = {
  id: string
  companyName: string
  slaType: string
  location: string | null
  contractDate: string
  isEvergreen?: boolean
  expiryDate: string | null
  pdfFileUrl: string | null
}

const badgeClass = (s: ReturnType<typeof getSlaExpiryStatus>) => {
  if (s === 'Evergreen') return 'bg-slate-600 text-white'
  if (s === 'Expired') return 'bg-red-600 text-white'
  if (s === 'Expiring Soon') return 'bg-amber-500 text-black'
  return 'bg-green-600 text-white'
}

type MeApiResponse = {
  roles?: unknown
  departmentId?: string | null
}

const ExternalServiceProvidersPage = () => {
  const router = useRouter()
  const [roles, setRoles] = useState<string[]>([])
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [rows, setRows] = useState<SlaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SlaRow | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [slaType, setSlaType] = useState('')
  const [location, setLocation] = useState('')
  const [contractDate, setContractDate] = useState('')
  const [isEvergreen, setIsEvergreen] = useState(false)
  const [expiryDate, setExpiryDate] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const isQm = isQualityManager(roles)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((res): Promise<MeApiResponse> =>
        res.ok ? res.json() : Promise.resolve({})
      )
      .then((d) => {
        const nextRoles = Array.isArray(d.roles) ? (d.roles as string[]) : []
        const dept = typeof d.departmentId === 'string' ? d.departmentId : null
        setRoles(nextRoles)
        setDepartmentId(dept)
        if (!canSeeExternalServiceProviders(nextRoles, dept)) {
          router.replace('/dashboard')
          return
        }
        setChecked(true)
      })
      .catch(() => setChecked(true))
  }, [router])

  const fetchRows = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/service-level-agreements', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setRows(Array.isArray(data) ? data : [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!checked) return
    fetchRows()
  }, [checked])

  const openNew = () => {
    setEditing(null)
    setCompanyName('')
    setSlaType('')
    setLocation('')
    setContractDate('')
    setIsEvergreen(false)
    setExpiryDate('')
    setPdfFile(null)
    setDialogOpen(true)
  }

  const openEdit = (r: SlaRow) => {
    setEditing(r)
    setCompanyName(r.companyName)
    setSlaType(r.slaType)
    setLocation(r.location ?? '')
    setContractDate(String(r.contractDate).slice(0, 10))
    const eg = r.isEvergreen === true || r.expiryDate == null
    setIsEvergreen(eg)
    setExpiryDate(eg ? '' : String(r.expiryDate).slice(0, 10))
    setPdfFile(null)
    setDialogOpen(true)
  }

  const handleEvergreenChange = (checked: boolean) => {
    setIsEvergreen(checked)
    if (checked) setExpiryDate('')
  }

  const handleSave = async () => {
    if (!companyName.trim() || !slaType.trim() || !contractDate) {
      alert('Fill required fields')
      return
    }
    if (!isEvergreen && !expiryDate) {
      alert('Set an expiry date or mark the agreement as evergreen')
      return
    }
    if (!editing && !pdfFile) {
      alert('SLA PDF is required — attach a PDF before saving')
      return
    }
    setSaving(true)
    try {
      let pdfFileUrl: string | null = editing?.pdfFileUrl ?? null
      if (pdfFile) {
        const fd = new FormData()
        fd.append('file', pdfFile)
        fd.append('entityType', 'sla')
        fd.append('entityId', editing?.id ?? 'new')
        const up = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' })
        if (!up.ok) {
          alert((await up.json().catch(() => ({}))).error ?? 'Upload failed')
          return
        }
        const u = await up.json()
        pdfFileUrl = u.fileUrl ?? null
      }
      if (!pdfFileUrl?.trim()) {
        alert('SLA PDF is required — attach a PDF before saving')
        return
      }
      const payload = {
        companyName: companyName.trim(),
        slaType: slaType.trim(),
        location: location.trim() || null,
        contractDate,
        pdfFileUrl,
        ...(isEvergreen ? { isEvergreen: true } : { isEvergreen: false, expiryDate }),
      }
      const res = editing
        ? await fetch(`/api/service-level-agreements/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          })
        : await fetch('/api/service-level-agreements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          })
      if (!res.ok) {
        alert((await res.json().catch(() => ({}))).error ?? 'Save failed')
        return
      }
      setDialogOpen(false)
      fetchRows()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this SLA?')) return
    const res = await fetch(`/api/service-level-agreements/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) fetchRows()
  }

  if (!checked) {
    return (
      <MainLayout>
        <div className="p-8 text-muted-foreground">Loading…</div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">External Service Providers</h1>
            <p className="text-muted-foreground mt-2">Service level agreements (SLAs) register.</p>
          </div>
          {isQm && (
            <Button type="button" onClick={openNew} aria-label="Add SLA">
              <Plus className="mr-2 h-4 w-4" />
              Add SLA
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Service Level Agreements</CardTitle>
            <p className="text-sm text-muted-foreground">
              Status: slate Evergreen (no expiry), green Active, amber Expiring Soon (60 days or less), red Expired.
              Evergreen SLAs are not included in expiry reminders. For dated SLAs, QM receives reminders at 60 and 30 days
              before expiry (in-app; email if configured).
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No SLAs yet.</p>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 font-medium">Company</th>
                      <th className="text-left p-2 font-medium">Type</th>
                      <th className="text-left p-2 font-medium">Location</th>
                      <th className="text-left p-2 font-medium">Contract</th>
                      <th className="text-left p-2 font-medium">Expiry</th>
                      <th className="text-left p-2 font-medium">Status</th>
                      <th className="text-right p-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const eg = r.isEvergreen === true || r.expiryDate == null
                      const st = getSlaExpiryStatus({
                        isEvergreen: eg,
                        expiryDate: r.expiryDate ? String(r.expiryDate).slice(0, 10) : null,
                      })
                      return (
                        <tr key={r.id} className="border-t">
                          <td className="p-2 font-medium">{r.companyName}</td>
                          <td className="p-2">{r.slaType}</td>
                          <td className="p-2 text-muted-foreground">{r.location ?? '—'}</td>
                          <td className="p-2">{formatDate(r.contractDate)}</td>
                          <td className="p-2">
                            {eg
                              ? 'Evergreen'
                              : r.expiryDate != null
                                ? formatDate(r.expiryDate)
                                : '—'}
                          </td>
                          <td className="p-2">
                            <Badge className={badgeClass(st)}>{st}</Badge>
                          </td>
                          <td className="p-2 text-right space-x-1">
                            {r.pdfFileUrl && (
                              <a
                                href={
                                  r.pdfFileUrl.startsWith('http')
                                    ? r.pdfFileUrl
                                    : `${typeof window !== 'undefined' ? window.location.origin : ''}${r.pdfFileUrl}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline text-sm"
                              >
                                PDF
                              </a>
                            )}
                            {isQm && (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEdit(r)}
                                  aria-label="Edit SLA"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(r.id)}
                                  aria-label="Delete SLA"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit SLA' : 'New SLA'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1">
                <Label>Company name</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>SLA type</Label>
                <Input
                  value={slaType}
                  onChange={(e) => setSlaType(e.target.value)}
                  placeholder="Ground handling, Maintenance…"
                />
              </div>
              <div className="space-y-1">
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Contract date</Label>
                  <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sla-expiry-date">Expiry date</Label>
                  <Input
                    id="sla-expiry-date"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    disabled={isEvergreen}
                    aria-disabled={isEvergreen}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="sla-evergreen"
                  checked={isEvergreen}
                  onChange={(e) => handleEvergreenChange(e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border border-input bg-background accent-primary"
                  aria-checked={isEvergreen}
                  aria-label="Evergreen agreement with no expiry date"
                />
                <Label htmlFor="sla-evergreen" className="cursor-pointer font-normal leading-none">
                  Evergreen (no expiry)
                </Label>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sla-pdf-file">
                  SLA PDF <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sla-pdf-file"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  aria-required="true"
                  aria-describedby="sla-pdf-hint"
                />
                <p id="sla-pdf-hint" className="text-xs text-muted-foreground">
                  {editing?.pdfFileUrl
                    ? 'A PDF must remain on file. Upload a new file to replace it, or save without choosing a file to keep the current PDF.'
                    : 'Upload the signed SLA as a PDF — required for every agreement.'}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                <Upload className="mr-2 h-4 w-4" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

export default ExternalServiceProvidersPage
