'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/utils'
import {
  CalendarRange,
  ClipboardList,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

export type AuditPreparationUserRef = {
  id: string
  firstName: string | null
  lastName: string | null
} | null

export type AuditPreparationQuestionRow = {
  id: string
  sortOrder: number
  questionText: string
  createdAt: string
  createdById: string
}

export type AuditPreparationPayload = {
  preparationPriorFindingsReviewedAt: string | null
  preparationPriorFindingsReviewedById: string | null
  preparationStandardsReviewedAt: string | null
  preparationStandardsReviewedById: string | null
  preparationPriorFindingsReviewedBy: AuditPreparationUserRef
  preparationStandardsReviewedBy: AuditPreparationUserRef
  questions: AuditPreparationQuestionRow[]
}

type FindingRow = {
  id: string
  findingNumber?: string
  auditId: string
  description?: string
  severity?: string
  status?: string
  policyReference?: string
  Audit?: { title?: string; auditNumber?: string }
}

type DocumentRow = {
  id: string
  title: string
  status?: string
  departmentIds?: string[] | null
}

const formatReviewer = (u: AuditPreparationUserRef) => {
  if (!u) return ''
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  return name || 'User'
}

type AuditPreparationProps = {
  auditId: string
  departmentId: string | null | undefined
  isActiveTab: boolean
  canMutate: boolean
  onGoToChecklist: () => void
  onGoToSchedule: () => void
  showSendToAuditees?: boolean
  canSendToAuditees?: boolean
  sendingToAuditees?: boolean
  checklistScheduleSentAt?: string | null
  onSendScheduleAndChecklistToAuditees?: () => void | Promise<void>
}

export const AuditPreparation = ({
  auditId,
  departmentId,
  isActiveTab,
  canMutate,
  onGoToChecklist,
  onGoToSchedule,
  showSendToAuditees = false,
  canSendToAuditees = false,
  sendingToAuditees = false,
  checklistScheduleSentAt = null,
  onSendScheduleAndChecklistToAuditees,
}: AuditPreparationProps) => {
  const [prep, setPrep] = useState<AuditPreparationPayload | null>(null)
  const [prepLoading, setPrepLoading] = useState(false)
  const [prepError, setPrepError] = useState<string | null>(null)
  const [findings, setFindings] = useState<FindingRow[]>([])
  const [findingsLoading, setFindingsLoading] = useState(false)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [stepSaving, setStepSaving] = useState<'prior' | 'standards' | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addText, setAddText] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)

  const loadPreparation = useCallback(async () => {
    setPrepLoading(true)
    setPrepError(null)
    try {
      const res = await fetch(`/api/audits/${auditId}/preparation`, { credentials: 'same-origin' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setPrepError((data as { error?: string }).error ?? 'Failed to load preparation')
        setPrep(null)
        return
      }
      const data = (await res.json()) as AuditPreparationPayload
      setPrep(data)
    } catch {
      setPrepError('Failed to load preparation')
      setPrep(null)
    } finally {
      setPrepLoading(false)
    }
  }, [auditId])

  useEffect(() => {
    if (!isActiveTab) return
    loadPreparation()
  }, [isActiveTab, loadPreparation])

  useEffect(() => {
    if (!isActiveTab || !departmentId) return
    const loadFindings = async () => {
      setFindingsLoading(true)
      try {
        const res = await fetch(
          `/api/findings?departmentId=${encodeURIComponent(departmentId)}`,
          { credentials: 'same-origin' }
        )
        if (!res.ok) {
          setFindings([])
          return
        }
        const data = (await res.json()) as FindingRow[]
        const filtered = (Array.isArray(data) ? data : []).filter((f) => f.auditId !== auditId)
        setFindings(filtered)
      } catch {
        setFindings([])
      } finally {
        setFindingsLoading(false)
      }
    }
    loadFindings()
  }, [isActiveTab, departmentId, auditId])

  useEffect(() => {
    if (!isActiveTab || !departmentId) return
    const loadDocs = async () => {
      setDocumentsLoading(true)
      try {
        const res = await fetch('/api/documents?status=APPROVED', { credentials: 'same-origin' })
        if (!res.ok) {
          setDocuments([])
          return
        }
        const data = (await res.json()) as DocumentRow[]
        const list = Array.isArray(data) ? data : []
        const filtered = list.filter((d) => {
          const ids = d.departmentIds
          if (!ids || !Array.isArray(ids)) return false
          return ids.includes(departmentId)
        })
        setDocuments(filtered.slice(0, 12))
      } catch {
        setDocuments([])
      } finally {
        setDocumentsLoading(false)
      }
    }
    loadDocs()
  }, [isActiveTab, departmentId])

  const handlePriorToggle = async (checked: boolean) => {
    if (!canMutate) return
    setStepSaving('prior')
    try {
      const res = await fetch(`/api/audits/${auditId}/preparation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ priorFindingsReviewed: checked }),
      })
      if (res.ok) {
        const data = (await res.json()) as AuditPreparationPayload
        setPrep(data)
      }
    } finally {
      setStepSaving(null)
    }
  }

  const handleStandardsToggle = async (checked: boolean) => {
    if (!canMutate) return
    setStepSaving('standards')
    try {
      const res = await fetch(`/api/audits/${auditId}/preparation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ standardsReviewed: checked }),
      })
      if (res.ok) {
        const data = (await res.json()) as AuditPreparationPayload
        setPrep(data)
      }
    } finally {
      setStepSaving(null)
    }
  }

  const handleAddQuestion = async () => {
    const text = addText.trim()
    if (!text || !canMutate) return
    setAdding(true)
    try {
      const res = await fetch(`/api/audits/${auditId}/preparation/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ questionText: text }),
      })
      if (res.ok) {
        setAddOpen(false)
        setAddText('')
        await loadPreparation()
      }
    } finally {
      setAdding(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingId || !canMutate) return
    const text = editText.trim()
    if (!text) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/audits/${auditId}/preparation/questions/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ questionText: text }),
      })
      if (res.ok) {
        setEditingId(null)
        setEditText('')
        await loadPreparation()
      }
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!canMutate) return
    setDeletingId(questionId)
    try {
      const res = await fetch(`/api/audits/${auditId}/preparation/questions/${questionId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (res.ok) {
        await loadPreparation()
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleMoveQuestion = async (index: number, direction: -1 | 1) => {
    if (!prep?.questions || !canMutate) return
    const qs = [...prep.questions].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    const j = index + direction
    if (j < 0 || j >= qs.length) return
    const a = qs[index]
    const b = qs[j]
    setMovingId(a.id)
    try {
      await Promise.all([
        fetch(`/api/audits/${auditId}/preparation/questions/${a.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ sortOrder: b.sortOrder }),
        }),
        fetch(`/api/audits/${auditId}/preparation/questions/${b.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ sortOrder: a.sortOrder }),
        }),
      ])
      await loadPreparation()
    } finally {
      setMovingId(null)
    }
  }

  const priorChecked = Boolean(prep?.preparationPriorFindingsReviewedAt)
  const standardsChecked = Boolean(prep?.preparationStandardsReviewedAt)
  const sortedQuestions = prep?.questions
    ? [...prep.questions].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
      )
    : []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Preparation checklist</CardTitle>
          <CardDescription>
            Complete these steps before or during audit planning. Checklist template and timetable are available via the buttons at the bottom.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {prepLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading preparation…
            </div>
          )}
          {prepError && <p className="text-sm text-destructive">{prepError}</p>}

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-start gap-3">
              <input
                type="checkbox"
                id="prep-prior-findings"
                checked={priorChecked}
                disabled={!canMutate || stepSaving === 'prior' || prepLoading}
                onChange={(e) => handlePriorToggle(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input"
                aria-label="I have reviewed previous findings for this department"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="prep-prior-findings" className="text-base font-medium cursor-pointer">
                  Reviewed previous findings (this department)
                </Label>
                {priorChecked && prep?.preparationPriorFindingsReviewedAt && (
                  <p className="text-xs text-muted-foreground">
                    Marked by {formatReviewer(prep.preparationPriorFindingsReviewedBy)} on{' '}
                    {formatDateTime(prep.preparationPriorFindingsReviewedAt)}
                  </p>
                )}
              </div>
            </div>
            <div className="pl-7 space-y-2">
              {findingsLoading ? (
                <p className="text-sm text-muted-foreground">Loading findings…</p>
              ) : findings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No other findings for this department (excluding this audit).
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Finding</th>
                        <th className="px-3 py-2 text-left font-medium">Audit</th>
                        <th className="px-3 py-2 text-left font-medium">Severity</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-left font-medium w-24">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {findings.slice(0, 50).map((f) => (
                        <tr key={f.id} className="border-t">
                          <td className="px-3 py-2 align-top">
                            <span className="font-medium">{f.findingNumber ?? f.id.slice(0, 8)}</span>
                            {f.description && (
                              <p className="text-muted-foreground line-clamp-2 mt-0.5">{f.description}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 align-top text-muted-foreground">
                            {f.Audit?.auditNumber ?? f.Audit?.title ?? '—'}
                          </td>
                          <td className="px-3 py-2 align-top">{f.severity ?? '—'}</td>
                          <td className="px-3 py-2 align-top">{f.status ?? '—'}</td>
                          <td className="px-3 py-2 align-top">
                            <Link
                              href={`/findings/${f.id}`}
                              className="text-primary underline inline-flex items-center gap-1"
                              aria-label={`Open finding ${f.findingNumber ?? f.id}`}
                            >
                              Open <ExternalLink className="h-3 w-3" aria-hidden />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {findings.length > 50 && (
                <p className="text-xs text-muted-foreground">Showing first 50. Use Findings for full search.</p>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-start gap-3">
              <input
                type="checkbox"
                id="prep-standards"
                checked={standardsChecked}
                disabled={!canMutate || stepSaving === 'standards' || prepLoading}
                onChange={(e) => handleStandardsToggle(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input"
                aria-label="I have reviewed applicable standards and policy"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="prep-standards" className="text-base font-medium cursor-pointer">
                  Reviewed applicable standards / policy
                </Label>
                {standardsChecked && prep?.preparationStandardsReviewedAt && (
                  <p className="text-xs text-muted-foreground">
                    Marked by {formatReviewer(prep.preparationStandardsReviewedBy)} on{' '}
                    {formatDateTime(prep.preparationStandardsReviewedAt)}
                  </p>
                )}
              </div>
            </div>
            <div className="pl-7 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/quality-policy" aria-label="Open quality policy and objectives">
                  Quality policy & objectives
                  <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/documents" aria-label="Open documents library">
                  All documents
                  <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
                </Link>
              </Button>
            </div>
            {documentsLoading ? (
              <p className="pl-7 text-sm text-muted-foreground">Loading related documents…</p>
            ) : documents.length > 0 ? (
              <div className="pl-7">
                <p className="text-sm font-medium mb-2">Approved documents (filtered to this department when set)</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {documents.map((d) => (
                    <li key={d.id}>
                      <Link href={`/documents/${d.id}`} className="text-primary underline">
                        {d.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Supplemental audit questionnaire</CardTitle>
              <CardDescription>
                Extra questions for this audit only (in addition to the checklist template).
              </CardDescription>
            </div>
            {canMutate && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setAddText('')
                  setAddOpen(true)
                }}
                aria-label="Add preparation question"
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                Add question
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No supplemental questions yet.</p>
          ) : (
            <ul className="space-y-2">
              {sortedQuestions.map((q, index) => (
                <li
                  key={q.id}
                  className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    {editingId === q.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={3}
                          aria-label="Edit question text"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={savingEdit || !editText.trim()}
                          >
                            {savingEdit ? 'Saving…' : 'Save'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null)
                              setEditText('')
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{q.questionText}</p>
                    )}
                  </div>
                  {canMutate && editingId !== q.id && (
                    <div className="flex shrink-0 flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={index === 0 || movingId !== null}
                        onClick={() => handleMoveQuestion(index, -1)}
                        aria-label="Move question up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={index >= sortedQuestions.length - 1 || movingId !== null}
                        onClick={() => handleMoveQuestion(index, 1)}
                        aria-label="Move question down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingId(q.id)
                          setEditText(q.questionText)
                        }}
                        aria-label="Edit question"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        disabled={deletingId === q.id}
                        onClick={() => handleDeleteQuestion(q.id)}
                        aria-label="Delete question"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule & checklist</CardTitle>
          <CardDescription>
            Open the Checklist and Audit schedule tabs to set the template and timetable, then send the schedule and
            checklist to auditees.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onGoToChecklist}
              aria-label="Open audit checklist tab"
            >
              <ClipboardList className="mr-2 h-4 w-4" aria-hidden />
              Audit checklist
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onGoToSchedule}
              aria-label="Open audit schedule tab"
            >
              <CalendarRange className="mr-2 h-4 w-4" aria-hidden />
              Audit schedule
            </Button>
          </div>
          {checklistScheduleSentAt && (
            <p className="text-sm text-muted-foreground">
              Schedule and checklist were sent to auditees on {formatDateTime(checklistScheduleSentAt)}.
            </p>
          )}
          {showSendToAuditees && onSendScheduleAndChecklistToAuditees && (
            <div className="space-y-2 rounded-md border border-dashed p-4">
              <Button
                type="button"
                className="w-full sm:w-auto"
                variant="secondary"
                disabled={!canSendToAuditees || sendingToAuditees}
                onClick={() => void onSendScheduleAndChecklistToAuditees()}
                aria-label="Send schedule and checklist to auditees"
              >
                <Send className="mr-2 h-4 w-4" aria-hidden />
                {sendingToAuditees ? 'Sending…' : 'Send schedule and checklist to auditee'}
              </Button>
              {!canSendToAuditees && !sendingToAuditees && (
                <p className="text-sm text-muted-foreground">
                  Choose a checklist and add schedule details (use the buttons above) before sending.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add supplemental question</DialogTitle>
            <DialogDescription>Visible on this audit preparation tab only.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            placeholder="Enter the question…"
            rows={4}
            aria-label="New question text"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddQuestion} disabled={adding || !addText.trim()}>
              {adding ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
