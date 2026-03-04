'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, FileText, Upload, AlertCircle, Plus, Pencil, Trash2 } from 'lucide-react'
import { FileUpload, FileList } from '@/components/ui/file-upload'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getPriorityDescription } from '@/lib/audit-deadlines'

interface ChecklistItem {
  id: string
  type: 'title' | 'question'
  ref?: string
  auditQuestion?: string
  complianceCriteria?: string
  docRef?: string
  content: string
  order: number
  parentId?: string | null
}

interface ChecklistResponseFinding {
  id: string
  findingNumber: string
  checklistItemId: string
  departmentId: string
  description: string
  priority: string
  assignedToId: string
  status: string
}

interface ChecklistResponse {
  id: string
  checklistItemId: string
  isCompliant: boolean | null
  notes: string | null
  reviewedAt: string
  findings?: ChecklistResponseFinding[]
  // Supabase join can come back as Evidence or evidence; we normalize it
  Evidence?: Array<{
    id: string
    name: string
    fileUrl: string
    fileType: string
    fileSize: number
  }>
  evidence: Array<{
    id: string
    name: string
    fileUrl: string
    fileType: string
    fileSize: number
  }>
}

interface AuditExecutionProps {
  auditId: string
  checklistItems: ChecklistItem[]
  responses: ChecklistResponse[]
  onResponseUpdate: () => void
  activeTab?: string
  departments: Array<{ id: string; name: string }>
  users: Array<{ id: string; firstName: string; lastName: string; email: string }>
}

