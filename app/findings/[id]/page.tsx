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
import {
  CAP_RESOURCE_LABELS,
  CAP_RESOURCE_VALUES,
  capRequiresAccountableManager,
  type CapResourceValue,
} from '@/lib/cap-resources'

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
  capResourceTypes?: string[]
  amCapStatus?: string
  amCapRejectionReason?: string
  proposedCatDueDate?: string
  proposedCatDueDateReason?: string
  catDueDateProposalStatus?: string
  catDueDateRejectionReason?: string
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
  const [extCloseOutDue, setExtCloseOutDue] = useState('')
  const [extSubmitting, setExtSubmitting] = useState(false)
  const [extReviewingId, setExtReviewingId] = useState<string | null>(null)
  const [extRejectDialog, setExtRejectDialog] = useState<{ requestId: string; notes: string } | null>(null)
  const [capResourceSelection, setCapResourceSelection] = useState<string[]>(['NONE'])
  const [amRejectOpen, setAmRejectOpen] = useState(false)
  const [amRejectReason, setAmRejectReason] = useState('')
  const [amReviewSubmitting, setAmReviewSubmitting] = useState(false)
  const [proposalCatDueDate, setProposalCatDueDate] = useState('')
  const [proposalCatReason, setProposalCatReason] = useState('')
  const [proposalReviewSubmitting, setProposalReviewSubmitting] = useState(false)
  const [proposalRejectOpen, setProposalRejectOpen] = useState(false)
  const [proposalRejectReason, setProposalRejectReason] = useState('')

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

  useEffect(() => {
    if (!finding) return
    const row = getCorrectiveActionFromFinding(finding as Record<string, unknown>)
    const raw = row?.capResourceTypes
    if (Array.isArray(raw) && raw.length > 0) {
      setCapResourceSelection(raw.map((x) => String(x).toUpperCase()))
    } else {
      setCapResourceSelection(['NONE'])
    }
    setProposalCatDueDate(row?.proposedCatDueDate ? String(row.proposedCatDueDate).slice(0, 10) : '')
    setProposalCatReason(row?.proposedCatDueDateReason ?? '')
  }, [finding])

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
  /** Only auditors of this finding's audit (or Quality Manager) can approve/reject CAP/CAT. */
  const canReviewCapCat = finding?.canReviewCapCat === true
  const isQualityManagerUser = userRoles.includes('QUALITY_MANAGER')
  const isAccountableManagerUser = userRoles.includes('ACCOUNTABLE_MANAGER')
  /** CAT extension requests: Quality Manager only. */
  const canReviewExtensionRequest = (req: { requestedCloseOutDueDate?: string | null; requestedCapDueDate?: string | null }) => {
    return isQualityManagerUser && Boolean(req.requestedCloseOutDueDate) && !Boolean(req.requestedCapDueDate)
  }
  const assigneeDisplayName = assignee
    ? [assignee.firstName, assignee.lastName].filter(Boolean).join(' ').trim() || assignee.email || '—'
    : '—'

  const ca = finding ? getCorrectiveActionFromFinding(finding) : null

  const capApproved = ca?.capStatus === 'APPROVED'
  const needsAmCapApproval = capRequiresAccountableManager(ca?.capResourceTypes)
  const amCapApproved = ca?.amCapStatus === 'APPROVED'
  const amCapPending = ca?.amCapStatus === 'PENDING'
  const amCapGateOk = !needsAmCapApproval || amCapApproved
  // Assignee can edit CAT only before submitting or when CAT was rejected (resubmit). Once saved (PENDING/APPROVED), read-only.
  const catSavedAndNotRejected =
    (ca?.correctiveActionTaken ?? '').toString().trim() !== '' &&
    ca?.catStatus !== 'REJECTED'
  const canEditCat = isAssignee && capApproved && amCapGateOk && !catSavedAndNotRejected

  // Root cause can be edited only before any CAP is submitted; once CAP exists it is locked
  const canEditRootCause = isAssignee && !ca?.actionPlan
  // CAP can be edited when first time (no CAP) or when CAP was rejected (resubmit only the CAP)
  const canEditCap = isAssignee && (!ca?.actionPlan || ca?.capStatus === 'REJECTED')
  const canEditCatProposalAtCap = canEditCap
  const canReviewCatProposal =
    isQualityManagerUser &&
    !!ca?.proposedCatDueDate &&
    (ca?.catDueDateProposalStatus === 'PENDING')

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

  const handleCapResourceToggle = (value: CapResourceValue, checked: boolean) => {
    if (value === 'NONE') {
      setCapResourceSelection(checked ? ['NONE'] : [])
      return
    }
    setCapResourceSelection((prev) => {
      const withoutNone = prev.filter((t) => t !== 'NONE')
      if (checked) {
        const next = [...withoutNone, value]
        return Array.from(new Set(next))
      }
      const next = withoutNone.filter((t) => t !== value)
      return next.length === 0 ? ['NONE'] : next
    })
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
          body: JSON.stringify({
            actionPlan: editActionPlan,
            capResourceTypes: capResourceSelection,
            proposedCatDueDate: proposalCatDueDate || null,
            proposedCatDueDateReason: proposalCatReason || null,
          }),
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

  const canReviewCap =
    canReviewCapCat && ca && (ca.capStatus === 'PENDING' || !ca.capStatus) && ca.actionPlan

  const canReviewAmCap =
    isAccountableManagerUser &&
    ca &&
    ca.capStatus === 'APPROVED' &&
    needsAmCapApproval &&
    amCapPending
  const canReviewCat = canReviewCapCat && ca && (ca.catStatus === 'PENDING' || !ca.catStatus) && (ca.correctiveActionTaken || uploadedFiles.length > 0)

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
                <fieldset className="space-y-2 rounded-md border p-3">
                  <legend className="text-sm font-medium px-1">Resources required to implement the CAP</legend>
                  <p className="text-xs text-muted-foreground">
                    If anything other than &quot;No extra resources&quot; is selected, the Accountable Manager must
                    approve after Quality approves the plan.
                  </p>
                  <div className="flex flex-col gap-2" role="group" aria-label="CAP resource types">
                    {CAP_RESOURCE_VALUES.map((val) => (
                      <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={capResourceSelection.includes(val)}
                          onChange={(e) => handleCapResourceToggle(val, e.target.checked)}
                          className="h-4 w-4 rounded border"
                          aria-label={CAP_RESOURCE_LABELS[val]}
                        />
                        <span>{CAP_RESOURCE_LABELS[val]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="space-y-2 rounded-md border p-3">
                  <legend className="text-sm font-medium px-1">Longer CAT due date at CAP entry (optional)</legend>
                  <p className="text-xs text-muted-foreground">
                    Use this when you already know, while entering CAP, that the current CAT due date is too short.
                    This is different from a later extension request and is reviewed by Quality Manager.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="proposal-cat-due">Proposed CAT due date</Label>
                      <Input
                        id="proposal-cat-due"
                        type="date"
                        value={proposalCatDueDate}
                        onChange={(e) => setProposalCatDueDate(e.target.value)}
                        aria-label="Proposed longer CAT due date"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                      <Label htmlFor="proposal-cat-reason">Reason</Label>
                      <Input
                        id="proposal-cat-reason"
                        value={proposalCatReason}
                        onChange={(e) => setProposalCatReason(e.target.value)}
                        placeholder="Why CAT needs more time..."
                        aria-label="Reason for longer CAT due date"
                      />
                    </div>
                  </div>
                </fieldset>
                <Button size="sm" onClick={handleSaveRootCauseAndCap} disabled={saving !== null}>
                  {saving === 'root_cause_cap' ? 'Saving...' : canEditRootCause ? 'Save Root Cause & CAP' : 'Save CAP'}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm whitespace-pre-wrap">{ca?.actionPlan || '—'}</p>
                {ca?.capResourceTypes && Array.isArray(ca.capResourceTypes) && ca.capResourceTypes.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Resources: </span>
                    {(ca.capResourceTypes as string[])
                      .map((k) => CAP_RESOURCE_LABELS[k as CapResourceValue] ?? k)
                      .join(', ')}
                  </div>
                )}
                {ca?.proposedCatDueDate && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      <span className="font-medium text-foreground">Proposed longer CAT due date: </span>
                      {formatDate(ca.proposedCatDueDate)}
                    </div>
                    {ca?.proposedCatDueDateReason && (
                      <div>
                        <span className="font-medium text-foreground">Reason: </span>
                        {ca.proposedCatDueDateReason}
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-foreground">QM proposal review: </span>
                      {getStatusBadge(ca?.catDueDateProposalStatus)}
                    </div>
                  </div>
                )}
              </>
            )}
            {ca?.catDueDateProposalStatus === 'REJECTED' && ca?.catDueDateRejectionReason && (
              <div className="rounded-md bg-red-50 p-2 text-sm text-red-800">
                <p className="font-medium">Longer CAT due-date proposal rejected</p>
                <p className="mt-1 whitespace-pre-wrap">{ca.catDueDateRejectionReason}</p>
              </div>
            )}
            {canReviewCatProposal && (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    setProposalReviewSubmitting(true)
                    try {
                      const res = await fetch(`/api/findings/${params.id}/cat-due-proposal-review`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ approved: true }),
                        credentials: 'same-origin',
                      })
                      if (res.ok) await fetchFinding()
                      else alert((await res.json().catch(() => ({}))).error ?? 'Failed to approve')
                    } finally {
                      setProposalReviewSubmitting(false)
                    }
                  }}
                  disabled={proposalReviewSubmitting}
                >
                  <Check className="mr-2 h-4 w-4" /> Approve longer CAT due date
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setProposalRejectReason('')
                    setProposalRejectOpen(true)
                  }}
                  disabled={proposalReviewSubmitting}
                >
                  <X className="mr-2 h-4 w-4" /> Reject longer CAT due date
                </Button>
              </div>
            )}
            {capApproved && needsAmCapApproval && (
              <div className="text-sm">
                <span className="font-medium">Accountable Manager (resources): </span>
                {getStatusBadge(ca?.amCapStatus)}
              </div>
            )}
            {canReviewAmCap && (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    setAmReviewSubmitting(true)
                    try {
                      const res = await fetch(`/api/findings/${params.id}/am-cap-review`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ approved: true }),
                        credentials: 'same-origin',
                      })
                      if (res.ok) await fetchFinding()
                      else alert((await res.json().catch(() => ({}))).error ?? 'Failed to approve')
                    } finally {
                      setAmReviewSubmitting(false)
                    }
                  }}
                  disabled={amReviewSubmitting}
                >
                  <Check className="mr-2 h-4 w-4" /> Approve (Accountable Manager)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAmRejectReason('')
                    setAmRejectOpen(true)
                  }}
                  disabled={amReviewSubmitting}
                >
                  <X className="mr-2 h-4 w-4" /> Reject (Accountable Manager)
                </Button>
              </div>
            )}
            {ca?.amCapStatus === 'REJECTED' && ca.amCapRejectionReason && (
              <div className="rounded-md bg-red-50 p-2 text-sm text-red-800">
                <p className="font-medium">Accountable Manager rejection</p>
                <p className="mt-1 whitespace-pre-wrap">{ca.amCapRejectionReason}</p>
              </div>
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
            {isAssignee && capApproved && needsAmCapApproval && !amCapApproved && (
              <p className="text-sm text-muted-foreground rounded-md bg-muted p-2">
                Accountable Manager approval is required for this CAP (resources) before you can enter Corrective Action
                Taken.
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
                    {req.requestedCloseOutDueDate && (
                      <p className="text-muted-foreground text-xs mb-2">
                        CAT extension requested to: {req.requestedCloseOutDueDate ?? '—'}
                      </p>
                    )}
                    {req.status === 'REJECTED' && req.reviewNotes && (
                      <p className="text-red-700 text-xs">Review notes: {req.reviewNotes}</p>
                    )}
                    {canReviewExtensionRequest(req) && req.status === 'PENDING' && (
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
                Request a CAT extension when the current CAT due date is close and you may miss it. This is different
                from the longer CAT due date proposed during CAP entry. CAT extension requests are approved by Quality
                Manager only.
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
              <div className="space-y-2">
                <Label htmlFor="ext-close">Requested new CAT due date</Label>
                <Input
                  id="ext-close"
                  type="date"
                  value={extCloseOutDue}
                  onChange={(e) => setExtCloseOutDue(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setExtensionDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!extReason.trim() || !extCloseOutDue || extSubmitting}
                  onClick={async () => {
                    setExtSubmitting(true)
                    try {
                      const res = await fetch(`/api/findings/${params.id}/extension-request`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          reason: extReason.trim(),
                          requestedCapDueDate: null,
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

        <Dialog open={amRejectOpen} onOpenChange={setAmRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject CAP (Accountable Manager)</DialogTitle>
              <DialogDescription>Provide a reason. The assignee can revise and resubmit the plan.</DialogDescription>
            </DialogHeader>
            <Textarea
              value={amRejectReason}
              onChange={(e) => setAmRejectReason(e.target.value)}
              placeholder="Rejection reason..."
              rows={3}
              className="mt-2"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setAmRejectOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={amReviewSubmitting || !amRejectReason.trim()}
                onClick={async () => {
                  setAmReviewSubmitting(true)
                  try {
                    const res = await fetch(`/api/findings/${params.id}/am-cap-review`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ approved: false, rejectionReason: amRejectReason.trim() }),
                      credentials: 'same-origin',
                    })
                    if (res.ok) {
                      setAmRejectOpen(false)
                      await fetchFinding()
                    } else {
                      alert((await res.json().catch(() => ({}))).error ?? 'Failed to reject')
                    }
                  } finally {
                    setAmReviewSubmitting(false)
                  }
                }}
              >
                {amReviewSubmitting ? 'Submitting...' : 'Reject'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={proposalRejectOpen} onOpenChange={setProposalRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject longer CAT due date proposal</DialogTitle>
              <DialogDescription>Provide a reason for rejecting the upfront CAT due date proposal.</DialogDescription>
            </DialogHeader>
            <Textarea
              value={proposalRejectReason}
              onChange={(e) => setProposalRejectReason(e.target.value)}
              placeholder="Rejection reason..."
              rows={3}
              className="mt-2"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setProposalRejectOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={proposalReviewSubmitting || !proposalRejectReason.trim()}
                onClick={async () => {
                  setProposalReviewSubmitting(true)
                  try {
                    const res = await fetch(`/api/findings/${params.id}/cat-due-proposal-review`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ approved: false, rejectionReason: proposalRejectReason.trim() }),
                      credentials: 'same-origin',
                    })
                    if (res.ok) {
                      setProposalRejectOpen(false)
                      await fetchFinding()
                    } else {
                      alert((await res.json().catch(() => ({}))).error ?? 'Failed to reject')
                    }
                  } finally {
                    setProposalReviewSubmitting(false)
                  }
                }}
              >
                {proposalReviewSubmitting ? 'Submitting...' : 'Reject'}
              </Button>
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
