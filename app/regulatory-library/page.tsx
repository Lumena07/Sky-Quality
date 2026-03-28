'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { canSeeRegulatoryLibrary, isQualityManager } from '@/lib/permissions'
import { ExternalLink, Trash2, Upload } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type DocRow = {
  id: string
  kind: string
  title: string
  category: string | null
  version: string | null
  acNumber: string | null
  subject: string | null
  fileUrl: string
  uploadedAt: string
}

type MeApiResponse = {
  roles?: unknown
  departmentId?: string | null
}

const RegulatoryLibraryPage = () => {
  const router = useRouter()
  const [roles, setRoles] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const [kind, setKind] = useState<'TGM' | 'AC'>('TGM')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newVersion, setNewVersion] = useState('')
  const [newAc, setNewAc] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const isQm = isQualityManager(roles)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((res): Promise<MeApiResponse> =>
        res.ok ? res.json() : Promise.resolve({})
      )
      .then((d) => {
        const r = Array.isArray(d.roles) ? (d.roles as string[]) : []
        setRoles(r)
        const deptId = d.departmentId ?? null
        if (!canSeeRegulatoryLibrary(r)) {
          router.replace('/dashboard')
          return
        }
        void deptId
        setChecked(true)
      })
      .catch(() => setChecked(true))
  }, [router])

  const fetchRows = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/regulatory-library?kind=${kind}&q=${encodeURIComponent(q)}`, {
        credentials: 'include',
      })
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
  }, [checked, kind, q])

  const filtered = useMemo(() => rows, [rows])

  const handleUpload = async () => {
    if (!newTitle.trim() || !file) {
      alert('Title and PDF required')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('entityType', 'regulatory-library')
      fd.append('entityId', 'new')
      const up = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' })
      if (!up.ok) {
        alert((await up.json().catch(() => ({}))).error ?? 'Upload failed')
        return
      }
      const { fileUrl, fileType, fileSize } = await up.json()
      const res = await fetch('/api/regulatory-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind,
          title: newTitle.trim(),
          category: newCategory.trim() || null,
          version: newVersion.trim() || null,
          acNumber: kind === 'AC' ? newAc.trim() || null : null,
          subject: kind === 'AC' ? newSubject.trim() || null : null,
          fileUrl,
          fileType,
          fileSize,
        }),
      })
      if (!res.ok) {
        alert((await res.json().catch(() => ({}))).error ?? 'Save failed')
        return
      }
      setNewTitle('')
      setNewCategory('')
      setNewVersion('')
      setNewAc('')
      setNewSubject('')
      setFile(null)
      fetchRows()
    } finally {
      setUploading(false)
    }
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
        <div>
          <h1 className="text-3xl font-bold">Regulatory Library Integration</h1>
          <p className="text-muted-foreground mt-2">
            TCAA resources, technical guidance material, and advisory circulars.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">TCAA regulatory website</CardTitle>
            <CardDescription>
              Access the latest Tanzania Civil Aviation Authority regulations, standards and notices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="default" aria-label="Open TCAA website">
              <a href="https://www.tcaa.go.tz" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open www.tcaa.go.tz
              </a>
            </Button>
          </CardContent>
        </Card>

        <Tabs value={kind} onValueChange={(v) => setKind(v as 'TGM' | 'AC')}>
          <TabsList aria-label="Library sections">
            <TabsTrigger value="TGM">Technical guidance material</TabsTrigger>
            <TabsTrigger value="AC">Advisory circulars</TabsTrigger>
          </TabsList>
          <TabsContent value="TGM" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search title, category, version…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="max-w-sm"
                aria-label="Search"
              />
            </div>
            {isQm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Upload PDF (Quality Manager)</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Version</Label>
                    <Input value={newVersion} onChange={(e) => setNewVersion(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>PDF</Label>
                    <Input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      aria-label="PDF file"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="button" onClick={handleUpload} disabled={uploading}>
                      <Upload className="mr-2 h-4 w-4" />
                      {uploading ? 'Uploading…' : 'Upload'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <DocTable
              rows={filtered}
              loading={loading}
              isQm={isQm}
              onDelete={async (id) => {
                if (!confirm('Delete this document?')) return
                const res = await fetch(`/api/regulatory-library/${id}`, { method: 'DELETE', credentials: 'include' })
                if (res.ok) fetchRows()
              }}
            />
          </TabsContent>
          <TabsContent value="AC" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search AC number, subject, title…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="max-w-sm"
                aria-label="Search advisory circulars"
              />
            </div>
            {isQm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Upload advisory circular (Quality Manager)</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>AC number</Label>
                    <Input value={newAc} onChange={(e) => setNewAc(e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Subject</Label>
                    <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Version</Label>
                    <Input value={newVersion} onChange={(e) => setNewVersion(e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>PDF</Label>
                    <Input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      aria-label="PDF file"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="button" onClick={handleUpload} disabled={uploading}>
                      <Upload className="mr-2 h-4 w-4" />
                      {uploading ? 'Uploading…' : 'Upload'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <DocTable
              rows={filtered}
              loading={loading}
              isQm={isQm}
              onDelete={async (id) => {
                if (!confirm('Delete this document?')) return
                const res = await fetch(`/api/regulatory-library/${id}`, { method: 'DELETE', credentials: 'include' })
                if (res.ok) fetchRows()
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}

const DocTable = ({
  rows,
  loading,
  isQm,
  onDelete,
}: {
  rows: DocRow[]
  loading: boolean
  isQm: boolean
  onDelete: (id: string) => void
}) => {
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No documents.</p>
  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-2 font-medium">Title</th>
            <th className="text-left p-2 font-medium">Category</th>
            <th className="text-left p-2 font-medium">Version</th>
            <th className="text-left p-2 font-medium">AC #</th>
            <th className="text-left p-2 font-medium">Subject</th>
            <th className="text-left p-2 font-medium">Uploaded</th>
            <th className="text-right p-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2 font-medium">{r.title}</td>
              <td className="p-2 text-muted-foreground">{r.category ?? '—'}</td>
              <td className="p-2">{r.version ?? '—'}</td>
              <td className="p-2">{r.acNumber ?? '—'}</td>
              <td className="p-2 text-muted-foreground max-w-[200px] truncate" title={r.subject ?? ''}>
                {r.subject ?? '—'}
              </td>
              <td className="p-2 text-muted-foreground">{r.uploadedAt ? formatDate(r.uploadedAt) : '—'}</td>
              <td className="p-2 text-right space-x-2">
                <a
                  href={r.fileUrl.startsWith('http') ? r.fileUrl : `${typeof window !== 'undefined' ? window.location.origin : ''}${r.fileUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  View
                </a>
                {isQm && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(r.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default RegulatoryLibraryPage
