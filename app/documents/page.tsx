'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { FileText, FileDown, Upload, PlusCircle, Plus, Pencil } from 'lucide-react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabaseBrowserClient } from '@/lib/supabaseClient'
import { isDocumentCustodian, parseJsonStringArray } from '@/lib/permissions'

const CUSTODIAN_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'QUALITY_MANAGER', label: 'Quality Manager' },
  { value: 'AUDITOR', label: 'Auditor' },
  { value: 'ACCOUNTABLE_MANAGER', label: 'Accountable Manager' },
  { value: 'DEPARTMENT_HEAD', label: 'Department Head' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'SYSTEM_ADMIN', label: 'System Admin' },
  { value: 'FOCAL_PERSON', label: 'Focal Person' },
]

const DocumentsPage = () => {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'review' | 'masters' | 'approved'>('review')

  const [uploadVersionDoc, setUploadVersionDoc] = useState<any>(null)
  const [uploadVersionFile, setUploadVersionFile] = useState<File | null>(null)
  const [uploadVersionPending, setUploadVersionPending] = useState(false)

  const [removePagesDoc, setRemovePagesDoc] = useState<any>(null)
  const [removePagesPageCount, setRemovePagesPageCount] = useState<number>(0)
  const [removePagesSelected, setRemovePagesSelected] = useState<Set<number>>(new Set())
  const [removePagesLoading, setRemovePagesLoading] = useState(false)
  const [removePagesPending, setRemovePagesPending] = useState(false)

  const [addPagesDoc, setAddPagesDoc] = useState<any>(null)
  const [addPagesFiles, setAddPagesFiles] = useState<File[]>([])
  const [addPagesPending, setAddPagesPending] = useState(false)

  const [uploadDocOpen, setUploadDocOpen] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocIssueNumber, setNewDocIssueNumber] = useState('')
  const [newDocRevisionNumber, setNewDocRevisionNumber] = useState('')
  const [newDocCustodianRoles, setNewDocCustodianRoles] = useState<string[]>([])
  const [newDocDepartmentIds, setNewDocDepartmentIds] = useState<string[]>([])
  const [newDocFile, setNewDocFile] = useState<File | null>(null)
  const [newDocCopyNumber, setNewDocCopyNumber] = useState('')
  const [newDocPending, setNewDocPending] = useState(false)
  const [users, setUsers] = useState<{ id: string; firstName?: string; lastName?: string; email?: string }[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userRoles, setUserRoles] = useState<string[]>([])

  useEffect(() => {
    fetchDocuments()
  }, [])

  useEffect(() => {
    supabaseBrowserClient.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null)
    })
  }, [])

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { roles: [] }))
      .then((data) => setUserRoles(Array.isArray(data?.roles) ? data.roles : []))
      .catch(() => setUserRoles([]))
  }, [])

  const hasReviewerRole = userRoles.some((r) =>
    ['QUALITY_MANAGER', 'AUDITOR'].includes(r)
  )

  useEffect(() => {
    fetch('/api/users', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
  }, [])

  useEffect(() => {
    fetch('/api/departments', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setDepartments(Array.isArray(data) ? data : []))
      .catch(() => setDepartments([]))
  }, [])

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/documents', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const underReview = documents.filter((d) => d.status === 'REVIEW')
  const masters = documents.filter((d) => d.status === 'DRAFT')
  const approved = documents.filter((d) => d.status === 'APPROVED')

  const handleOpenInWord = (doc: any) => {
    if (!doc?.fileUrl) return
    const url = doc.fileUrl.startsWith('http') ? doc.fileUrl : `${window.location.origin}${doc.fileUrl}`
    window.open(url, '_blank', 'noopener')
  }

  const handleUploadVersion = async () => {
    if (!uploadVersionDoc || !uploadVersionFile) return
    setUploadVersionPending(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadVersionFile)
      formData.append('entityType', 'document')
      formData.append('entityId', uploadVersionDoc.id)

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        alert(err?.error ?? 'Upload failed')
        return
      }
      const { fileUrl, fileType, fileSize } = await uploadRes.json()

      const patchRes = await fetch(`/api/documents/${uploadVersionDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl,
          fileType,
          fileSize,
          changeLog: `New version uploaded: ${uploadVersionFile.name}`,
        }),
        credentials: 'include',
      })
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}))
        alert(err?.error ?? 'Failed to update document')
        return
      }
      setUploadVersionDoc(null)
      setUploadVersionFile(null)
      fetchDocuments()
    } catch (e) {
      console.error(e)
      alert('Failed to upload new version')
    } finally {
      setUploadVersionPending(false)
    }
  }

  const handleOpenRemovePages = (doc: any) => {
    setRemovePagesDoc(doc)
    setRemovePagesPageCount(0)
    setRemovePagesSelected(new Set())
    setRemovePagesLoading(true)
    fetch(`/api/documents/${doc.id}/pdf/pages`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { pageCount: 0 }))
      .then((data) => {
        setRemovePagesPageCount(data.pageCount ?? 0)
      })
      .catch(() => setRemovePagesPageCount(0))
      .finally(() => setRemovePagesLoading(false))
  }

  const handleRemovePageToggle = (pageIndex: number) => {
    setRemovePagesSelected((prev) => {
      const next = new Set(prev)
      if (next.has(pageIndex)) next.delete(pageIndex)
      else next.add(pageIndex)
      return next
    })
  }

  const handleRemovePages = async () => {
    if (!removePagesDoc) return
    const pageIndexes = Array.from(removePagesSelected).sort((a, b) => a - b)
    if (pageIndexes.length === 0) {
      alert('Select at least one page to remove')
      return
    }
    setRemovePagesPending(true)
    try {
      const res = await fetch(`/api/documents/${removePagesDoc.id}/pdf/remove-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageIndexes }),
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err?.error ?? 'Failed to remove pages')
        return
      }
      setRemovePagesDoc(null)
      setRemovePagesSelected(new Set())
      fetchDocuments()
    } catch (e) {
      console.error(e)
      alert('Failed to remove pages')
    } finally {
      setRemovePagesPending(false)
    }
  }

  const handleUploadNewDocument = async () => {
    const title = newDocTitle.trim()
    const issueNumber = newDocIssueNumber.trim()
    const revisionNumber = newDocRevisionNumber.trim()
    if (!title) {
      alert('Title is required')
      return
    }
    if (!newDocFile) {
      alert('Please select a file (Word or PDF)')
      return
    }
    if (!issueNumber) {
      alert('Issue number is required')
      return
    }
    if (!revisionNumber) {
      alert('Revision number is required')
      return
    }
    if (newDocCustodianRoles.length === 0) {
      alert('Select at least one manual custodian role')
      return
    }
    if (activeTab === 'approved' && !newDocCopyNumber.trim()) {
      alert('Manual copy number is required for approved documents')
      return
    }
    setNewDocPending(true)
    try {
      const formData = new FormData()
      formData.append('file', newDocFile)
      formData.append('entityType', 'document')
      formData.append('entityId', 'new')

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        alert(err?.error ?? 'Upload failed')
        return
      }
      const { fileUrl, fileType, fileSize } = await uploadRes.json()

      const postRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          issueNumber,
          revisionNumber,
          manualCustodianRoles: newDocCustodianRoles,
          manualHolderIds: [],
          departmentIds: activeTab === 'approved' ? newDocDepartmentIds : [],
          version: '1.0',
          fileUrl,
          fileType,
          fileSize,
          status:
            activeTab === 'review'
              ? 'REVIEW'
              : activeTab === 'approved'
                ? 'APPROVED'
                : 'DRAFT',
          ...(activeTab === 'approved'
            ? { initialManualCopyNumber: newDocCopyNumber.trim() }
            : {}),
        }),
        credentials: 'include',
      })
      if (!postRes.ok) {
        const err = await postRes.json().catch(() => ({}))
        alert(err?.error ?? 'Failed to create document')
        return
      }
      setUploadDocOpen(false)
      setNewDocTitle('')
      setNewDocIssueNumber('')
      setNewDocRevisionNumber('')
      setNewDocCustodianRoles([])
      setNewDocDepartmentIds([])
      setNewDocCopyNumber('')
      setNewDocFile(null)
      fetchDocuments()
    } catch (e) {
      console.error(e)
      alert('Failed to upload document')
    } finally {
      setNewDocPending(false)
    }
  }

  const handleAddPages = async () => {
    if (!addPagesDoc || addPagesFiles.length === 0) return
    setAddPagesPending(true)
    try {
      const formData = new FormData()
      addPagesFiles.forEach((f) => formData.append('files', f))

      const res = await fetch(`/api/documents/${addPagesDoc.id}/pdf/add-pages`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err?.error ?? 'Failed to add pages')
        return
      }
      setAddPagesDoc(null)
      setAddPagesFiles([])
      fetchDocuments()
    } catch (e) {
      console.error(e)
      alert('Failed to add pages')
    } finally {
      setAddPagesPending(false)
    }
  }

  const getDepartmentNames = (doc: {
    departmentIds?: string[]
    department_ids?: string[]
  }): string => {
    const ids = doc.departmentIds ?? doc.department_ids ?? []
    if (!Array.isArray(ids) || ids.length === 0) return '—'
    const names = ids
      .map((id) => departments.find((d) => d.id === id)?.name)
      .filter(Boolean)
    return names.length > 0 ? names.join(', ') : '—'
  }

  const getLegacyHolderNames = (doc: { manualHolderIds?: string[]; manual_holder_ids?: string[] }): string => {
    const ids = doc.manualHolderIds ?? doc.manual_holder_ids ?? []
    if (!Array.isArray(ids) || ids.length === 0) return ''
    const names = ids
      .map((id) => {
        const u = users.find((x) => x.id === id)
        if (!u) return null
        return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || id
      })
      .filter(Boolean)
    return names.length > 0 ? names.join(', ') : ''
  }

  const formatCustodianSummary = (doc: {
    manualCustodianRoles?: unknown
    manualHolderIds?: string[]
    manual_holder_ids?: string[]
  }): string => {
    const roleCodes = parseJsonStringArray(doc.manualCustodianRoles)
    const roleLabels = roleCodes.map(
      (r) => CUSTODIAN_ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r
    )
    const legacy = getLegacyHolderNames(doc)
    const parts: string[] = []
    if (roleLabels.length > 0) parts.push(roleLabels.join(', '))
    if (legacy) parts.push(`Legacy holders: ${legacy}`)
    return parts.length > 0 ? parts.join(' · ') : '—'
  }

  const isCustodianForDoc = (doc: {
    manualCustodianRoles?: unknown
    manualHolderIds?: unknown
  }): boolean => {
    if (!currentUserId) return false
    return isDocumentCustodian(currentUserId, userRoles, doc)
  }

  const renderDocRow = (
    doc: any,
    options: {
      openInWord?: boolean
      uploadNewVersion?: boolean
      viewPdf?: boolean
      editPdf?: boolean
    }
  ) => {
    const status = doc.status as string
    const isReviewOrDraft = status === 'REVIEW' || status === 'DRAFT'
    const isCustodian = isCustodianForDoc(doc)
    const canOpenOrEdit =
      !isReviewOrDraft || isCustodian || hasReviewerRole
    const canEditApprovedPdf = status === 'APPROVED' ? hasReviewerRole : canOpenOrEdit
    const showOpenInWord = options.openInWord && canOpenOrEdit
    const showUploadNewVersion = options.uploadNewVersion && canOpenOrEdit

    return (
      <div
        key={doc.id}
        className="flex items-center justify-between gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/documents/${doc.id}`} className="font-semibold hover:underline focus:outline-none focus:underline">
                  {doc.title}
                </Link>
                <Badge variant="outline">v{doc.version}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{doc.documentNumber}</p>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Issue: </span>
              {(doc.issueNumber ?? doc.issue_number) ?? '—'}
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Revision: </span>
              {(doc.revisionNumber ?? doc.revision_number) ?? '—'}
            </div>
            <div className="text-sm min-w-0">
              <span className="text-muted-foreground">Manual custodian: </span>
              <span className="truncate block" title={formatCustodianSummary(doc)}>
                {formatCustodianSummary(doc)}
              </span>
            </div>
            <div className="text-sm min-w-0">
              <span className="text-muted-foreground">Departments: </span>
              <span className="truncate block" title={getDepartmentNames(doc)}>
                {getDepartmentNames(doc)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isReviewOrDraft && !canOpenOrEdit && (
            <span className="text-xs text-muted-foreground">Manual custodians only</span>
          )}
          {showOpenInWord && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenInWord(doc)}
              aria-label="Open in Word"
            >
              <FileDown className="mr-1 h-4 w-4" />
              Open in Word
            </Button>
          )}
          {showUploadNewVersion && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUploadVersionDoc(doc)
                setUploadVersionFile(null)
              }}
              aria-label="Upload new version"
            >
              <Upload className="mr-1 h-4 w-4" />
              Upload new version
            </Button>
          )}
          {options.viewPdf && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/documents/${doc.id}`} aria-label="View document">
                <FileDown className="mr-1 h-4 w-4" />
                View
              </Link>
            </Button>
          )}
          {options.editPdf && canEditApprovedPdf && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/documents/${doc.id}?mode=edit`} aria-label="Edit document">
                <Pencil className="mr-1 h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-8 animate-pulse">
          <div className="mb-8 h-10 w-52 rounded bg-muted" />
          <div className="mb-6 h-9 w-48 rounded bg-muted" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Document Control</h1>
            <p className="text-muted-foreground mt-2">
              Under Review and Masters: Word documents. Approved: PDF manuals with add/remove pages.
            </p>
          </div>
          {hasReviewerRole && (
            <Button onClick={() => setUploadDocOpen(true)} aria-label="Upload document">
              <Plus className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="review">Under Review</TabsTrigger>
            <TabsTrigger value="masters">Masters</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
          </TabsList>

          <TabsContent value="review" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Under Review</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Word documents in review. Open in Word to edit, then upload a new version.
                </p>
              </CardHeader>
              <CardContent>
                {underReview.length === 0 ? (
                  <p className="text-muted-foreground py-8">No documents under review.</p>
                ) : (
                  <div className="space-y-2">
                    {underReview.map((doc) =>
                      renderDocRow(doc, { openInWord: true, uploadNewVersion: true })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="masters" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Masters</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Master Word documents. Open in Word to edit, then upload a new version.
                </p>
              </CardHeader>
              <CardContent>
                {masters.length === 0 ? (
                  <p className="text-muted-foreground py-8">No master documents.</p>
                ) : (
                  <div className="space-y-2">
                    {masters.map((doc) =>
                      renderDocRow(doc, { openInWord: true, uploadNewVersion: true })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Approved</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Approved PDF manuals. View, remove pages, or add pages (PDF only).
                </p>
              </CardHeader>
              <CardContent>
                {approved.length === 0 ? (
                  <p className="text-muted-foreground py-8">No approved documents.</p>
                ) : (
                  <div className="space-y-2">
                    {approved.map((doc) =>
                      renderDocRow(doc, {
                        viewPdf: true,
                        editPdf: true,
                      })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Upload new version (Word) */}
        <Dialog open={!!uploadVersionDoc} onOpenChange={(open) => !open && setUploadVersionDoc(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload new version</DialogTitle>
              <DialogDescription>
                Upload a new Word file. It will replace the current version for this document.
              </DialogDescription>
            </DialogHeader>
            {uploadVersionDoc && (
              <div className="space-y-4 py-2">
                <p className="text-sm font-medium">{uploadVersionDoc.title}</p>
                <div>
                  <Label htmlFor="version-file">Word document</Label>
                  <Input
                    id="version-file"
                    type="file"
                    accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="mt-1"
                    onChange={(e) => setUploadVersionFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadVersionDoc(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleUploadVersion}
                disabled={!uploadVersionFile || uploadVersionPending}
              >
                {uploadVersionPending ? 'Uploading…' : 'Upload new version'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove pages (PDF) – view PDF and select pages to remove */}
        <Dialog open={!!removePagesDoc} onOpenChange={(open) => !open && setRemovePagesDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Remove pages</DialogTitle>
              <DialogDescription>
                View the PDF below and select the pages you want to remove.
              </DialogDescription>
            </DialogHeader>
            {removePagesDoc && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2 flex-1 min-h-0">
                <div className="flex flex-col min-h-[320px]">
                  <p className="text-sm font-medium mb-2">{removePagesDoc.title}</p>
                  <div className="flex-1 border rounded-md bg-muted/30 overflow-hidden min-h-[280px]">
                    <iframe
                      title="PDF preview"
                      src={
                        removePagesDoc.fileUrl?.startsWith('http')
                          ? removePagesDoc.fileUrl
                          : `${typeof window !== 'undefined' ? window.location.origin : ''}${removePagesDoc.fileUrl}`
                      }
                      className="w-full h-full min-h-[280px]"
                    />
                  </div>
                </div>
                <div className="flex flex-col min-h-0">
                  <Label className="mb-2">Select pages to remove</Label>
                  {removePagesLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : removePagesPageCount === 0 ? (
                    <p className="text-sm text-muted-foreground">No pages or failed to load.</p>
                  ) : (
                    <div className="space-y-1 overflow-y-auto max-h-[280px] pr-2 border rounded-md p-2 bg-muted/20">
                      {Array.from({ length: removePagesPageCount }, (_, i) => (
                        <label
                          key={i}
                          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={removePagesSelected.has(i)}
                            onChange={() => handleRemovePageToggle(i)}
                            className="h-4 w-4 rounded border-input"
                          />
                          <span>Page {i + 1}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {removePagesPageCount > 0 && removePagesSelected.size > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {removePagesSelected.size} page(s) selected for removal
                    </p>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemovePagesDoc(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleRemovePages}
                disabled={removePagesSelected.size === 0 || removePagesPending}
              >
                {removePagesPending ? 'Processing…' : `Remove ${removePagesSelected.size} page(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add pages (PDF) */}
        <Dialog open={!!addPagesDoc} onOpenChange={(open) => !open && setAddPagesDoc(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add pages</DialogTitle>
              <DialogDescription>
                Upload PDF file(s) to append as new pages to this manual.
              </DialogDescription>
            </DialogHeader>
            {addPagesDoc && (
              <div className="space-y-4 py-2">
                <p className="text-sm font-medium">{addPagesDoc.title}</p>
                <div>
                  <Label htmlFor="add-pages">PDF files</Label>
                  <Input
                    id="add-pages"
                    type="file"
                    multiple
                    accept=".pdf,application/pdf"
                    className="mt-1"
                    onChange={(e) =>
                      setAddPagesFiles(Array.from(e.target.files ?? []))
                    }
                  />
                  {addPagesFiles.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {addPagesFiles.length} file(s) selected
                    </p>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPagesDoc(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddPages}
                disabled={addPagesFiles.length === 0 || addPagesPending}
              >
                {addPagesPending ? 'Processing…' : 'Add pages'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload new document */}
        <Dialog
          open={uploadDocOpen}
          onOpenChange={(open) => {
            setUploadDocOpen(open)
            if (!open) setNewDocCopyNumber('')
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 overflow-hidden p-6 sm:max-h-[min(90vh,760px)]">
            <DialogHeader className="shrink-0 space-y-1 pr-8">
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Saved under{' '}
                {activeTab === 'review'
                  ? 'Under Review'
                  : activeTab === 'approved'
                    ? 'Approved'
                    : 'Masters'}
                . Issue, revision, custodian roles, and file are required
                {activeTab === 'approved' ? '; manual copy number is required for Approved.' : '.'}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto py-2 -mx-1 px-1">
              <div className="grid gap-5 lg:grid-cols-2 lg:gap-6 lg:items-start">
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                    <p className="text-sm font-semibold text-foreground">Document</p>
                    <div className="space-y-2">
                      <Label htmlFor="new-doc-title">Title *</Label>
                      <Input
                        id="new-doc-title"
                        placeholder="Document title"
                        value={newDocTitle}
                        onChange={(e) => setNewDocTitle(e.target.value)}
                        aria-required="true"
                      />
                    </div>
                    <div
                      className={`grid gap-3 ${activeTab === 'approved' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
                    >
                      <div className="space-y-2">
                        <Label htmlFor="new-doc-issue">Issue *</Label>
                        <Input
                          id="new-doc-issue"
                          placeholder="e.g. 1"
                          value={newDocIssueNumber}
                          onChange={(e) => setNewDocIssueNumber(e.target.value)}
                          aria-required="true"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-doc-revision">Revision *</Label>
                        <Input
                          id="new-doc-revision"
                          placeholder="e.g. 0"
                          value={newDocRevisionNumber}
                          onChange={(e) => setNewDocRevisionNumber(e.target.value)}
                          aria-required="true"
                        />
                      </div>
                      {activeTab === 'approved' && (
                        <div className="space-y-2 sm:col-span-1">
                          <Label htmlFor="new-doc-copy-number">Copy # *</Label>
                          <Input
                            id="new-doc-copy-number"
                            placeholder="e.g. 01"
                            value={newDocCopyNumber}
                            onChange={(e) => setNewDocCopyNumber(e.target.value)}
                            aria-required="true"
                            aria-label="Manual copy number for approved document"
                          />
                          <p className="text-xs text-muted-foreground leading-snug">
                            First controlled copy for this manual.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                    <p className="text-sm font-semibold text-foreground">File</p>
                    <Label htmlFor="new-doc-file" className="sr-only">
                      File Word or PDF required
                    </Label>
                    <Input
                      id="new-doc-file"
                      type="file"
                      accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                      onChange={(e) => setNewDocFile(e.target.files?.[0] ?? null)}
                      aria-required="true"
                    />
                    {newDocFile ? (
                      <p className="text-xs text-muted-foreground truncate" title={newDocFile.name}>
                        Selected: {newDocFile.name}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Word or PDF *</p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                    <p className="text-sm font-semibold text-foreground">Manual custodian roles *</p>
                    <p className="text-xs text-muted-foreground">
                      Users with any selected role can open or edit Under Review / Masters.
                    </p>
                    <div className="max-h-[min(200px,28vh)] overflow-y-auto rounded-md border bg-background p-2 space-y-1">
                      {CUSTODIAN_ROLE_OPTIONS.map((opt) => {
                        const checked = newDocCustodianRoles.includes(opt.value)
                        return (
                          <label
                            key={opt.value}
                            className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-muted/60 cursor-pointer text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setNewDocCustodianRoles((prev) =>
                                  prev.includes(opt.value)
                                    ? prev.filter((r) => r !== opt.value)
                                    : [...prev, opt.value]
                                )
                              }}
                              className="h-3.5 w-3.5 rounded border-input shrink-0"
                              aria-label={`Select ${opt.label} as manual custodian role`}
                            />
                            <span>{opt.label}</span>
                          </label>
                        )
                      })}
                    </div>
                    {newDocCustodianRoles.length > 0 && (
                      <p className="text-xs text-muted-foreground">{newDocCustodianRoles.length} selected</p>
                    )}
                  </div>
                  {activeTab === 'approved' && (
                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                      <p className="text-sm font-semibold text-foreground">Departments (optional)</p>
                      <p className="text-xs text-muted-foreground">Notify selected departments.</p>
                      <div className="max-h-[min(160px,22vh)] overflow-y-auto rounded-md border bg-background p-2 space-y-1">
                        {departments.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-1">Loading…</p>
                        ) : (
                          departments.map((d) => {
                            const checked = newDocDepartmentIds.includes(d.id)
                            return (
                              <label
                                key={d.id}
                                className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-muted/60 cursor-pointer text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setNewDocDepartmentIds((prev) =>
                                      prev.includes(d.id)
                                        ? prev.filter((id) => id !== d.id)
                                        : [...prev, d.id]
                                    )
                                  }}
                                  className="h-3.5 w-3.5 rounded border-input shrink-0"
                                  aria-label={`Select department ${d.name}`}
                                />
                                <span className="truncate">{d.name}</span>
                              </label>
                            )
                          })
                        )}
                      </div>
                      {newDocDepartmentIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">{newDocDepartmentIds.length} selected</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t border-border pt-4 mt-2">
              <Button variant="outline" onClick={() => setUploadDocOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUploadNewDocument}
                disabled={
                  !newDocTitle.trim() ||
                  !newDocIssueNumber.trim() ||
                  !newDocRevisionNumber.trim() ||
                  newDocCustodianRoles.length === 0 ||
                  !newDocFile ||
                  newDocPending ||
                  (activeTab === 'approved' && !newDocCopyNumber.trim())
                }
              >
                {newDocPending ? 'Uploading…' : 'Upload Document'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

export default DocumentsPage
