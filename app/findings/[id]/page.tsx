'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { Upload, ArrowLeft, Check, X } from 'lucide-react'
import Link from 'next/link'
import { FileUpload, FileList } from '@/components/ui/file-upload'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabaseBrowserClient } from '@/lib/supabaseClient'

type ApprovalType = 'cap' | 'cat' | null

type CorrectiveActionFromFinding = {
  actionPlan?: string
  correctiveActionTaken?: string
  capStatus?: string
  catStatus?: string
  dueDate?: string
  catDueDate?: string
  capRejectionReason?: string
  catRejectionReason?: string
}

/** Get CorrectiveAction from finding API response; handles PostgREST relation key variants. */
const getCorrectiveActionFromFinding = (findingData: Record<string, unknown>): CorrectiveActionFromFinding | null => {
  const raw = findingData.CorrectiveAction ?? findingData.correctiveAction ?? (findingData as Record<string, unknown>).corrective_action
  if (Array.isArray(raw) && raw.length > 0) return raw[0] as CorrectiveActionFromFinding
  if (raw && typeof raw === 'object') return raw as CorrectiveActionFromFinding
  return null
}

const FindingDetailPage = () => {
  const params = useParams()
  const [finding, setFinding] = useState<any>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const [rejectDialogOpen, setRejectDialogOpen] = useState<ApprovalType>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState<ApprovalType>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [editRootCause, setEditRootCause] = useState('')
  const [editActionPlan, setEditActionPlan] = useState('')
  const [editCat, setEditCat] = useState('')
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false)
  const [catSaveFeedback, setCatSaveFeedback] = useState<'success' | 'error' | null>(null)
  const [extensionRequests, setExtensionRequests] = useState<any[]>([])
  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false)
  const [extReason, setExtReason] = useState('')
  const [extCapDue, setExtCapDue] = useState('')
  const [extCloseOutDue, setExtCloseOutDue] = useState('')
  const [extSubmitting, setExtSubmitting] = useState(false)
  const [extReviewingId, setExtReviewingId] = useState<string | null>(null)
  const [extRejectDialog, setExtRejectDialog] = useState<{ requestId: string; notes: string } | null>(null)

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabaseBrowserClient.auth.getUser()
      setCurrentUserId(user?.id ?? null)
      if (user?.id) {
        try {
          const res = await fetch('/api/me', { credentials: 'include' })
          if (res.ok) {
            const data = await res.json()
            setUserRoles(Array.isArray(data.roles) ? data.roles : [])
          }
        } catch {
          setUserRoles([])
        }
      }
    }
    loadUser()
  }, [])

  useEffect(() => {
    if (params.id) fetchFinding()
  }, [params.id])

  const fetchExtensionRequests = async () => {
    if (!params.id) return
    try {
      const res = await fetch(`/api/findings/${params.id}/extension-requests`, { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setExtensionRequests(data)
      }
    } catch {
      setExtensionRequests([])
    }
  }
  useEffect(() => {
    if (finding && params.id) fetchExtensionRequests()
  }, [finding, params.id])

  const fetchFinding = async () => {
    setFetchError(null)
    try {
      const res = await fetch(`/api/findings/${params.id}`, { credentials: 'same-origin' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setFinding(data)
        setUploadedFiles(data.attachments ?? [])
        setEditRootCause(data.rootCause ?? '')
        const caRow = getCorrectiveActionFromFinding(data)
        setEditActionPlan(caRow?.actionPlan ?? '')
        setEditCat(caRow?.correctiveActionTaken ?? '')
      } else {
        setFetchError((data.error as string) || 'Failed to load finding')
      }
    } catch {
      setFetchError('Failed to load finding')
    } finally {
      setLoading(false)
    }
  }

  const assignee = finding ? (finding.AssignedTo ?? finding.assignedTo) : null
  const assignedToId = finding?.assignedToId ?? finding?.AssignedTo?.id ?? finding?.assignedTo?.id
  const isAssignee = Boolean(currentUserId && assignedToId && currentUserId === assignedToId)
  const canReview = userRoles.some((r) => ['SYSTEM_ADMIN', 'QUALITY_MANAGER', 'AUDITOR'].includes(r))
  const assigneeDisplayName = assignee
    ? [assignee.firstName, assignee.lastName].filter(Boolean).join(' ').trim() || assignee.email || '—'
    : '—'

  const ca = finding ? getCorrectiveActionFromFinding(finding) : null

  const capApproved = ca?.capStatus === 'APPROVED'
  // Assignee can edit CAT only before submitting or when CAT was rejected (resubmit). Once saved (PENDING/APPROVED), read-only.
  const catSavedAndNotRejected =
    (ca?.correctiveActionTaken ?? '').toString().trim() !== '' &&
    ca?.catStatus !== 'REJECTED'
  const canEditCat = isAssignee && capApproved && !catSavedAndNotRejected

  // Root cause can be edited only before any CAP is submitted; once CAP exists it is locked
  const canEditRootCause = isAssignee && !ca?.actionPlan
  // CAP can be edited when first time (no CAP) or when CAP was rejected (resubmit only the CAP)
  const canEditCap = isAssignee && (!ca?.actionPlan || ca?.capStatus === 'REJECTED')

  const rootCauseDueDate = finding?.dueDate ?? finding?.capDueDate
  const capDueDate = ca?.dueDate ?? finding?.capDueDate
  const catDueDate = ca?.catDueDate ?? finding?.closeOutDueDate

  const getStatusBadge = (status: string | null | undefined) => {
    const s = status ?? 'PENDING'
    if (s === 'APPROVED') return <Badge className="bg-green-100 text-green-800">Approved</Badge>
    if (s === 'REJECTED') return <Badge className="bg-red-100 text-red-800">Rejected</Badge>
    return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>
  }

  const getReviewEndpoint = (type: ApprovalType) => {
    if (!type) return ''
    return type === 'cap' ? `/api/findings/${params.id}/cap-review` : `/api/findings/${params.id}/cat-review`
  }

  const handleSaveRootCauseAndCap = async () => {
    if (!isAssignee) return
    setSaving('root_cause_cap')
    try {
      if (canEditRootCause) {
        const res1 = await fetch(`/api/findings/${params.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rootCause: editRootCause }),
          credentials: 'same-origin',
        })
        if (!res1.ok) {
          alert((await res1.json().catch(() => ({}))).error ?? 'Failed to save root cause')
          return
        }
      }
      if (editActionPlan.trim()) {
        const res2 = await fetch(`/api/findings/${params.id}/corrective-action`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionPlan: editActionPlan }),
          credentials: 'same-origin',
        })
        if (!res2.ok) {
          alert((await res2.json().catch(() => ({}))).error ?? 'Failed to save corrective action plan')
          return
        }
      }
      await fetchFinding()
    } finally {
      setSaving(null)
    }
  }

  const handleSaveCat = async () => {
    if (!isAssignee) return
    setSaving('cat')
    setCatSaveFeedback(null)
    try {
      const res = await fetch(`/api/findings/${params.id}/corrective-action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correctiveActionTaken: editCat }),
        credentials: 'same-origin',
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        await fetchFinding()
        setCatSaveFeedback('success')
        setTimeout(() => setCatSaveFeedback(null), 3000)
      } else {
        setCatSaveFeedback('error')
        setTimeout(() => setCatSaveFeedback(null), 4000)
        alert((data as { error?: string }).error ?? 'Failed to save Corrective Action Taken')
      }
    } catch (err) {
      setCatSaveFeedback('error')
      setTimeout(() => setCatSaveFeedback(null), 4000)
      alert('Failed to save. Please check your connection and try again.')
    } finally {
      setSaving(null)
    }
  }

  const handleFileUpload = async (file: any) => {
    try {
      const res = await fetch(`/api/findings/${params.id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.fileName,
          fileUrl: file.fileUrl,
          fileType: file.fileType,
          fileSize: file.fileSize,
        }),
        credentials: 'same-origin',
      })
      if (res.ok) {
        await fetchFinding()
        setEvidenceDialogOpen(false)
      } else {
        alert((await res.json().catch(() => ({}))).error ?? 'Failed to upload evidence')
      }
    } catch {
      alert('Failed to upload evidence')
    }
  }

  const handleApprove = async (type: ApprovalType) => {
    if (!type) return
    setReviewSubmitting(type)
    try {
      const res = await fetch(getReviewEndpoint(type), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
        credentials: 'same-origin',
      })
      if (res.ok) await fetchFinding()
      else alert((await res.json().catch(() => ({}))).error ?? 'Failed to approve')
    } finally {
      setReviewSubmitting(null)
    }
  }

  const handleRejectSubmit = async () => {
    if (!rejectDialogOpen) return
    const reason = rejectReason.trim()
    if (!reason) {
      alert('Please enter a rejection reason.')
      return
    }
    setReviewSubmitting(rejectDialogOpen)
    try {
      const res = await fetch(getReviewEndpoint(rejectDialogOpen), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, rejectionReason: reason }),
        credentials: 'same-origin',
      })
      if (res.ok) {
        setRejectDialogOpen(null)
        setRejectReason('')
        await fetchFinding()
      } else {
        alert((await res.json().catch(() => ({}))).error ?? 'Failed to reject')
      }
    } finally {
      setReviewSubmitting(null)
    }
  }

  const canReviewCap = canReview && ca && (ca.capStatus === 'PENDING' || !ca.capStatus) && ca.actionPlan
  const canReviewCat = canReview && ca && (ca.catStatus === 'PENDING' || !ca.catStatus) && (ca.correctiveActionTaken || uploadedFiles.length > 0)

  if (loading) {
    return (
      <MainLayout>
        <div className="p-8"><p>Loading...</p></div>
      </MainLayout>
    )
  }

  if (fetchError || !finding) {
    return (
      <MainLayout>
        <div className="p-8 space-y-4">
          <p className="text-destructive font-medium">{fetchError || 'Finding not found'}</p>
          <Link href="/findings"><Button variant="outline">Back to Findings</Button></Link>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/findings">
            <Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Findings</Button>
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold">{finding.findingNumber}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {finding.Audit?.title ?? finding.audit?.title} • {finding.Department?.name ?? finding.department?.name}
          </p>
          <p className="text-sm mt-1">Assigned to: {assigneeDisplayName}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{finding.description}</p>
          </CardContent>
        </Card>

        {/* 1. Root Cause (no approval status – just content and due date) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">1. Root Cause</CardTitle>
            <div className="flex items-center gap-2">
              {rootCauseDueDate && (
                <span className="text-xs text-muted-foreground">Due: {formatDate(rootCauseDueDate)}</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {canEditRootCause ? (
              <Textarea
                placeholder="Enter root cause..."
                value={editRootCause}
                onChange={(e) => setEditRootCause(e.target.value)}
                rows={4}
                className="text-sm"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{finding.rootCause || '—'}</p>
            )}
          </CardContent>
        </Card>

        {/* 2. Corrective Action Plan */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">2. Corrective Action Plan</CardTitle>
            <div className="flex items-center gap-2">
              {capDueDate && <span className="text-xs text-muted-foreground">Due: {formatDate(capDueDate)}</span>}
              {ca ? getStatusBadge(ca.capStatus) : <Badge className="bg-gray-100 text-gray-800">Not submitted</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {canEditCap ? (
              <>
                <Textarea
                  placeholder="Enter corrective action plan..."
                  value={editActionPlan}
                  onChange={(e) => setEditActionPlan(e.target.value)}
                  rows={4}
                  className="text-sm"
                />
                <Button size="sm" onClick={handleSaveRootCauseAndCap} disabled={saving !== null}>
                  {saving === 'root_cause_cap' ? 'Saving...' : canEditRootCause ? 'Save Root Cause & CAP' : 'Save CAP'}
                </Button>
              </>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{ca?.actionPlan || '—'}</p>
            )}
            {ca?.capStatus === 'REJECTED' && ca.capRejectionReason && (
              <div className="rounded-md bg-red-50 p-2 text-sm text-red-800">
                <p className="font-medium">Rejection reason</p>
                <p className="mt-1 whitespace-pre-wrap">{ca.capRejectionReason}</p>
              </div>
            )}
            {canReviewCap && (
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => handleApprove('cap')} disabled={reviewSubmitting !== null}>
                  <Check className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejectDialogOpen('cap')} disabled={reviewSubmitting !== null}>
                  <X className="mr-2 h-4 w-4" /> Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Corrective Action Taken + Evidence */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">3. Corrective Action Taken</CardTitle>
            <div className="flex items-center gap-2">
              {catDueDate && <span className="text-xs text-muted-foreground">Due: {formatDate(catDueDate)}</span>}
              {ca ? getStatusBadge(ca.catStatus) : <Badge className="bg-gray-100 text-gray-800">Not submitted</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isAssignee && !capApproved && (
              <p className="text-sm text-muted-foreground rounded-md bg-muted p-2">
                Corrective Action Plan must be approved before you can enter Corrective Action Taken and upload evidence.
              </p>
            )}
            {canEditCat ? (
              <>
                <Textarea
                  placeholder="Describe corrective action taken..."
                  value={editCat}
                  onChange={(e) => setEditCat(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <div>
                  <p className="text-sm font-medium mb-2">Evidence (multiple files)</p>
                  <Dialog open={evidenceDialogOpen} onOpenChange={setEvidenceDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><Upload className="mr-2 h-4 w-4" /> Upload Evidence</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload Evidence</DialogTitle>
                        <DialogDescription>Add photos, PDFs, or other evidence</DialogDescription>
                      </DialogHeader>
                      <FileUpload
                        entityType="finding"
                        entityId={params.id as string}
                        onUploadComplete={handleFileUpload}
                        onUploadError={(e) => alert(e)}
                      />
                    </DialogContent>
                  </Dialog>
                  <div className="mt-2">
                    <FileList
                      files={uploadedFiles.map((f: any) => ({
                        fileUrl: f.fileUrl,
                        fileName: f.name,
                        fileSize: f.fileSize,
                        fileType: f.fileType,
                      }))}
                      showDownload
                      showUrl={false}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSaveCat} disabled={saving !== null}>
                    {saving === 'cat' ? 'Saving...' : 'Save'}
                  </Button>
                  {catSaveFeedback === 'success' && (
                    <span className="text-sm text-green-600 font-medium">Saved.</span>
                  )}
                  {catSaveFeedback === 'error' && (
                    <span className="text-sm text-destructive font-medium">Save failed.</span>
                  )}
                </div>
              </>
            ) : !isAssignee || capApproved ? (
              <>
                <p className="text-sm whitespace-pre-wrap">{ca?.correctiveActionTaken || '—'}</p>
                {uploadedFiles.length > 0 && (
                  <FileList
                    files={uploadedFiles.map((f: any) => ({
                      fileUrl: f.fileUrl,
                      fileName: f.name,
                      fileSize: f.fileSize,
                      fileType: f.fileType,
                    }))}
                    showDownload
                    showUrl={false}
                  />
                )}
              </>
            ) : null}
            {ca?.catStatus === 'REJECTED' && ca.catRejectionReason && (
              <div className="rounded-md bg-red-50 p-2 text-sm text-red-800">
                <p className="font-medium">Rejection reason</p>
                <p className="mt-1 whitespace-pre-wrap">{ca.catRejectionReason}</p>
              </div>
            )}
            {canReviewCat && (
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => handleApprove('cat')} disabled={reviewSubmitting !== null}>
                  <Check className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejectDialogOpen('cat')} disabled={reviewSubmitting !== null}>
                  <X className="mr-2 h-4 w-4" /> Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extension requests (auditee request; reviewer approve/reject) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Extension requests</CardTitle>
            {isAssignee && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setExtReason('')
                  setExtCapDue('')
                  setExtCloseOutDue('')
                  setExtensionDialogOpen(true)
                }}
              >
                Request extension
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {extensionRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No extension requests. As assignee you can request an extension for CAP or close-out due dates.
              </p>
            ) : (
              <ul className="space-y-3">
                {extensionRequests.map((req: any) => (
                  <li key={req.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge
                        className={
                          req.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : req.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {req.status}
                      </Badge>
                      <span className="text-muted-foreground">
                        Requested {req.requestedAt ? formatDate(req.requestedAt) : ''}
                      </span>
                    </div>
                    <p className="font-medium mb-1">Reason</p>
                    <p className="whitespace-pre-wrap text-muted-foreground mb-2">{req.reason}</p>
                    {(req.requestedCapDueDate || req.requestedCloseOutDueDate) && (
                      <p className="text-muted-foreground text-xs mb-2">
                        CAP due: {req.requestedCapDueDate ?? '—'} · Close-out due: {req.requestedCloseOutDueDate ?? '—'}
                      </p>
                    )}
                    {req.status === 'REJECTED' && req.reviewNotes && (
                      <p className="text-red-700 text-xs">Review notes: {req.reviewNotes}</p>
                    )}
                    {canReview && req.status === 'PENDING' && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            setExtReviewingId(req.id)
                            try {
                              const res = await fetch(
                                `/api/findings/${params.id}/extension-requests/${req.id}`,
                                {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'APPROVED' }),
                                  credentials: 'same-origin',
                                }
                              )
                              if (res.ok) await fetchExtensionRequests().then(() => fetchFinding())
                              else alert((await res.json().catch(() => ({}))).error ?? 'Failed to approve')
                            } finally {
                              setExtReviewingId(null)
                            }
                          }}
                          disabled={extReviewingId !== null}
                        >
                          {extReviewingId === req.id ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExtRejectDialog({ requestId: req.id, notes: '' })}
                          disabled={extReviewingId !== null}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Dialog open={extensionDialogOpen} onOpenChange={setExtensionDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request extension</DialogTitle>
              <DialogDescription>
                Request an extension for CAP and/or close-out due dates. A reviewer will approve or reject.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="ext-reason">Reason *</Label>
                <Textarea
                  id="ext-reason"
                  value={extReason}
                  onChange={(e) => setExtReason(e.target.value)}
                  placeholder="Explain why you need an extension..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ext-cap">Requested CAP due date</Label>
                  <Input
                    id="ext-cap"
                    type="date"
                    value={extCapDue}
                    onChange={(e) => setExtCapDue(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ext-close">Requested close-out due date</Label>
                  <Input
                    id="ext-close"
                    type="date"
                    value={extCloseOutDue}
                    onChange={(e) => setExtCloseOutDue(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setExtensionDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!extReason.trim() || extSubmitting}
                  onClick={async () => {
                    setExtSubmitting(true)
                    try {
                      const res = await fetch(`/api/findings/${params.id}/extension-request`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          reason: extReason.trim(),
                          requestedCapDueDate: extCapDue || null,
                          requestedCloseOutDueDate: extCloseOutDue || null,
                        }),
                        credentials: 'same-origin',
                      })
                      if (res.ok) {
                        setExtensionDialogOpen(false)
                        fetchExtensionRequests()
                      } else {
                        const err = await res.json().catch(() => ({}))
                        alert(err.error ?? 'Failed to submit request')
                      }
                    } finally {
                      setExtSubmitting(false)
                    }
                  }}
                >
                  {extSubmitting ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={extRejectDialog !== null}
          onOpenChange={(open) => !open && setExtRejectDialog(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject extension request</DialogTitle>
              <DialogDescription>Optionally add notes for the assignee.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ext-reject-notes">Review notes</Label>
                <Textarea
                  id="ext-reject-notes"
                  value={extRejectDialog?.notes ?? ''}
                  onChange={(e) =>
                    setExtRejectDialog((d) => (d ? { ...d, notes: e.target.value } : null))
                  }
                  placeholder="Optional..."
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setExtRejectDialog(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={extReviewingId !== null}
                  onClick={async () => {
                    if (!extRejectDialog) return
                    setExtReviewingId(extRejectDialog.requestId)
                    try {
                      const res = await fetch(
                        `/api/findings/${params.id}/extension-requests/${extRejectDialog.requestId}`,
                        {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            status: 'REJECTED',
                            reviewNotes: extRejectDialog.notes.trim() || null,
                          }),
                          credentials: 'same-origin',
                        }
                      )
                      if (res.ok) {
                        setExtRejectDialog(null)
                        fetchExtensionRequests().then(() => fetchFinding())
                      } else {
                        alert((await res.json().catch(() => ({}))).error ?? 'Failed to reject')
                      }
                    } finally {
                      setExtReviewingId(null)
                    }
                  }}
                >
                  {extReviewingId === extRejectDialog?.requestId ? 'Rejecting...' : 'Reject'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={rejectDialogOpen !== null} onOpenChange={(open) => !open && setRejectDialogOpen(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject {rejectDialogOpen === 'cap' ? 'Corrective Action Plan' : 'Corrective Action Taken'}</DialogTitle>
              <DialogDescription>Reason for rejection. The assigned person will see this and can resubmit.</DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="mt-2"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setRejectDialogOpen(null)}>Cancel</Button>
              <Button onClick={handleRejectSubmit} disabled={!rejectReason.trim() || reviewSubmitting !== null}>
                {reviewSubmitting ? 'Submitting...' : 'Reject'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

export default FindingDetailPage
