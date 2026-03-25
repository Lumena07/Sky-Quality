'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { Plus, AlertCircle, Clock, CheckCircle, Download } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { exportFindingsToExcel } from '@/lib/export/excel'
import { evaluateOverdue } from '@/lib/finding-overdue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CreateFindingForm } from '@/components/findings/create-finding-form'

const REVIEWER_ROLES = ['QUALITY_MANAGER', 'AUDITOR']

/** Get CorrectiveAction row from finding (handles API shape: array or single). */
const getCorrectiveAction = (finding: Record<string, unknown>) => {
  const raw = finding.CorrectiveAction ?? finding.correctiveAction ?? (finding as Record<string, unknown>).corrective_action
  if (Array.isArray(raw) && raw.length > 0) return raw[0] as Record<string, unknown>
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

const getOverdueForFinding = (finding: Record<string, unknown>) => {
  const ca = getCorrectiveAction(finding)
  return evaluateOverdue({
    findingStatus: finding.status as string | null | undefined,
    findingDueDate: finding.dueDate as string | null | undefined,
    findingCapDueDate: finding.capDueDate as string | null | undefined,
    hasCorrectiveAction: Boolean((ca as Record<string, unknown> | null)?.id),
    caDueDate: (ca?.dueDate as string | null | undefined) ?? null,
    capStatus: (ca?.capStatus as string | null | undefined) ?? null,
    catDueDate: (ca?.catDueDate as string | null | undefined) ?? null,
    catStatus: (ca?.catStatus as string | null | undefined) ?? null,
    correctiveActionTaken: (ca?.correctiveActionTaken as string | null | undefined) ?? null,
  })
}

const FindingsPage = () => {
  const [findings, setFindings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [userRoles, setUserRoles] = useState<string[]>([])

  useEffect(() => {
    fetchFindings()
  }, [filter])

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { roles: [] }))
      .then((data) => setUserRoles(Array.isArray(data?.roles) ? data.roles : []))
      .catch(() => setUserRoles([]))
  }, [])

  const canCreateFinding = userRoles.some((r) => REVIEWER_ROLES.includes(r))

  const fetchFindings = async () => {
    try {
      const url =
        filter === 'follow-up'
          ? '/api/findings?needsFollowUp=true'
          : filter !== 'all'
            ? `/api/findings?status=${filter}`
            : '/api/findings'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setFindings(data)
      }
    } catch (error) {
      console.error('Failed to fetch findings:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-red-100 text-red-800'
      case 'IN_PROGRESS':
        return 'bg-orange-100 text-orange-800'
      case 'UNDER_REVIEW':
        return 'bg-blue-100 text-blue-800'
      case 'CLOSED':
        return 'bg-green-100 text-green-800'
      case 'OVERDUE':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'bg-red-500'
      case 'Major':
        return 'bg-orange-500'
      case 'Minor':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  const overdueCount = findings.filter((f) => getOverdueForFinding(f).isOverdue).length

  const handleExportExcel = () => {
    const exportData = findings.map((finding) => ({
      findingNumber: finding.findingNumber,
      auditNumber: finding.audit?.auditNumber || 'N/A',
      department: finding.department?.name || 'N/A',
      policyReference: finding.policyReference,
      description: finding.description,
      rootCause: finding.rootCause || '',
      severity: finding.severity,
      status: finding.status,
      assignedTo: (() => {
        const a = finding.AssignedTo ?? finding.assignedTo
        return a ? [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || a.email || '' : ''
      })(),
      dueDate: finding.dueDate ? formatDate(finding.dueDate) : '',
      correctiveAction: finding.correctiveAction?.actionPlan || '',
      capStatus: finding.correctiveAction?.status || '',
      capDueDate: finding.correctiveAction?.dueDate ? formatDate(finding.correctiveAction.dueDate) : '',
    }))

    exportFindingsToExcel(exportData)
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Findings & Corrective Actions</h1>
            <p className="text-muted-foreground mt-2">
              Manage audit findings and track corrective actions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel} disabled={findings.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            {canCreateFinding && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Finding
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Finding</DialogTitle>
                    <DialogDescription>
                      Record a new audit finding with corrective action plan
                    </DialogDescription>
                  </DialogHeader>
                  <CreateFindingForm onSuccess={fetchFindings} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="grid gap-6 mb-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Findings</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{findings.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {findings.filter((f) => f.status === 'OPEN').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {findings.filter((f) => f.status === 'IN_PROGRESS').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overdueCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Findings</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'OPEN' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('OPEN')}
                >
                  Open
                </Button>
                <Button
                  variant={filter === 'IN_PROGRESS' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('IN_PROGRESS')}
                >
                  In Progress
                </Button>
                <Button
                  variant={filter === 'follow-up' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('follow-up')}
                  aria-label="Findings needing follow-up"
                >
                  Follow-up
                </Button>
                <Button
                  variant={filter === 'CLOSED' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('CLOSED')}
                >
                  Closed
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : findings.length === 0 ? (
              <p className="text-muted-foreground">No findings found</p>
            ) : (
              <div className="space-y-4">
                {findings.map((finding) => {
                  const overdueEval = getOverdueForFinding(finding)
                  const isOverdue = overdueEval.isOverdue
                  const assignee = finding.AssignedTo ?? finding.assignedTo
                  const assigneeName = assignee
                    ? [assignee.firstName, assignee.lastName].filter(Boolean).join(' ').trim() || assignee.email || '—'
                    : '—'
                  const ca = getCorrectiveAction(finding)
                  const rcaSubmitted = Boolean((finding.rootCause ?? '').toString().trim())
                  const capSubmitted = Boolean((ca?.actionPlan ?? '').toString().trim())
                  const catSubmitted = Boolean((ca?.correctiveActionTaken ?? '').toString().trim())
                  return (
                    <Link
                      key={finding.id}
                      href={`/findings/${finding.id}`}
                      className="block p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{finding.findingNumber}</h3>
                            <Badge className={getStatusColor(finding.status)}>
                              {finding.status}
                            </Badge>
                            <div
                              className={`w-3 h-3 rounded-full ${getSeverityColor(
                                finding.severity
                              )}`}
                              title={finding.severity}
                            />
                            {isOverdue && (
                              <Badge variant="destructive">
                                {overdueEval.kind === 'CAP'
                                  ? 'Overdue CAP'
                                  : overdueEval.kind === 'CAT'
                                    ? 'Overdue CAT'
                                    : 'Overdue'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {finding.description.substring(0, 150)}
                            {finding.description.length > 150 && '...'}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                            <span>
                              Policy: {finding.policyReference}
                            </span>
                            <span>
                              Assigned: {assigneeName}
                            </span>
                            {finding.dueDate && (
                              <span>
                                Due: {formatDate(finding.dueDate)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs" aria-label="RCA, CAP, CAT submission status">
                            <span
                              className={rcaSubmitted ? 'text-green-600 font-medium' : 'text-muted-foreground'}
                              title={rcaSubmitted ? 'Root cause submitted' : 'Root cause not submitted'}
                            >
                              RCA: {rcaSubmitted ? '✓' : '—'}
                            </span>
                            <span
                              className={capSubmitted ? 'text-green-600 font-medium' : 'text-muted-foreground'}
                              title={capSubmitted ? 'Corrective action plan submitted' : 'CAP not submitted'}
                            >
                              CAP: {capSubmitted ? '✓' : '—'}
                            </span>
                            <span
                              className={catSubmitted ? 'text-green-600 font-medium' : 'text-muted-foreground'}
                              title={catSubmitted ? 'Corrective action taken submitted' : 'CAT not submitted'}
                            >
                              CAT: {catSubmitted ? '✓' : '—'}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          {ca?.actionPlan ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-orange-600" />
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

export default FindingsPage
