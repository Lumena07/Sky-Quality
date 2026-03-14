'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { Target, Pencil, Plus, Trash2, FileText, ExternalLink, Loader2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { canManageQualityPolicy } from '@/lib/permissions'
import { formatDate } from '@/lib/utils'

type Policy = {
  id: string
  policyPdfUrl: string | null
  policyText: string | null
  updatedAt: string
  updatedById: string
} | null

type Objective = {
  id: string
  year: number
  objectivesPdfUrl: string | null
  objectivesText: string | null
  updatedAt: string
  updatedById: string
}

const QualityPolicyPage = () => {
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<string[]>([])
  const [policy, setPolicy] = useState<Policy>(null)
  const [objectives, setObjectives] = useState<Objective[]>([])

  const [policyEditOpen, setPolicyEditOpen] = useState(false)
  const [policyPdfFile, setPolicyPdfFile] = useState<File | null>(null)
  const [policyTextEdit, setPolicyTextEdit] = useState('')
  const [policySaving, setPolicySaving] = useState(false)

  const [objectivesAddOpen, setObjectivesAddOpen] = useState(false)
  const [objectivesEditItem, setObjectivesEditItem] = useState<Objective | null>(null)
  const [objectivesYear, setObjectivesYear] = useState('')
  const [objectivesPdfFile, setObjectivesPdfFile] = useState<File | null>(null)
  const [objectivesTextEdit, setObjectivesTextEdit] = useState('')
  const [objectivesSaving, setObjectivesSaving] = useState(false)

  const [deleteObjective, setDeleteObjective] = useState<Objective | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  const canManage = canManageQualityPolicy(roles)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [meRes, dataRes] = await Promise.all([
        fetch('/api/me', { credentials: 'include' }),
        fetch('/api/quality-policy', { credentials: 'include' }),
      ])
      if (meRes.ok) {
        const me = await meRes.json()
        setRoles(Array.isArray(me.roles) ? me.roles : [])
      }
      if (dataRes.ok) {
        const data = await dataRes.json()
        setPolicy(data.policy ?? null)
        setObjectives(Array.isArray(data.objectives) ? data.objectives : [])
      }
    } catch (error) {
      console.error('Failed to fetch quality policy data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleOpenPolicyEdit = () => {
    setPolicyTextEdit(policy?.policyText ?? '')
    setPolicyPdfFile(null)
    setPolicyEditOpen(true)
  }

  const handleSavePolicy = async () => {
    setPolicySaving(true)
    try {
      let policyPdfUrl: string | null = policy?.policyPdfUrl ?? null
      if (policyPdfFile) {
        const formData = new FormData()
        formData.append('file', policyPdfFile)
        formData.append('entityType', 'quality-policy')
        formData.append('entityId', policy?.id ?? 'current')
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
        const up = await uploadRes.json()
        policyPdfUrl = up.fileUrl ?? null
      }
      const res = await fetch('/api/quality-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyPdfUrl,
          policyText: policyTextEdit.trim() || null,
        }),
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err?.error ?? 'Failed to update quality policy')
        return
      }
      setPolicyEditOpen(false)
      fetchData()
    } catch (e) {
      console.error(e)
      alert('Failed to save quality policy')
    } finally {
      setPolicySaving(false)
    }
  }

  const handleOpenAddObjectives = () => {
    setObjectivesYear(new Date().getFullYear().toString())
    setObjectivesTextEdit('')
    setObjectivesPdfFile(null)
    setObjectivesEditItem(null)
    setObjectivesAddOpen(true)
  }

  const handleOpenEditObjectives = (item: Objective) => {
    setObjectivesYear(item.year.toString())
    setObjectivesTextEdit(item.objectivesText ?? '')
    setObjectivesPdfFile(null)
    setObjectivesEditItem(item)
    setObjectivesAddOpen(true)
  }

  const handleSaveObjectives = async () => {
    const year = parseInt(objectivesYear, 10)
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      alert('Please enter a valid year (2000–2100).')
      return
    }
    setObjectivesSaving(true)
    try {
      let objectivesPdfUrl: string | null = objectivesEditItem?.objectivesPdfUrl ?? null
      if (objectivesPdfFile) {
        const formData = new FormData()
        formData.append('file', objectivesPdfFile)
        formData.append('entityType', 'quality-policy-objectives')
        formData.append('entityId', objectivesEditItem?.id ?? year.toString())
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
        const up = await uploadRes.json()
        objectivesPdfUrl = up.fileUrl ?? null
      }
      const res = await fetch('/api/quality-policy/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          objectivesPdfUrl,
          objectivesText: objectivesTextEdit.trim() || null,
        }),
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err?.error ?? 'Failed to save quality objectives')
        return
      }
      setObjectivesAddOpen(false)
      setObjectivesEditItem(null)
      fetchData()
    } catch (e) {
      console.error(e)
      alert('Failed to save quality objectives')
    } finally {
      setObjectivesSaving(false)
    }
  }

  const handleDeleteObjective = async () => {
    if (!deleteObjective) return
    setDeletePending(true)
    try {
      const res = await fetch(
        `/api/quality-policy/objectives?id=${encodeURIComponent(deleteObjective.id)}`,
        { method: 'DELETE', credentials: 'include' }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err?.error ?? 'Failed to delete')
        return
      }
      setDeleteObjective(null)
      fetchData()
    } catch (e) {
      console.error(e)
      alert('Failed to delete')
    } finally {
      setDeletePending(false)
    }
  }

  const openPdfUrl = (url: string) => {
    const full = url.startsWith('http') ? url : `${window.location.origin}${url}`
    window.open(full, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-8 animate-pulse">
          <div className="mb-8 h-10 w-64 rounded bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Quality Policy and Objectives</h1>
          <p className="mt-2 text-muted-foreground">
            View the organization&apos;s quality policy and annual quality objectives.
          </p>
        </div>

        <Tabs defaultValue="policy" className="space-y-4">
          <TabsList>
            <TabsTrigger value="policy">
              <FileText className="mr-2 h-4 w-4" />
              Quality Policy
            </TabsTrigger>
            <TabsTrigger value="objectives">
              <Target className="mr-2 h-4 w-4" />
              Quality Objectives
            </TabsTrigger>
          </TabsList>

          <TabsContent value="policy" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Quality Policy</CardTitle>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenPolicyEdit}
                    aria-label="Edit quality policy"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {!policy?.policyPdfUrl && !policy?.policyText && (
                  <p className="text-muted-foreground">
                    No quality policy has been added yet.
                    {canManage && ' Use Edit to upload a PDF or enter the policy text.'}
                  </p>
                )}
                {policy?.policyPdfUrl && (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPdfUrl(policy.policyPdfUrl!)}
                      aria-label="Open quality policy PDF"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View PDF
                    </Button>
                  </div>
                )}
                {policy?.policyText && (
                  <div className="rounded-md border bg-muted/30 p-4">
                    <p className="whitespace-pre-wrap text-sm">{policy.policyText}</p>
                  </div>
                )}
                {policy?.updatedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last updated: {formatDate(policy.updatedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="objectives" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Quality Objectives by Year</CardTitle>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenAddObjectives}
                    aria-label="Add quality objectives"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add objectives
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {objectives.length === 0 ? (
                  <p className="text-muted-foreground">
                    No quality objectives have been added yet.
                    {canManage && ' Use Add objectives to add objectives for a year.'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {objectives.map((obj) => (
                      <div
                        key={obj.id}
                        className="flex flex-col gap-2 rounded-lg border p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">Year {obj.year}</span>
                          {canManage && (
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditObjectives(obj)}
                                aria-label={`Edit objectives for ${obj.year}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteObjective(obj)}
                                aria-label={`Delete objectives for ${obj.year}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {obj.objectivesPdfUrl && (
                          <Button
                            variant="link"
                            className="h-auto p-0 text-primary"
                            onClick={() => openPdfUrl(obj.objectivesPdfUrl!)}
                            aria-label={`View objectives PDF for ${obj.year}`}
                          >
                            <ExternalLink className="mr-1 h-3 w-3" />
                            View PDF
                          </Button>
                        )}
                        {obj.objectivesText && (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {obj.objectivesText}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Last updated: {formatDate(obj.updatedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit policy dialog */}
        <Dialog open={policyEditOpen} onOpenChange={setPolicyEditOpen}>
          <DialogContent className="sm:max-w-lg" aria-describedby="policy-edit-desc">
            <DialogHeader>
              <DialogTitle>Edit Quality Policy</DialogTitle>
              <DialogDescription id="policy-edit-desc">
                Upload a PDF and/or enter the policy text below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="policy-pdf">Policy PDF (optional)</Label>
                <Input
                  id="policy-pdf"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setPolicyPdfFile(e.target.files?.[0] ?? null)}
                  aria-label="Choose policy PDF file"
                />
                {policy?.policyPdfUrl && !policyPdfFile && (
                  <p className="text-xs text-muted-foreground">
                    Current PDF is set. Choose a new file to replace it.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="policy-text">Policy text (optional)</Label>
                <Textarea
                  id="policy-text"
                  value={policyTextEdit}
                  onChange={(e) => setPolicyTextEdit(e.target.value)}
                  rows={8}
                  placeholder="Enter or paste the quality policy text..."
                  className="resize-y"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPolicyEditOpen(false)}
                disabled={policySaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSavePolicy} disabled={policySaving}>
                {policySaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add/Edit objectives dialog */}
        <Dialog open={objectivesAddOpen} onOpenChange={setObjectivesAddOpen}>
          <DialogContent className="sm:max-w-lg" aria-describedby="objectives-edit-desc">
            <DialogHeader>
              <DialogTitle>
                {objectivesEditItem ? 'Edit' : 'Add'} Quality Objectives
              </DialogTitle>
              <DialogDescription id="objectives-edit-desc">
                Enter the year and optionally upload a PDF or enter the objectives text.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="objectives-year">Year</Label>
                <Input
                  id="objectives-year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={objectivesYear}
                  onChange={(e) => setObjectivesYear(e.target.value)}
                  disabled={!!objectivesEditItem}
                  aria-label="Objectives year"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objectives-pdf">Objectives PDF (optional)</Label>
                <Input
                  id="objectives-pdf"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setObjectivesPdfFile(e.target.files?.[0] ?? null)}
                  aria-label="Choose objectives PDF file"
                />
                {objectivesEditItem?.objectivesPdfUrl && !objectivesPdfFile && (
                  <p className="text-xs text-muted-foreground">
                    Current PDF is set. Choose a new file to replace it.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="objectives-text">Objectives text (optional)</Label>
                <Textarea
                  id="objectives-text"
                  value={objectivesTextEdit}
                  onChange={(e) => setObjectivesTextEdit(e.target.value)}
                  rows={6}
                  placeholder="Enter or paste the quality objectives for this year..."
                  className="resize-y"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setObjectivesAddOpen(false)
                  setObjectivesEditItem(null)
                }}
                disabled={objectivesSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveObjectives} disabled={objectivesSaving}>
                {objectivesSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete objectives confirmation */}
        <Dialog open={!!deleteObjective} onOpenChange={(open) => !open && setDeleteObjective(null)}>
          <DialogContent aria-describedby="delete-objectives-desc">
            <DialogHeader>
              <DialogTitle>Delete Quality Objectives</DialogTitle>
              <DialogDescription id="delete-objectives-desc">
                Are you sure you want to delete the quality objectives for year{' '}
                {deleteObjective?.year}? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteObjective(null)}
                disabled={deletePending}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteObjective} disabled={deletePending}>
                {deletePending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

export default QualityPolicyPage
