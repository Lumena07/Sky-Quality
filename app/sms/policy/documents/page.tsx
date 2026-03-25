'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { canManageSmsPolicy } from '@/lib/sms-permissions'
import { formatDate } from '@/lib/utils'

type DocRow = {
  id: string
  document_number: string
  revision_number: string
  title: string
  document_type: string
  status: string
  effective_date: string | null
  review_date: string | null
  file_url: string | null
  visible_to_all_staff: boolean
  is_superseded: boolean
  published_at: string | null
}

const DOC_TYPES = ['SMS Manual', 'Safety Procedures', 'Safety Forms', 'Safety Instructions'] as const

const SmsDocumentsPageInner = () => {
  const searchParams = useSearchParams()
  const fromMySafety = searchParams.get('from') === 'my-safety'

  const [roles, setRoles] = useState<string[] | null>(null)
  const [rows, setRows] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [docNum, setDocNum] = useState('')
  const [rev, setRev] = useState('1')
  const [docType, setDocType] = useState<string>(DOC_TYPES[0])
  const [status, setStatus] = useState('DRAFT')
  const [effective, setEffective] = useState('')
  const [review, setReview] = useState('')
  const [allStaff, setAllStaff] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [reviseId, setReviseId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const manage = roles ? canManageSmsPolicy(roles) : false

  const load = useCallback(async () => {
    const url = fromMySafety ? '/api/sms/documents?portal=my-safety' : '/api/sms/documents'
    const res = await fetch(url, { credentials: 'same-origin' })
    if (!res.ok) {
      setRows([])
      return
    }
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
  }, [fromMySafety])

  useEffect(() => {
    const run = async () => {
      const me = await fetch('/api/me', { credentials: 'same-origin' })
      const meJson = me.ok ? await me.json() : {}
      const r = Array.isArray(meJson.roles) ? meJson.roles : []
      setRoles(r)
      setLoading(false)
    }
    run()
  }, [])

  useEffect(() => {
    if (roles === null) return
    load()
  }, [roles, load])

  const handleUpload = async (): Promise<string | null> => {
    if (!file) return null
    const fd = new FormData()
    fd.append('file', file)
    fd.append('entityType', 'sms-document')
    fd.append('entityId', 'new')
    const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      alert((e as { error?: string }).error ?? 'Upload failed')
      return null
    }
    const j = await res.json()
    return j.fileUrl as string
  }

  const handleCreate = async () => {
    if (!title.trim() || !docNum.trim()) {
      alert('Title and document number are required.')
      return
    }
    setSaving(true)
    try {
      let fileUrl: string | null = null
      if (file) {
        fileUrl = await handleUpload()
        if (!fileUrl) {
          setSaving(false)
          return
        }
      }
      const res = await fetch('/api/sms/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          documentNumber: docNum.trim(),
          revisionNumber: rev.trim() || '1',
          title: title.trim(),
          documentType: docType,
          status,
          effectiveDate: effective || null,
          reviewDate: review || null,
          fileUrl,
          visibleToAllStaff: allStaff,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? 'Save failed')
        return
      }
      setTitle('')
      setDocNum('')
      setRev('1')
      setFile(null)
      setEffective('')
      setReview('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const handleRevise = async () => {
    if (!reviseId) return
    setSaving(true)
    try {
      let fileUrl: string | null | undefined
      if (file) {
        fileUrl = await handleUpload()
        if (!fileUrl) {
          setSaving(false)
          return
        }
      }
      const res = await fetch(`/api/sms/documents/${reviseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'revise',
          revisionNumber: rev.trim() || undefined,
          title: title.trim() || undefined,
          documentType: docType,
          status: 'PUBLISHED',
          effectiveDate: effective || null,
          reviewDate: review || null,
          fileUrl,
          visibleToAllStaff: allStaff,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? 'Revision failed')
        return
      }
      setReviseId(null)
      setFile(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const startRevise = (d: DocRow) => {
    setReviseId(d.id)
    setTitle(d.title)
    setDocNum(d.document_number)
    setRev(String(parseInt(String(d.revision_number).replace(/\D/g, '') || '0', 10) + 1))
    setDocType(DOC_TYPES.includes(d.document_type as (typeof DOC_TYPES)[number]) ? d.document_type : DOC_TYPES[0])
    setEffective(d.effective_date?.slice(0, 10) ?? '')
    setReview(d.review_date?.slice(0, 10) ?? '')
    setAllStaff(d.visible_to_all_staff)
    setFile(null)
  }

  if (roles === null || loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SMS documentation</h1>
        <p className="text-sm text-muted-foreground mt-1">1.2 — Controlled document register (PDF).</p>
      </div>

      {fromMySafety && (
        <Button asChild variant="outline" size="sm">
          <Link href="/sms/my-safety">Back to My Safety</Link>
        </Button>
      )}

      {manage && !reviseId && (
        <Card>
          <CardHeader>
            <CardTitle>New document</CardTitle>
            <CardDescription>Director of Safety and Safety Officers only.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="d-title">Title *</Label>
              <Input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-num">Document number *</Label>
              <Input id="d-num" value={docNum} onChange={(e) => setDocNum(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-rev">Revision</Label>
              <Input id="d-rev" value={rev} onChange={(e) => setRev(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger aria-label="Document type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-eff">Effective date</Label>
              <Input id="d-eff" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-revdate">Review date</Label>
              <Input id="d-revdate" type="date" value={review} onChange={(e) => setReview(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <input
                id="d-allstaff"
                type="checkbox"
                checked={allStaff}
                onChange={(e) => setAllStaff(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="d-allstaff" className="font-normal cursor-pointer">
                Visible to all staff (My Safety portal)
              </Label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="d-file">PDF file</Label>
              <Input
                id="d-file"
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                aria-label="Upload PDF"
              />
            </div>
            <div className="md:col-span-2">
              <Button type="button" onClick={handleCreate} disabled={saving}>
                {saving ? 'Saving…' : 'Create document'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {manage && reviseId && (
        <Card>
          <CardHeader>
            <CardTitle>New revision</CardTitle>
            <CardDescription>Previous revision will be marked superseded.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="r-rev">Revision number</Label>
                <Input id="r-rev" value={rev} onChange={(e) => setRev(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="r-title">Title</Label>
                <Input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-file">New PDF (optional)</Label>
                <Input
                  id="r-file"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handleRevise} disabled={saving}>
                {saving ? 'Saving…' : 'Publish revision'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setReviseId(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Register</CardTitle>
          <CardDescription>
            {fromMySafety
              ? 'Published documents marked for all staff.'
              : 'Superseded rows remain in the database for history.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-2">Number / Rev</th>
                <th className="pb-2 pr-2">Title</th>
                <th className="pb-2 pr-2">Type</th>
                <th className="pb-2 pr-2">Status</th>
                <th className="pb-2 pr-2">Effective</th>
                <th className="pb-2">File</th>
                {manage && <th className="pb-2 pl-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-border/60">
                  <td className="py-2 pr-2 whitespace-nowrap">
                    {d.document_number} / {d.revision_number}
                    {d.is_superseded && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Superseded
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 pr-2">{d.title}</td>
                  <td className="py-2 pr-2">{d.document_type}</td>
                  <td className="py-2 pr-2">
                    <Badge variant={d.status === 'PUBLISHED' ? 'default' : 'secondary'}>{d.status}</Badge>
                  </td>
                  <td className="py-2 pr-2">{d.effective_date ? formatDate(d.effective_date) : '—'}</td>
                  <td className="py-2">
                    {d.file_url ? (
                      <a
                        href={d.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        PDF
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  {manage && (
                    <td className="py-2 pl-2">
                      {!d.is_superseded && d.status === 'PUBLISHED' && (
                        <Button type="button" size="sm" variant="outline" onClick={() => startRevise(d)}>
                          New revision
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="text-sm text-muted-foreground py-4">No documents.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

const SmsDocumentsPage = () => (
  <Suspense
    fallback={
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    }
  >
    <SmsDocumentsPageInner />
  </Suspense>
)

export default SmsDocumentsPage
