'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useEffect, useState, useCallback } from 'react'
import { AlertCircle, Shield, ArrowUpRight, CalendarClock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

type EscalationRow = {
  id: string
  findingId: string
  escalatedAt: string
  trigger: string
  Finding?: Array<{ findingNumber: string; status: string }> | { findingNumber: string; status: string }
}

type RescheduleRequestRow = {
  id: string
  auditId: string
  requestedStartDate: string
  requestedEndDate: string
  requestedAt: string
  reason: string | null
  Audit?: { id: string; title?: string } | null
  RequestedBy?: { id: string; firstName?: string; lastName?: string } | null
}

type AmDashboardData = {
  escalations: EscalationRow[]
  pendingRescheduleRequests: RescheduleRequestRow[]
  pendingCapApprovals?: Array<{
    id: string
    findingId: string
    dueDate: string
    capStatus: string | null
    amCapStatus: string | null
    Finding?: Array<{ findingNumber: string; status: string; capDueDate: string | null }> | { findingNumber: string; status: string; capDueDate: string | null }
  }>
}

const AmDashboardPage = () => {
  const [data, setData] = useState<AmDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rejectDialogRequest, setRejectDialogRequest] = useState<{
    auditId: string
    requestId: string
  } | null>(null)
  const [rescheduleReviewNotes, setRescheduleReviewNotes] = useState('')
  const [savingRescheduleReview, setSavingRescheduleReview] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/am', { credentials: 'same-origin' })
      if (!res.ok) {
        if (res.status === 403) {
          setError('You do not have access to the AM Dashboard.')
          return
        }
        setError('Failed to load AM dashboard')
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setError('Failed to load AM dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRescheduleApproveReject = async (
    auditId: string,
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    reviewNotes?: string
  ) => {
    setSavingRescheduleReview(true)
    try {
      const res = await fetch(
        `/api/audits/${auditId}/reschedule-requests/${requestId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, reviewNotes: reviewNotes ?? null }),
          credentials: 'same-origin',
        }
      )
      if (res.ok) {
        setRejectDialogRequest(null)
        setRescheduleReviewNotes('')
        await fetchData()
      } else {
        const err = await res.json().catch(() => ({}))
        alert((err as { error?: string }).error ?? 'Failed to update reschedule request')
      }
    } catch {
      alert('Failed to update reschedule request')
    } finally {
      setSavingRescheduleReview(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-8 animate-pulse">
          <div className="mb-8 h-10 w-48 rounded bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </MainLayout>
    )
  }

  if (error || !data) {
    return (
      <MainLayout>
        <div className="p-8">
          <p className="text-destructive">{error ?? 'Failed to load data'}</p>
          <Link href="/dashboard">
            <Button variant="outline" className="mt-4">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </MainLayout>
    )
  }

  const getFindingNumber = (f: EscalationRow['Finding']): string => {
    if (!f) return '—'
    const arr = Array.isArray(f) ? f : [f]
    return arr[0]?.findingNumber ?? '—'
  }

  const getTriggerLabel = (trigger: string): string => {
    if (trigger === 'P1') return 'Priority 1'
    if (trigger === 'CAT_OVERDUE') return 'CAT overdue'
    if (trigger === 'OVERDUE_CAP') return 'CAP overdue'
    return trigger
  }

  const getCapFindingNumber = (
    f: NonNullable<NonNullable<AmDashboardData['pendingCapApprovals']>[number]['Finding']>
  ): string => {
    if (!f) return '—'
    const arr = Array.isArray(f) ? f : [f]
    return arr[0]?.findingNumber ?? '—'
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Accountable Manager Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Escalations requiring your attention.
            </p>
          </div>
          </div>
          <Link href="/dashboard/performance">
            <Button variant="outline" className="gap-2" aria-label="Open Performance dashboard">
              Performance
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="max-w-5xl">
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Pending CAP approvals</CardTitle>
                <CardDescription>
                  Corrective Action Plans awaiting your approval when extra resources are required.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {(data.pendingCapApprovals ?? []).length} pending
                </Badge>
                <AlertCircle className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              {(data.pendingCapApprovals ?? []).length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium">No CAP approvals pending.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    When Quality approves a CAP that requires resources, it will appear here for your approval.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3" role="list">
                  {(data.pendingCapApprovals ?? []).slice(0, 15).map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{getCapFindingNumber(c.Finding as any)}</span>
                          <Badge variant="secondary" className="text-xs">
                            AM approval pending
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">CAP due {formatDate(c.dueDate)}</p>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/findings/${c.findingId}`}>
                          <Button variant="outline" size="sm" aria-label={`Review CAP for finding ${getCapFindingNumber(c.Finding as any)}`}>
                            Review
                          </Button>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Escalations</CardTitle>
                <CardDescription>Findings escalated for management oversight.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {data.escalations.length} total
                </Badge>
                <AlertCircle className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              {data.escalations.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium">No escalations right now.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You can review CAP/CAT status and trends in the Performance dashboard.
                  </p>
                  <div className="mt-3">
                    <Link href="/dashboard/performance">
                      <Button variant="outline" className="gap-2" aria-label="View Performance dashboard">
                        View Performance dashboard
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="space-y-3" role="list">
                  {data.escalations.slice(0, 15).map((e) => (
                    <li
                      key={e.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{getFindingNumber(e.Finding)}</span>
                          <Badge variant="secondary" className="text-xs">
                            {getTriggerLabel(e.trigger)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Escalated {formatDate(e.escalatedAt)}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/findings/${e.findingId}`}>
                          <Button variant="outline" size="sm" aria-label={`View finding ${getFindingNumber(e.Finding)}`}>
                            View
                          </Button>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {data.escalations.length > 15 && (
                <Link href="/findings?needsFollowUp=true">
                  <Button variant="outline" className="w-full mt-2">
                    View all findings needing follow-up
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Reschedule requests</CardTitle>
                <CardDescription>Audit reschedule requests awaiting your approval or rejection.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {(data.pendingRescheduleRequests ?? []).length} pending
                </Badge>
                <CalendarClock className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              {!data.pendingRescheduleRequests?.length ? (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium">No pending reschedule requests.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    When auditors request an audit reschedule, it will appear here for you to approve or reject.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3" role="list">
                  {(data.pendingRescheduleRequests ?? []).map((r) => {
                    const audit = Array.isArray(r.Audit) ? r.Audit[0] : r.Audit
                    const requestedBy = Array.isArray(r.RequestedBy) ? r.RequestedBy[0] : r.RequestedBy
                    const name = requestedBy
                      ? [requestedBy.firstName, requestedBy.lastName].filter(Boolean).join(' ') || '—'
                      : '—'
                    return (
                      <li
                        key={r.id}
                        className="flex flex-col gap-3 rounded-lg border p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{audit?.title ?? 'Audit'}</div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Requested: {r.requestedStartDate} – {r.requestedEndDate}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            By {name} · {formatDate(r.requestedAt)}
                          </p>
                          {r.reason && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.reason}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                          <Button
                            size="sm"
                            disabled={savingRescheduleReview}
                            onClick={() =>
                              handleRescheduleApproveReject(r.auditId, r.id, 'APPROVED')
                            }
                            aria-label={`Approve reschedule for ${audit?.title ?? r.auditId}`}
                          >
                            {savingRescheduleReview ? 'Saving…' : 'Approve'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingRescheduleReview}
                            onClick={() =>
                              setRejectDialogRequest({ auditId: r.auditId, requestId: r.id })
                            }
                            aria-label={`Reject reschedule for ${audit?.title ?? r.auditId}`}
                          >
                            Reject
                          </Button>
                          <Link href={`/audits/${r.auditId}`}>
                            <Button variant="outline" size="sm" aria-label={`View audit ${audit?.title ?? r.auditId}`}>
                              View audit
                            </Button>
                          </Link>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog
          open={rejectDialogRequest !== null}
          onOpenChange={(open) => !open && setRejectDialogRequest(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reject reschedule request</DialogTitle>
              <DialogDescription>
                Optionally add notes for the requester.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="am-reschedule-reject-notes">Review notes</Label>
                <Textarea
                  id="am-reschedule-reject-notes"
                  value={rescheduleReviewNotes}
                  onChange={(e) => setRescheduleReviewNotes(e.target.value)}
                  placeholder="Reason for rejection (optional)"
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRejectDialogRequest(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={savingRescheduleReview}
                  onClick={() => {
                    if (rejectDialogRequest) {
                      handleRescheduleApproveReject(
                        rejectDialogRequest.auditId,
                        rejectDialogRequest.requestId,
                        'REJECTED',
                        rescheduleReviewNotes
                      )
                    }
                  }}
                >
                  {savingRescheduleReview ? 'Saving…' : 'Reject'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

export default AmDashboardPage