export const AuditExecution = ({
  auditId,
  checklistItems,
  responses,
  onResponseUpdate,
  activeTab,
  departments,
  users,
}: AuditExecutionProps) => {
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [collapsedItemIds, setCollapsedItemIds] = useState<string[]>([])
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({})
  const [responseMap, setResponseMap] = useState<Map<string, ChecklistResponse>>(new Map())
  const [evidenceFeedback, setEvidenceFeedback] = useState<{
    itemId: string
    status: 'success' | 'error'
    message: string
  } | null>(null)
  const prevTabRef = useRef<string | undefined>(undefined)
  const [editingFindingIds, setEditingFindingIds] = useState<Record<string, string | null>>({})
  const [pendingCompliance, setPendingCompliance] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (activeTab === 'execution' && prevTabRef.current !== 'execution') {
      const questionIds = checklistItems
        .filter((item) => item.type === 'question')
        .map((item) => item.id)
      setCollapsedItemIds(questionIds)
    }
    prevTabRef.current = activeTab
  }, [activeTab, checklistItems])

  useEffect(() => {
    const map = new Map<string, ChecklistResponse>()
    responses.forEach((response: any) => {
      const normalizedEvidence =
        response.evidence ??
        response.Evidence ??
        []

      const normalized: ChecklistResponse = {
        ...response,
        evidence: normalizedEvidence,
        findings: response.findings ?? [],
      }

      map.set(normalized.checklistItemId, normalized)
    })
    setResponseMap(map)
  }, [responses])

  useEffect(() => {
    if (!evidenceFeedback) return
    const timer = setTimeout(() => setEvidenceFeedback(null), 4000)
    return () => clearTimeout(timer)
  }, [evidenceFeedback])

  const handleComplianceSelect = (itemId: string, isCompliant: boolean) => {
    setPendingCompliance((prev) => ({ ...prev, [itemId]: isCompliant }))
    setCollapsedItemIds((prev) => prev.filter((id) => id !== itemId))
  }

  const ensureChecklistResponseExists = async (
    itemId: string,
    isCompliant: boolean
  ): Promise<boolean> => {
    try {
      const response = responseMap.get(itemId)
      const res = await fetch(`/api/audits/${auditId}/checklist/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklistItemId: itemId,
          isCompliant,
          notes: response?.notes ?? null,
        }),
      })
      if (res.ok) {
        onResponseUpdate()
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to ensure checklist response:', error)
      return false
    }
  }

  const handleSaveCompliantEntry = async (itemId: string) => {
    const response = responseMap.get(itemId)
    const notesToSave = draftNotes[itemId] ?? response?.notes ?? ''
    if (!notesToSave || notesToSave.trim().length === 0) {
      alert('Objective Evidence & Notes is required.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/audits/${auditId}/checklist/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklistItemId: itemId,
          isCompliant: true,
          notes: notesToSave,
        }),
      })
      if (res.ok) {
        setDraftNotes((prev) => {
          const next = { ...prev }
          delete next[itemId]
          return next
        })
        onResponseUpdate()
        setCollapsedItemIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]))
      } else {
        alert('Failed to save entry')
      }
    } catch (error) {
      console.error('Failed to save entry:', error)
      alert('Failed to save entry')
    } finally {
      setSaving(false)
    }
  }

  const handleExpandItem = (itemId: string) => {
    setCollapsedItemIds((prev) => prev.filter((id) => id !== itemId))
  }

  const handleEvidenceUpload = async (itemId: string, file: { fileName: string; fileUrl: string; fileType: string; fileSize: number }) => {
    try {
      // First ensure we have a response for this item
      let response = responseMap.get(itemId)
      if (!response) {
        const createRes = await fetch(`/api/audits/${auditId}/checklist/responses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checklistItemId: itemId,
            isCompliant: null,
            notes: null,
          }),
        })
        if (!createRes.ok) {
          setEvidenceFeedback({ itemId, status: 'error', message: 'Please mark compliance status first.' })
          return
        }
        const newResponse = await createRes.json()
        response = newResponse
        responseMap.set(itemId, newResponse)
      }

      const res = await fetch(`/api/audits/${auditId}/checklist/responses/${response.id}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.fileName,
          fileUrl: file.fileUrl,
          fileType: file.fileType,
          fileSize: file.fileSize,
        }),
      })

      if (res.ok) {
        onResponseUpdate()
        setEvidenceFeedback({ itemId, status: 'success', message: 'Evidence uploaded successfully.' })
      } else {
        const errData = await res.json().catch(() => ({}))
        setEvidenceFeedback({
          itemId,
          status: 'error',
          message: errData.error || 'Failed to upload evidence.',
        })
      }
    } catch (error) {
      console.error('Failed to upload evidence:', error)
      setEvidenceFeedback({ itemId, status: 'error', message: 'Failed to upload evidence.' })
    }
  }

  const handleEvidenceDelete = async (responseId: string, evidenceId: string) => {
    try {
      const res = await fetch(
        `/api/audits/${auditId}/checklist/responses/${responseId}/evidence?evidenceId=${evidenceId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        onResponseUpdate()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to delete evidence')
      }
    } catch (error) {
      console.error('Failed to delete evidence:', error)
      alert('Failed to delete evidence')
    }
  }

  const handleDeleteFinding = async (findingId: string, findingNumber: string) => {
    if (!confirm(`Delete finding ${findingNumber}? This cannot be undone.`)) {
      return
    }
    try {
      const res = await fetch(`/api/findings/${findingId}`, { method: 'DELETE' })
      if (res.ok) {
        onResponseUpdate()
        setEditingFindingIds((prev) => {
          const next = { ...prev }
          Object.keys(next).forEach((itemId) => {
            if (next[itemId] === findingId) delete next[itemId]
          })
          return next
        })
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to delete finding')
      }
    } catch (error) {
      console.error('Failed to delete finding:', error)
      alert('Failed to delete finding')
    }
  }

  const handleDeleteCompliantEntry = async (itemId: string, responseId: string) => {
    if (!confirm('Delete this compliant entry? Notes and evidence will be removed. This cannot be undone.')) {
      return
    }
    try {
      const res = await fetch(
        `/api/audits/${auditId}/checklist/responses/${responseId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        setPendingCompliance((prev) => {
          const next = { ...prev }
          delete next[itemId]
          return next
        })
        setCollapsedItemIds((prev) => prev.filter((id) => id !== itemId))
        setDraftNotes((prev) => {
          const next = { ...prev }
          delete next[itemId]
          return next
        })
        onResponseUpdate()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to delete entry')
      }
    } catch (error) {
      console.error('Failed to delete compliant entry:', error)
      alert('Failed to delete entry')
    }
  }

  const getResponseForItem = (itemId: string): ChecklistResponse | undefined => {
    return responseMap.get(itemId)
  }

  const questions = checklistItems.filter((item) => item.type === 'question')
  const reviewedCount = questions.filter((item) => {
    const response = getResponseForItem(item.id)
    return response?.isCompliant !== null && response?.isCompliant !== undefined
  }).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Audit Execution</CardTitle>
            <Badge variant="outline">
              {reviewedCount} / {questions.length} items reviewed
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {checklistItems.map((item) => {
          if (item.type === 'title') {
            return (
              <Card key={item.id} className="bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-lg">{item.content}</CardTitle>
                </CardHeader>
              </Card>
            )
          }

          const response = getResponseForItem(item.id)
          const effectiveCompliant =
            response?.isCompliant !== undefined && response?.isCompliant !== null
              ? response.isCompliant
              : pendingCompliance[item.id]
          const isCompliant = effectiveCompliant === true
          const isNonCompliant = effectiveCompliant === false
          const findings = response?.findings ?? []
          const findingsCount = findings.length
          const editingKey = editingFindingIds[item.id] ?? null
          const hasActiveFindingForm = Object.prototype.hasOwnProperty.call(
            editingFindingIds,
            item.id
          )
          const editingFinding =
            editingKey && editingKey !== 'NEW'
              ? findings.find((f) => f.id === editingKey) ?? null
              : null

          return (
            <Card
              key={item.id}
              className={cn(
                'transition-all',
                activeItemId === item.id && 'ring-2 ring-primary',
                isCompliant === true && 'border-green-200 bg-green-50/50',
                isNonCompliant && 'border-red-200 bg-red-50/50'
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {item.ref && (
                        <Badge variant="outline">{item.ref}</Badge>
                      )}
                      <h3 className="font-semibold">{item.auditQuestion || 'Question'}</h3>
                    </div>
                    {item.complianceCriteria && (
                      <p className="text-sm text-muted-foreground">
                        {item.complianceCriteria}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isCompliant === true && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                    {isNonCompliant && (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant={isCompliant ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleComplianceSelect(item.id, true)}
                    disabled={saving || response?.isCompliant === false}
                    className={cn(
                      response?.isCompliant === false && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Compliant
                  </Button>
                  <Button
                    variant={isNonCompliant ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => handleComplianceSelect(item.id, false)}
                    disabled={saving || response?.isCompliant === true}
                    className={cn(
                      response?.isCompliant === true && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Non-Compliant
                  </Button>
                </div>

                {isCompliant && (
                  <>
                    {collapsedItemIds.includes(item.id) && response?.isCompliant === true ? (
                      <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50/50 px-3 py-2">
                        <span className="text-sm text-green-800">Entry saved</span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExpandItem(item.id)}
                            aria-label="Edit entry"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCompliantEntry(item.id, response.id)}
                            aria-label="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`notes-${item.id}`}>Objective Evidence &amp; Notes *</Label>
                          <Textarea
                            id={`notes-${item.id}`}
                            value={item.id in draftNotes ? draftNotes[item.id] : (response?.notes ?? '')}
                            onChange={(e) =>
                              setDraftNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            placeholder="Document objective evidence observed, observations, and any relevant notes..."
                            rows={3}
                            onFocus={() => setActiveItemId(item.id)}
                            onBlur={() => setActiveItemId(null)}
                            disabled={saving}
                            readOnly={saving}
                            className={cn(saving && 'cursor-not-allowed opacity-70')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Evidence</Label>
                          <div className={cn('flex items-center gap-2', saving && 'pointer-events-none opacity-70')}>
                            <FileUpload
                              entityType="audit"
                              entityId={auditId}
                              onUploadComplete={(file) => handleEvidenceUpload(item.id, file)}
                              onUploadError={(error) => alert(error)}
                              disabled={saving}
                            />
                          </div>
                          {response?.evidence && response.evidence.length > 0 && (
                            <FileList
                              files={response.evidence.map((ev) => ({
                                id: ev.id,
                                fileUrl: ev.fileUrl,
                                fileName: ev.name,
                                fileSize: ev.fileSize,
                                fileType: ev.fileType,
                              }))}
                              showDownload={true}
                              showUrl={false}
                              onDeleteEvidence={(evidenceId) =>
                                handleEvidenceDelete(response.id, evidenceId)
                              }
                            />
                          )}
                        </div>
                        <div className="flex justify-end gap-2">
                          {response && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleDeleteCompliantEntry(item.id, response.id)}
                              disabled={saving}
                              aria-label="Delete"
                              className="mr-auto text-destructive hover:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setCollapsedItemIds((prev) =>
                                prev.includes(item.id) ? prev : [...prev, item.id]
                              )
                            }
                            disabled={saving}
                            aria-label="Close"
                          >
                            Close
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleSaveCompliantEntry(item.id)}
                            disabled={saving}
                            aria-label="Save entry"
                          >
                            {saving ? 'Saving...' : 'Save entry'}
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}

                {isNonCompliant && (
                  collapsedItemIds.includes(item.id) && response ? (
                    <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50/30 px-3 py-2">
                      <span className="text-sm text-red-800">
                        {findingsCount === 0
                          ? 'No findings yet — add one to record the non-compliance'
                          : findingsCount === 1
                            ? '1 finding created'
                            : `${findingsCount} findings created`}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExpandItem(item.id)}
                        aria-label={findingsCount === 0 ? 'Add finding' : 'View or edit findings'}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        {findingsCount === 0 ? 'Add Finding' : 'View / Edit'}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() =>
                            setEditingFindingIds((prev) => ({ ...prev, [item.id]: 'NEW' }))
                          }
                          aria-label="Add finding"
                          className="shrink-0"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {findingsCount > 0 ? 'Add another finding' : 'Add Finding'}
                        </Button>
                      </div>
                      {findingsCount > 0 && (
                        <div className="mb-3 space-y-1">
                          <p className="text-sm font-medium text-red-800">
                            Findings for this checklist item
                          </p>
                          <div className="space-y-1">
                            {findings.map((finding) => (
                              <div
                                key={finding.id}
                                className="flex items-center justify-between rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs"
                              >
                                <div className="flex flex-col">
                                  <span className="font-semibold">
                                    {finding.findingNumber}{' '}
                                    <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800">
                                      {finding.priority}
                                    </span>
                                  </span>
                                  <span className="text-[11px] text-red-900">
                                    {finding.description}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-[10px]">
                                    {finding.status}
                                  </Badge>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost"
                                    onClick={() =>
                                      setEditingFindingIds((prev) => ({
                                        ...prev,
                                        [item.id]: finding.id,
                                      }))
                                    }
                                    aria-label={`Edit ${finding.findingNumber}`}
                                  >
                                    <Pencil className="mr-1 h-3 w-3" />
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => handleDeleteFinding(finding.id, finding.findingNumber)}
                                    aria-label={`Delete ${finding.findingNumber}`}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="mr-1 h-3 w-3" />
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {hasActiveFindingForm && (
                        <NonCompliantForm
                          auditId={auditId}
                          checklistItem={item}
                          response={response ?? null}
                          ensureResponseExists={() =>
                            ensureChecklistResponseExists(item.id, false)
                          }
                          finding={editingFinding}
                          departments={departments}
                          users={users}
                          onFindingCreated={onResponseUpdate}
                          onFindingCreatedSuccess={() => {
                            setCollapsedItemIds((prev) =>
                              prev.includes(item.id) ? prev : [...prev, item.id]
                            )
                            setEditingFindingIds((prev) => {
                              const next = { ...prev }
                              delete next[item.id]
                              return next
                            })
                          }}
                          onClose={() => {
                            setCollapsedItemIds((prev) =>
                              prev.includes(item.id) ? prev : [...prev, item.id]
                            )
                            setEditingFindingIds((prev) => {
                              const next = { ...prev }
                              delete next[item.id]
                              return next
                            })
                          }}
                          onEvidenceUpload={(file) => handleEvidenceUpload(item.id, file)}
                          onEvidenceDelete={
                            response
                              ? (evidenceId) => handleEvidenceDelete(response.id, evidenceId)
                              : () => {}
                          }
                        />
                      )}
                    </>
                  )
                )}

                {evidenceFeedback?.itemId === item.id && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={cn(
                      'mt-3 rounded-md border px-3 py-2 text-sm',
                      evidenceFeedback.status === 'success' &&
                        'border-green-200 bg-green-50 text-green-800',
                      evidenceFeedback.status === 'error' &&
                        'border-red-200 bg-red-50 text-red-800'
                    )}
                  >
                    {evidenceFeedback.status === 'success' && (
                      <CheckCircle2 className="mr-2 inline-block h-4 w-4 shrink-0 align-middle" />
                    )}
                    {evidenceFeedback.status === 'error' && (
                      <AlertCircle className="mr-2 inline-block h-4 w-4 shrink-0 align-middle" />
                    )}
                    {evidenceFeedback.message}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

interface NonCompliantFormProps {
  auditId: string
  checklistItem: ChecklistItem
  response: ChecklistResponse | null
  ensureResponseExists: () => Promise<boolean>
  finding: ChecklistResponseFinding | null
  departments: Array<{ id: string; name: string }>
  users: Array<{ id: string; firstName: string; lastName: string; email: string }>
  onFindingCreated: () => void
  onFindingCreatedSuccess?: () => void
  onClose?: () => void
  onEvidenceUpload: (file: { fileName: string; fileUrl: string; fileType: string; fileSize: number }) => void
  onEvidenceDelete: (evidenceId: string) => void
}

const NonCompliantForm = ({
  auditId,
  checklistItem,
  response,
  ensureResponseExists,
  finding,
  departments,
  users,
  onFindingCreated,
  onFindingCreatedSuccess,
  onClose,
  onEvidenceUpload,
  onEvidenceDelete,
}: NonCompliantFormProps) => {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(() => ({
    departmentId: finding?.departmentId ?? '',
    description: finding?.description ?? checklistItem.auditQuestion ?? '',
    priority: (finding?.priority as 'P1' | 'P2' | 'P3') ?? 'P2',
    assignedToId: finding?.assignedToId ?? '',
  }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.departmentId || !formData.description || !formData.assignedToId) {
      alert('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const isEdit = !!finding
      if (!isEdit && !response) {
        const ok = await ensureResponseExists()
        if (!ok) {
          alert('Failed to create checklist response. Please try again.')
          setSaving(false)
          return
        }
      }

      const url = isEdit
        ? `/api/findings/${finding.id}`
        : `/api/audits/${auditId}/checklist/create-finding`

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? {
                departmentId: formData.departmentId,
                description: formData.description,
                priority: formData.priority,
                assignedToId: formData.assignedToId,
              }
            : {
                checklistItemId: checklistItem.id,
                ...formData,
                rootCause: null,
                actionPlan: null,
              }
        ),
      })

      if (res.ok) {
        if (!isEdit) {
          setFormData({
            departmentId: '',
            description: checklistItem.auditQuestion || '',
            priority: 'P2',
            assignedToId: '',
          })
        }
        onFindingCreated()
        onFindingCreatedSuccess?.()
      } else {
        const error = await res.json()
        alert(error.error || (isEdit ? 'Failed to update finding' : 'Failed to create finding'))
      }
    } catch (error) {
      console.error('Failed to submit finding:', error)
      alert('Failed to submit finding')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/30 p-4 space-y-4">
      <div className="flex items-center gap-2 text-red-800 font-medium">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>{finding ? 'Edit Finding & Add Evidence' : 'Create Finding & Add Evidence'}</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="department">Department *</Label>
          <Select
            value={formData.departmentId}
            onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
            disabled={saving}
          >
            <SelectTrigger id="department" disabled={saving} className={cn(saving && 'cursor-not-allowed opacity-70')}>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the non-compliance..."
            rows={4}
            required
            disabled={saving}
            readOnly={saving}
            className={cn(saving && 'cursor-not-allowed opacity-70')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority *</Label>
          <Select
            value={formData.priority}
            onValueChange={(value) => setFormData({ ...formData, priority: value as 'P1' | 'P2' | 'P3' })}
            disabled={saving}
          >
            <SelectTrigger id="priority" disabled={saving} className={cn(saving && 'cursor-not-allowed opacity-70')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="P1">P1 - Critical (24h CAP, 7d Close Out)</SelectItem>
              <SelectItem value="P2">P2 - Major (2w CAP, 60d Close Out)</SelectItem>
              <SelectItem value="P3">P3 - Observation (4w CAP, 90d Close Out)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {getPriorityDescription(formData.priority)}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assignedTo">Assign To *</Label>
          <Select
            value={formData.assignedToId}
            onValueChange={(value) => setFormData({ ...formData, assignedToId: value })}
            disabled={saving}
          >
            <SelectTrigger id="assignedTo" disabled={saving} className={cn(saving && 'cursor-not-allowed opacity-70')}>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={cn('space-y-2', saving && 'pointer-events-none opacity-70')}>
          <Label>Evidence</Label>
          <p className="text-xs text-muted-foreground">
            Attach supporting documents for this non-compliance finding.
          </p>
          <div className="flex items-center gap-2">
            <FileUpload
              entityType="audit"
              entityId={auditId}
              onUploadComplete={onEvidenceUpload}
              onUploadError={(error) => alert(error)}
              disabled={saving}
            />
          </div>
          {response?.evidence && response.evidence.length > 0 && (
            <FileList
              files={response.evidence.map((ev) => ({
                id: ev.id,
                fileUrl: ev.fileUrl,
                fileName: ev.name,
                fileSize: ev.fileSize,
                fileType: ev.fileType,
              }))}
              showDownload={true}
              showUrl={false}
              onDeleteEvidence={onEvidenceDelete}
            />
          )}
        </div>

        <div className="flex justify-end gap-2">
          {onClose && (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              aria-label="Close form"
            >
              Close
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving
              ? (finding ? 'Saving...' : 'Creating...')
              : (finding ? 'Edit Finding' : 'Create Finding')}
          </Button>
        </div>
      </form>
    </div>
  )
}
