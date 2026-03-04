'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, FileDown, Upload, Trash2, PlusCircle, ArrowUpDown, ChevronLeft, ChevronRight, Pencil, Eye } from 'lucide-react'
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
import { PdfPageStrip } from '@/components/documents/pdf-page-strip'

const isPdf = (doc: any) =>
  doc?.fileType === 'application/pdf' || /\.pdf$/i.test(doc?.fileUrl || '')

const DocumentViewPage = () => {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params?.id as string

  const [document, setDocument] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState<string | null>(null)

  const [removePagesOpen, setRemovePagesOpen] = useState(false)
  const [removePagesPageCount, setRemovePagesPageCount] = useState(0)
  const [removePagesSelected, setRemovePagesSelected] = useState<Set<number>>(new Set())
  const [removePagesLoading, setRemovePagesLoading] = useState(false)
  const [removePagesPending, setRemovePagesPending] = useState(false)

  const [addPagesOpen, setAddPagesOpen] = useState(false)
  const [addPagesFiles, setAddPagesFiles] = useState<File[]>([])
  const [addPagesPageCount, setAddPagesPageCount] = useState(0)
  const [addPagesInsertAt, setAddPagesInsertAt] = useState(0)
  const [addPagesPending, setAddPagesPending] = useState(false)

  const [reorderOpen, setReorderOpen] = useState(false)
  const [reorderPageCount, setReorderPageCount] = useState(0)
  const [reorderOrder, setReorderOrder] = useState<number[]>([])
  const [reorderLoading, setReorderLoading] = useState(false)
  const [reorderPending, setReorderPending] = useState(false)

  const [uploadVersionOpen, setUploadVersionOpen] = useState(false)
  const [uploadVersionFile, setUploadVersionFile] = useState<File | null>(null)
  const [uploadVersionPending, setUploadVersionPending] = useState(false)

  const [docMode, setDocMode] = useState<'view' | 'edit'>('view')
  const [editOrder, setEditOrder] = useState<number[]>([])
  const [originalEditOrder, setOriginalEditOrder] = useState<number[]>([])
  const [editSelected, setEditSelected] = useState<Set<number>>(new Set())
  const [editLoading, setEditLoading] = useState(false)
  const [editActionPending, setEditActionPending] = useState(false)
  const [pendingAdds, setPendingAdds] = useState<Array<{ files: File[]; insertAt: number }>>([])

  const fetchDocument = async () => {
    if (!id) return
    setLoading(true)
    setAccessError(null)
    try {
      const res = await fetch(`/api/documents/${id}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setDocument(data)
      } else {
        setDocument(null)
        if (res.status === 403) {
          const body = await res.json().catch(() => ({}))
          setAccessError((body as { error?: string }).error ?? 'Only manual holders can open this document.')
        }
      }
    } catch {
      setDocument(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocument()
  }, [id])

  useEffect(() => {
    if (loading || !document || !isPdf(document)) return
    if (searchParams.get('mode') === 'edit') {
      setDocMode('edit')
      setEditSelected(new Set())
      setEditLoading(true)
      fetch(`/api/documents/${document.id}/pdf/pages`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { pageCount: 0 }))
        .then((data) => {
          const count = data.pageCount ?? 0
          const order = Array.from({ length: count }, (_, i) => i)
          setEditOrder(order)
          setOriginalEditOrder(order)
        })
        .catch(() => {
          setEditOrder([])
          setOriginalEditOrder([])
        })
        .finally(() => setEditLoading(false))
    }
  }, [document, loading, searchParams])

  const handleSwitchToEdit = () => {
    setDocMode('edit')
    setEditSelected(new Set())
    setEditLoading(true)
    fetch(`/api/documents/${document.id}/pdf/pages`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { pageCount: 0 }))
      .then((data) => {
        const count = data.pageCount ?? 0
        const order = Array.from({ length: count }, (_, i) => i)
        setEditOrder(order)
        setOriginalEditOrder(order)
      })
      .catch(() => {
        setEditOrder([])
        setOriginalEditOrder([])
      })
      .finally(() => setEditLoading(false))
  }

  const handleEditPageClick = (pageIndex: number) => {
    setEditSelected((prev) => {
      const next = new Set(prev)
      if (next.has(pageIndex)) next.delete(pageIndex)
      else next.add(pageIndex)
      return next
    })
  }

  const handleEditMoveLeft = () => {
    if (editSelected.size === 0) return
    const positions = editOrder
      .map((pageIndex, pos) => (editSelected.has(pageIndex) ? pos : -1))
      .filter((p) => p >= 0)
    const leftmost = Math.min(...positions)
    if (leftmost <= 0) return
    const newOrder = [...editOrder]
    ;[newOrder[leftmost - 1], newOrder[leftmost]] = [newOrder[leftmost], newOrder[leftmost - 1]]
    setEditOrder(newOrder)
  }

  const handleEditMoveRight = () => {
    if (editSelected.size === 0) return
    const positions = editOrder
      .map((pageIndex, pos) => (editSelected.has(pageIndex) ? pos : -1))
      .filter((p) => p >= 0)
    const rightmost = Math.max(...positions)
    if (rightmost >= editOrder.length - 1) return
    const newOrder = [...editOrder]
    ;[newOrder[rightmost], newOrder[rightmost + 1]] = [newOrder[rightmost + 1], newOrder[rightmost]]
    setEditOrder(newOrder)
  }

  const handleEditRemove = () => {
    if (editSelected.size === 0) return
    setEditOrder((prev) => prev.filter((pageIndex) => !editSelected.has(pageIndex)))
    setEditSelected(new Set())
  }

  const handleEditReorder = (fromPosition: number, toPosition: number) => {
    if (fromPosition === toPosition) return
    setEditOrder((prev) => {
      const next = [...prev]
      const [removed] = next.splice(fromPosition, 1)
      next.splice(toPosition, 0, removed)
      return next
    })
  }

  const hasEditChanges = (): boolean => {
    if (pendingAdds.length > 0) return true
    if (editOrder.length !== originalEditOrder.length) return true
    return editOrder.some((v, i) => v !== originalEditOrder[i])
  }

  const handleEditDone = async () => {
    if (!document || !hasEditChanges()) {
      setDocMode('view')
      return
    }
    setEditActionPending(true)
    let currentFileUrl = document.fileUrl
    try {
      const removed = originalEditOrder.filter((i) => !editOrder.includes(i))

      if (removed.length > 0) {
        const removeRes = await fetch(`/api/documents/${document.id}/pdf/remove-pages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageIndexes: removed }),
          credentials: 'include',
        })
        if (!removeRes.ok) {
          const err = await removeRes.json().catch(() => ({}))
          alert(err?.error ?? 'Failed to remove pages')
          return
        }
        const removeData = await removeRes.json()
        currentFileUrl = removeData.fileUrl ?? currentFileUrl
        setDocument((prev) =>
          prev ? { ...prev, fileUrl: currentFileUrl, version: removeData.version ?? prev.version } : prev
        )

        const newPdfToOrig = originalEditOrder.filter((i) => !removed.includes(i))
        const reorderNeeded = editOrder.map((orig) => newPdfToOrig.indexOf(orig))
        const orderMatches = reorderNeeded.every((v, i) => v === i)
        if (!orderMatches) {
          const reorderRes = await fetch(`/api/documents/${document.id}/pdf/reorder-pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageOrder: reorderNeeded }),
            credentials: 'include',
          })
          if (!reorderRes.ok) {
            const err = await reorderRes.json().catch(() => ({}))
            alert(err?.error ?? 'Failed to reorder pages')
            return
          }
          const reorderData = await reorderRes.json()
          setDocument((prev) =>
            prev && reorderData.fileUrl
              ? { ...prev, fileUrl: reorderData.fileUrl, version: reorderData.version ?? prev.version }
              : prev
          )
        }
      } else {
        const orderMatches = editOrder.every((v, i) => v === originalEditOrder[i])
        if (!orderMatches) {
          const res = await fetch(`/api/documents/${document.id}/pdf/reorder-pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageOrder: editOrder }),
            credentials: 'include',
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            alert(err?.error ?? 'Failed to save order')
            return
          }
          const data = await res.json()
          setDocument((prev) =>
            prev && data.fileUrl
              ? { ...prev, fileUrl: data.fileUrl, version: data.version ?? prev.version }
              : prev
          )
        }
      }

      for (const { files, insertAt } of pendingAdds) {
        const formData = new FormData()
        files.forEach((f) => formData.append('files', f))
        formData.append('insertAt', String(insertAt))
        const addRes = await fetch(`/api/documents/${document.id}/pdf/add-pages`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })
        if (!addRes.ok) {
          const err = await addRes.json().catch(() => ({}))
          alert(err?.error ?? 'Failed to add pages')
          return
        }
      }
      setPendingAdds([])

      await fetchDocument()
      const countRes = await fetch(`/api/documents/${document.id}/pdf/pages`, { credentials: 'include' })
      const countData = countRes.ok ? await countRes.json() : { pageCount: 0 }
      const newCount = countData.pageCount ?? 0
      const order = Array.from({ length: newCount }, (_, i) => i)
      setEditOrder(order)
      setOriginalEditOrder(order)
      setDocMode('view')
    } catch (e) {
      console.error(e)
      alert('Failed to save changes')
    } finally {
      setEditActionPending(false)
    }
  }

  const handleOpenRemovePages = () => {
    if (!document) return
    setRemovePagesOpen(true)
    setRemovePagesPageCount(0)
    setRemovePagesSelected(new Set())
    setRemovePagesLoading(true)
    fetch(`/api/documents/${document.id}/pdf/pages`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { pageCount: 0 }))
      .then((data) => setRemovePagesPageCount(data.pageCount ?? 0))
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

  const handleRemovePagesSubmit = async () => {
    if (!document) return
    const pageIndexes = Array.from(removePagesSelected).sort((a, b) => a - b)
    if (pageIndexes.length === 0) {
      alert('Select at least one page to remove')
      return
    }
    setRemovePagesPending(true)
    try {
      const res = await fetch(`/api/documents/${document.id}/pdf/remove-pages`, {
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
      setRemovePagesOpen(false)
      setRemovePagesSelected(new Set())
      fetchDocument()
    } catch (e) {
      console.error(e)
      alert('Failed to remove pages')
    } finally {
      setRemovePagesPending(false)
    }
  }

  const handleOpenAddPages = () => {
    setAddPagesOpen(true)
    setAddPagesFiles([])
    const count = editOrder.length
    setAddPagesPageCount(count)
    setAddPagesInsertAt(count)
  }

  const handleAddPagesSubmit = () => {
    if (addPagesFiles.length === 0) return
    setPendingAdds((prev) => [...prev, { files: [...addPagesFiles], insertAt: addPagesInsertAt }])
    setAddPagesOpen(false)
    setAddPagesFiles([])
  }

  const handleOpenReorder = () => {
    if (!document) return
    setReorderOpen(true)
    setReorderPageCount(0)
    setReorderOrder([])
    setReorderLoading(true)
    fetch(`/api/documents/${document.id}/pdf/pages`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { pageCount: 0 }))
      .then((data) => {
        const count = data.pageCount ?? 0
        setReorderPageCount(count)
        setReorderOrder(Array.from({ length: count }, (_, i) => i))
      })
      .catch(() => setReorderOrder([]))
      .finally(() => setReorderLoading(false))
  }

  const handleReorderMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index <= 0) return
    if (direction === 'down' && index >= reorderOrder.length - 1) return
    setReorderOrder((prev) => {
      const next = [...prev]
      const swap = direction === 'up' ? index - 1 : index + 1
      ;[next[index], next[swap]] = [next[swap], next[index]]
      return next
    })
  }

  const handleReorderSubmit = async () => {
    if (!document || reorderOrder.length === 0) return
    setReorderPending(true)
    try {
      const res = await fetch(`/api/documents/${document.id}/pdf/reorder-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageOrder: reorderOrder }),
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err?.error ?? 'Failed to reorder pages')
        return
      }
      setReorderOpen(false)
      fetchDocument()
    } catch (e) {
      console.error(e)
      alert('Failed to reorder pages')
    } finally {
      setReorderPending(false)
    }
  }

  const handleUploadVersion = async () => {
    if (!document || !uploadVersionFile) return
    setUploadVersionPending(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadVersionFile)
      formData.append('entityType', 'document')
      formData.append('entityId', document.id)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' })
      if (!uploadRes.ok) {
        alert((await uploadRes.json().catch(() => ({})))?.error ?? 'Upload failed')
        return
      }
      const { fileUrl, fileType, fileSize } = await uploadRes.json()
      const patchRes = await fetch(`/api/documents/${document.id}`, {
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
        alert((await patchRes.json().catch(() => ({})))?.error ?? 'Failed to update document')
        return
      }
      setUploadVersionOpen(false)
      setUploadVersionFile(null)
      fetchDocument()
    } catch (e) {
      console.error(e)
      alert('Failed to upload new version')
    } finally {
      setUploadVersionPending(false)
    }
  }

  const pdfUrl =
    document?.fileUrl &&
    (document.fileUrl.startsWith('http') ? document.fileUrl : `${typeof window !== 'undefined' ? window.location.origin : ''}${document.fileUrl}`)

  if (loading) {
    return (
      <MainLayout>
        <div className="p-8">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </MainLayout>
    )
  }

  if (!document) {
    return (
      <MainLayout>
        <div className="p-8">
          <p className="text-muted-foreground">
            {accessError ?? 'Document not found.'}
          </p>
          <Link href="/documents">
            <Button variant="link" className="mt-2">
              Back to Documents
            </Button>
          </Link>
        </div>
      </MainLayout>
    )
  }

  const docIsPdf = isPdf(document)
  const editAllowed = searchParams.get('mode') === 'edit'

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-6">
          <Link href="/documents">
            <Button variant="ghost" className="mb-4" aria-label="Back to documents">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Documents
            </Button>
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <h1 className="text-2xl font-bold">{document.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {document.documentNumber} • v{document.version}
                  {(document.issueNumber ?? document.issue_number) != null && (
                    <> • Issue {(document.issueNumber ?? document.issue_number)}</>
                  )}
                  {(document.revisionNumber ?? document.revision_number) != null && (
                    <> • Revision {(document.revisionNumber ?? document.revision_number)}</>
                  )}
                </p>
              </div>
              <Badge variant="outline">{document.status}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {docIsPdf ? (
                <>
                  {editAllowed ? (
                    <>
                      <div className="flex rounded-md border border-input p-0.5">
                        <button
                          type="button"
                          onClick={() => setDocMode('view')}
                          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                            docMode === 'view' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          }`}
                          aria-pressed={docMode === 'view'}
                          aria-label="View mode"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={handleSwitchToEdit}
                          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                            docMode === 'edit' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          }`}
                          aria-pressed={docMode === 'edit'}
                          aria-label="Edit mode"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                      </div>
                      {docMode === 'edit' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditMoveLeft}
                            disabled={editSelected.size === 0 || editActionPending}
                            aria-label="Move selected page left"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditMoveRight}
                            disabled={editSelected.size === 0 || editActionPending}
                            aria-label="Move selected page right"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditRemove}
                            disabled={editSelected.size === 0 || editActionPending}
                            aria-label="Remove selected pages"
                          >
                            <Trash2 className="mr-1.5 h-4 w-4" />
                            Remove
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleOpenAddPages} aria-label="Add pages">
                            <PlusCircle className="mr-1.5 h-4 w-4" />
                            Add pages
                          </Button>
                        </>
                      )}
                    </>
                  ) : null}
                  {docMode === 'view' ? (
                    <Button variant="outline" asChild>
                      <a href={pdfUrl} target="_blank" rel="noopener noreferrer" aria-label="Open PDF in new tab">
                        <FileDown className="mr-2 h-4 w-4" />
                        Open in new tab
                      </a>
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      onClick={handleEditDone}
                      disabled={editActionPending}
                      aria-label="Done editing and save"
                    >
                      {editActionPending ? 'Saving…' : hasEditChanges() ? 'Done (save changes)' : 'Done'}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <a href={pdfUrl || '#'} target="_blank" rel="noopener noreferrer" aria-label="Open in Word">
                      <FileDown className="mr-2 h-4 w-4" />
                      Open in Word
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => { setUploadVersionOpen(true); setUploadVersionFile(null) }} aria-label="Upload new version">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload new version
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {docIsPdf && pdfUrl ? (
          <Card>
            <CardHeader>
              <CardTitle>Document</CardTitle>
              <p className="text-sm text-muted-foreground">
                {!editAllowed || docMode === 'view'
                  ? 'Read-only view of the document.'
                  : 'Click a page to select it, then use Move or Remove. Use Add pages to insert new PDFs.'}
              </p>
            </CardHeader>
            <CardContent>
              {!editAllowed || docMode === 'view' ? (
                <div className="border rounded-lg overflow-hidden bg-muted/20" style={{ minHeight: '70vh' }}>
                  <iframe
                    title={document.title}
                    src={pdfUrl}
                    className="w-full h-[75vh]"
                  />
                </div>
              ) : (
                <div className="flex gap-4">
                  {editLoading ? (
                    <p className="text-muted-foreground py-8">Loading pages…</p>
                  ) : editOrder.length === 0 ? (
                    <p className="text-muted-foreground py-8">No pages.</p>
                  ) : (
                    <>
                      <div className="flex-shrink-0 w-[140px] border-r pr-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Pages</p>
                        <PdfPageStrip
                          pdfUrl={pdfUrl}
                          order={editOrder}
                          selected={editSelected}
                          onPageClick={handleEditPageClick}
                          onReorder={handleEditReorder}
                          variant="vertical"
                          idPrefix="vert"
                          className="min-h-[200px]"
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Click to select, or drag a page to reorder. Use the toolbar to Move, Remove, or Add pages.</p>
                        <PdfPageStrip
                          pdfUrl={pdfUrl}
                          order={editOrder}
                          selected={editSelected}
                          onPageClick={handleEditPageClick}
                          onReorder={handleEditReorder}
                          variant="grid"
                          idPrefix="grid"
                          className="min-h-[200px] flex-1"
                        />
                      </div>
                    </>
                  )}
                  {editAllowed && !editLoading && editOrder.length > 0 && pendingAdds.length > 0 && (
                    <div className="pt-4 mt-4 border-t">
                      <span className="text-sm text-muted-foreground">
                        {pendingAdds.length} add(s) pending — will apply when you click Done
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8">
              <p className="text-muted-foreground">
                Use “Open in Word” to view or “Upload new version” to update this document.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Remove pages dialog — select by clicking the page in the view */}
        <Dialog open={removePagesOpen} onOpenChange={setRemovePagesOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Remove pages</DialogTitle>
              <DialogDescription>
                Click a page in the view below to select it for removal. Click again to deselect. Selected pages are highlighted.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col flex-1 min-h-0 py-2 gap-4">
              <p className="text-sm font-medium">{document.title}</p>
              <div className="flex-1 border rounded-lg bg-muted/30 overflow-hidden min-h-[240px]">
                {pdfUrl && (
                  <iframe title="PDF preview" src={pdfUrl} className="w-full h-[240px]" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Click a page to select for removal</p>
                {removePagesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : removePagesPageCount === 0 ? (
                  <p className="text-sm text-muted-foreground">No pages or failed to load.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: removePagesPageCount }, (_, i) => {
                      const selected = removePagesSelected.has(i)
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleRemovePageToggle(i)}
                          className={`
                            flex flex-col items-center justify-center w-20 h-28 rounded-lg border-2 text-sm font-medium
                            transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
                            ${selected
                              ? 'border-destructive bg-destructive/15 text-destructive'
                              : 'border-border bg-muted/50 hover:bg-muted text-foreground'}
                          `}
                          aria-label={selected ? `Page ${i + 1} selected for removal` : `Select page ${i + 1} for removal`}
                          aria-pressed={selected}
                        >
                          <FileText className="h-6 w-6 mb-1 opacity-80" />
                          <span>Page {i + 1}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {removePagesPageCount > 0 && removePagesSelected.size > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {removePagesSelected.size} page(s) selected for removal
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemovePagesOpen(false)}>Cancel</Button>
              <Button onClick={handleRemovePagesSubmit} disabled={removePagesSelected.size === 0 || removePagesPending}>
                {removePagesPending ? 'Processing…' : `Remove ${removePagesSelected.size} page(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add pages dialog */}
        <Dialog open={addPagesOpen} onOpenChange={setAddPagesOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add pages</DialogTitle>
              <DialogDescription>
                Choose PDF file(s) and where to insert them. They will be added when you click Done (no new version until then).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm font-medium">{document.title}</p>
              <div>
                <Label htmlFor="add-pages-insert">Insert at</Label>
                <select
                  id="add-pages-insert"
                  value={addPagesInsertAt}
                  onChange={(e) => setAddPagesInsertAt(parseInt(e.target.value, 10))}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value={addPagesPageCount}>At end of document</option>
                  {Array.from({ length: addPagesPageCount }, (_, i) => (
                    <option key={i} value={i + 1}>
                      After page {i + 1}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="add-pages-files">PDF files</Label>
                <Input
                  id="add-pages-files"
                  type="file"
                  multiple
                  accept=".pdf,application/pdf"
                  className="mt-1"
                  onChange={(e) => setAddPagesFiles(Array.from(e.target.files ?? []))}
                />
                {addPagesFiles.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{addPagesFiles.length} file(s) selected</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPagesOpen(false)}>Cancel</Button>
              <Button onClick={handleAddPagesSubmit} disabled={addPagesFiles.length === 0 || addPagesPending}>
                {addPagesPending ? 'Processing…' : 'Add pages'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reorder pages dialog */}
        <Dialog open={reorderOpen} onOpenChange={setReorderOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reorder pages</DialogTitle>
              <DialogDescription>
                Move pages up or down to change the order. Click Save to apply.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              {reorderLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : reorderOrder.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pages.</p>
              ) : (
                <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-2">
                  {reorderOrder.map((pageIndex, position) => (
                    <div
                      key={`${position}-${pageIndex}`}
                      className="flex items-center justify-between gap-2 py-2 px-3 border rounded-md bg-muted/30"
                    >
                      <span className="text-sm font-medium">Page {position + 1}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleReorderMove(position, 'up')}
                          disabled={position === 0}
                          aria-label="Move up"
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleReorderMove(position, 'down')}
                          disabled={position === reorderOrder.length - 1}
                          aria-label="Move down"
                        >
                          ↓
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReorderOpen(false)}>Cancel</Button>
              <Button onClick={handleReorderSubmit} disabled={reorderOrder.length === 0 || reorderPending}>
                {reorderPending ? 'Saving…' : 'Save order'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload new version (Word) */}
        <Dialog open={uploadVersionOpen} onOpenChange={setUploadVersionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload new version</DialogTitle>
              <DialogDescription>Select a new Word file to replace the current version.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="upload-version-file">Word document</Label>
                <Input
                  id="upload-version-file"
                  type="file"
                  accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="mt-1"
                  onChange={(e) => setUploadVersionFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadVersionOpen(false)}>Cancel</Button>
              <Button onClick={handleUploadVersion} disabled={!uploadVersionFile || uploadVersionPending}>
                {uploadVersionPending ? 'Uploading…' : 'Upload new version'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

export default DocumentViewPage
