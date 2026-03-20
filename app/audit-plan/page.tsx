'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState, useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import { Plus, Pencil, Trash2, Calendar, Loader2, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { formatDateOnly, cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreateAuditForm } from '@/components/audits/create-audit-form'
import { canViewAuditPlan, canManageAuditPlan } from '@/lib/permissions'

type AuditPlanRow = {
  id: string
  name: string
  intervalMonths: number
  lastDoneDate: string | null
  nextDueDate: string | null
  departmentId: string | null
  base: string | null
  scope: string | null
  linkedAudit: {
    id: string
    title: string
    scheduledDate: string
    startDate: string | null
    status: string
  } | null
  Department?: { id: string; name: string; code?: string } | { id: string; name: string; code?: string }[] | null
}

const UNASSIGNED_KEY = '__unassigned__'

type ProgrammeDepartmentGroup = {
  groupKey: string
  departmentId: string | null
  title: string
  plans: AuditPlanRow[]
}

const getPlanStatus = (plan: AuditPlanRow): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
  const today = new Date().toISOString().slice(0, 10)
  if (plan.linkedAudit) {
    return { label: plan.linkedAudit.status === 'ACTIVE' ? 'Active' : 'Scheduled', variant: 'default' }
  }
  if (!plan.nextDueDate) return { label: 'Not scheduled', variant: 'secondary' }
  if (plan.nextDueDate < today) return { label: 'Overdue', variant: 'destructive' }
  const daysUntil = Math.ceil((new Date(plan.nextDueDate).getTime() - new Date(today).getTime()) / (24 * 60 * 60 * 1000))
  if (daysUntil <= 30) return { label: 'Due soon', variant: 'outline' }
  return { label: 'Upcoming', variant: 'secondary' }
}

const AuditsPlanPage = () => {
  const [plans, setPlans] = useState<AuditPlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [roles, setRoles] = useState<string[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [editPlan, setEditPlan] = useState<AuditPlanRow | null>(null)
  const [schedulePlan, setSchedulePlan] = useState<AuditPlanRow | null>(null)
  const [deletePlan, setDeletePlan] = useState<AuditPlanRow | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [departments, setDepartments] = useState<{ id: string; name: string; code?: string }[]>([])

  const [formName, setFormName] = useState('')
  const [formInterval, setFormInterval] = useState('6')
  const [formLastDone, setFormLastDone] = useState('')
  const [formDepartmentId, setFormDepartmentId] = useState('')
  const [formBase, setFormBase] = useState('')
  const [formScope, setFormScope] = useState('')

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/audit-plans', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPlans(data)
        setAccessDenied(false)
      } else if (res.status === 403) {
        setAccessDenied(true)
      }
    } catch (error) {
      console.error('Failed to fetch audit plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setDepartments(data)
      }
    } catch {
      setDepartments([])
    }
  }

  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchPlans(), fetchDepartments()])
    }
    load()
  }, [])

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { roles: [] }))
      .then((data) => setRoles(Array.isArray(data?.roles) ? data.roles : []))
      .catch(() => setRoles([]))
  }, [])

  const resetForm = () => {
    setFormName('')
    setFormInterval('6')
    setFormLastDone('')
    setFormDepartmentId('')
    setFormBase('')
    setFormScope('')
    setEditPlan(null)
  }

  const handleOpenAdd = () => {
    resetForm()
    setAddOpen(true)
  }

  const handleOpenEdit = (plan: AuditPlanRow) => {
    setFormName(plan.name)
    setFormInterval(String(plan.intervalMonths))
    setFormLastDone(plan.lastDoneDate ? plan.lastDoneDate.slice(0, 10) : '')
    setFormDepartmentId(plan.departmentId ?? '')
    setFormBase(plan.base ?? '')
    setFormScope(plan.scope ?? '')
    setEditPlan(plan)
  }

  const handleSavePlan = async () => {
    if (!formName.trim()) {
      alert('Name is required.')
      return
    }
    if (!formDepartmentId.trim()) {
      alert('Department is required. Each programme entry must belong to a department.')
      return
    }
    const interval = parseInt(formInterval, 10)
    if (Number.isNaN(interval) || interval < 1) {
      alert('Interval must be at least 1 month.')
      return
    }
    setSubmitting(true)
    try {
      if (editPlan) {
        const res = await fetch(`/api/audit-plans/${editPlan.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            intervalMonths: interval,
            lastDoneDate: formLastDone.trim() || null,
            departmentId: formDepartmentId.trim(),
            base: formBase.trim() || null,
            scope: formScope.trim() || null,
          }),
        })
        if (res.ok) {
          setEditPlan(null)
          setAddOpen(false)
          resetForm()
          fetchPlans()
        } else {
          const err = await res.json().catch(() => ({}))
          alert(err.error || 'Failed to update programme entry.')
        }
      } else {
        const res = await fetch('/api/audit-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            intervalMonths: interval,
            lastDoneDate: formLastDone.trim() || null,
            departmentId: formDepartmentId.trim(),
            base: formBase.trim() || null,
            scope: formScope.trim() || null,
          }),
        })
        if (res.ok) {
          setAddOpen(false)
          resetForm()
          fetchPlans()
        } else {
          const err = await res.json().catch(() => ({}))
          alert(err.error || 'Failed to create programme entry.')
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePlan = async () => {
    if (!deletePlan) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/audit-plans/${deletePlan.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeletePlan(null)
        fetchPlans()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to delete programme entry.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleScheduleSuccess = () => {
    setSchedulePlan(null)
    fetchPlans()
  }

  const programmeSections = useMemo((): ProgrammeDepartmentGroup[] => {
    const sortedDepts = [...departments].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
    const sections: ProgrammeDepartmentGroup[] = sortedDepts.map((d) => ({
      groupKey: d.id,
      departmentId: d.id,
      title: d.name,
      plans: plans
        .filter((p) => p.departmentId === d.id)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    }))
    const unassignedPlans = plans
      .filter((p) => !p.departmentId)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    if (unassignedPlans.length > 0) {
      sections.push({
        groupKey: UNASSIGNED_KEY,
        departmentId: null,
        title: 'Unassigned',
        plans: unassignedPlans,
      })
    }
    return sections
  }, [departments, plans])

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const prevPlanCountsRef = useRef<Record<string, number>>({})

  useEffect(() => {
    setOpenSections((prev) => {
      const next = { ...prev }
      const counts = prevPlanCountsRef.current
      for (const s of programmeSections) {
        const key = s.groupKey
        const n = s.plans.length
        const prevN = counts[key]
        if (next[key] === undefined) {
          next[key] = n > 0
        } else if (n > 0 && (prevN === undefined || prevN === 0)) {
          next[key] = true
        }
        counts[key] = n
      }
      return next
    })
  }, [programmeSections])

  const handleToggleSection = (groupKey: string) => {
    setOpenSections((prev) => {
      const section = programmeSections.find((s) => s.groupKey === groupKey)
      const defaultOpen = (section?.plans.length ?? 0) > 0
      const previous = prev[groupKey]
      const isOpenNow = previous !== undefined ? previous : defaultOpen
      return { ...prev, [groupKey]: !isOpenNow }
    })
  }

  const handleSectionHeaderKeyDown = (e: KeyboardEvent, groupKey: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggleSection(groupKey)
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

  const canManage = canManageAuditPlan(roles)

  if (!loading && accessDenied) {
    return (
      <MainLayout>
        <div className="p-8">
          <p className="text-muted-foreground">You do not have permission to view the Quality Programme. Only Quality Manager, auditors, and Accountable Manager can view this page.</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Quality Programme</h1>
            <p className="mt-2 text-muted-foreground">
              Every department is listed below; expand a row to see its audit areas. Track recurring audits by interval and last done date; schedule from a programme entry to link it and update last done when completed.
            </p>
          </div>
          {canManage && (
            <Button onClick={handleOpenAdd} aria-label="Add quality programme entry">
              <Plus className="mr-2 h-4 w-4" />
              Add entry
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recurring audits</CardTitle>
          </CardHeader>
          <CardContent>
            {programmeSections.length === 0 ? (
              <p className="text-muted-foreground">
                {departments.length === 0 && plans.length === 0
                  ? 'No departments found and no programme entries yet. Add departments in Admin, then add audit areas with Add entry.'
                  : 'No departments to display. Add departments in Admin or check your access.'}
              </p>
            ) : (
              <div className="space-y-2">
                {programmeSections.map((group) => {
                  const slug = group.groupKey.replace(/[^a-zA-Z0-9_-]/g, '-')
                  const triggerId = `qa-dept-trigger-${slug}`
                  const panelId = `qa-dept-panel-${slug}`
                  const isOpen =
                    openSections[group.groupKey] ?? group.plans.length > 0
                  return (
                    <div key={group.groupKey} className="rounded-lg border bg-card">
                      <button
                        type="button"
                        id={triggerId}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => handleToggleSection(group.groupKey)}
                        onKeyDown={(e) => handleSectionHeaderKeyDown(e, group.groupKey)}
                        className="flex w-full items-center gap-3 rounded-t-lg px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-muted/50"
                        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${group.title} audit areas`}
                      >
                        <ChevronDown
                          className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')}
                          aria-hidden
                        />
                        <span className="flex-1">{group.title}</span>
                        <span className="text-sm font-normal text-muted-foreground tabular-nums">
                          ({group.plans.length})
                        </span>
                      </button>
                      {isOpen && (
                        <div
                          id={panelId}
                          role="region"
                          aria-labelledby={triggerId}
                          className="border-t px-2 pb-3 pt-2"
                        >
                          {group.plans.length === 0 ? (
                            <p className="px-2 py-4 text-sm text-muted-foreground">
                              No audit areas in this department yet.
                              {canManage ? ' Use Add entry and choose this department.' : ''}
                            </p>
                          ) : (
                            <div className="overflow-x-auto rounded-md border">
                              <table
                                className="w-full border-collapse text-sm"
                                role="table"
                                aria-label={`Programme entries for ${group.title}`}
                              >
                                <thead>
                                  <tr className="border-b bg-muted/50">
                                    <th className="p-3 text-left font-medium">Name</th>
                                    <th className="p-3 text-left font-medium">Interval</th>
                                    <th className="p-3 text-left font-medium">Last done</th>
                                    <th className="p-3 text-left font-medium">Next due</th>
                                    <th className="p-3 text-left font-medium">Scheduled date</th>
                                    <th className="p-3 text-left font-medium">Status</th>
                                    {canManage && (
                                      <th className="p-3 text-right font-medium">Actions</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.plans.map((plan) => {
                                    const status = getPlanStatus(plan)
                                    const scheduledDate = plan.linkedAudit?.scheduledDate
                                    return (
                                      <tr
                                        key={plan.id}
                                        className="border-b last:border-0 hover:bg-muted/30"
                                      >
                                        <td className="p-3 font-medium">{plan.name}</td>
                                        <td className="p-3">{plan.intervalMonths} months</td>
                                        <td className="p-3">
                                          {plan.lastDoneDate ? formatDateOnly(plan.lastDoneDate) : '—'}
                                        </td>
                                        <td className="p-3">
                                          {plan.nextDueDate ? formatDateOnly(plan.nextDueDate) : '—'}
                                        </td>
                                        <td className="p-3">
                                          {scheduledDate ? formatDateOnly(scheduledDate) : '—'}
                                          {plan.linkedAudit && (
                                            <Link
                                              href={`/audits/${plan.linkedAudit.id}`}
                                              className="ml-1 text-primary hover:underline"
                                              aria-label={`View audit ${plan.linkedAudit.title}`}
                                            >
                                              View
                                            </Link>
                                          )}
                                        </td>
                                        <td className="p-3">
                                          <Badge variant={status.variant}>{status.label}</Badge>
                                        </td>
                                        {canManage && (
                                          <td className="p-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                              {!plan.linkedAudit && (
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => setSchedulePlan(plan)}
                                                  aria-label={`Schedule audit for ${plan.name}`}
                                                >
                                                  <Calendar className="mr-1 h-4 w-4" />
                                                  Schedule
                                                </Button>
                                              )}
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleOpenEdit(plan)}
                                                aria-label={`Edit ${plan.name}`}
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setDeletePlan(plan)}
                                                aria-label={`Delete ${plan.name}`}
                                              >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                              </Button>
                                            </div>
                                          </td>
                                        )}
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add / Edit programme entry modal */}
        <Dialog open={addOpen || !!editPlan} onOpenChange={(open) => { if (!open) { setAddOpen(false); setEditPlan(null); resetForm() } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editPlan ? 'Edit programme entry' : 'Add programme entry'}</DialogTitle>
              <DialogDescription>
                {editPlan
                  ? 'Update this recurring audit in the quality programme. Department is required.'
                  : 'Define a recurring audit by name, department, and interval. Next due is calculated from last done + interval.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Name *</Label>
                <Input
                  id="plan-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Safety Audit"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-interval">Interval (months) *</Label>
                <Input
                  id="plan-interval"
                  type="number"
                  min={1}
                  value={formInterval}
                  onChange={(e) => setFormInterval(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-last-done">Last done date</Label>
                <Input
                  id="plan-last-done"
                  type="date"
                  value={formLastDone}
                  onChange={(e) => setFormLastDone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-department">Department *</Label>
                <Select
                  value={formDepartmentId || undefined}
                  onValueChange={(v) => setFormDepartmentId(v)}
                  required
                >
                  <SelectTrigger id="plan-department" aria-required>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {departments.length === 0 && (
                  <p className="text-xs text-muted-foreground">No departments available. Add departments in Admin first.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-base">Base (default)</Label>
                <Input
                  id="plan-base"
                  value={formBase}
                  onChange={(e) => setFormBase(e.target.value)}
                  placeholder="Optional default base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-scope">Scope (default)</Label>
                <Input
                  id="plan-scope"
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value)}
                  placeholder="Optional default scope"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setAddOpen(false); setEditPlan(null); resetForm() }}>
                  Cancel
                </Button>
                <Button onClick={handleSavePlan} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editPlan ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Schedule audit dialog */}
        <Dialog open={!!schedulePlan} onOpenChange={(open) => { if (!open) setSchedulePlan(null) }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Schedule audit from programme</DialogTitle>
              <DialogDescription>
                {schedulePlan && `Create an audit for "${schedulePlan.name}". Suggested date: ${schedulePlan.nextDueDate ? formatDateOnly(schedulePlan.nextDueDate) : 'pick a date'}. You can change the date before submitting.`}
              </DialogDescription>
            </DialogHeader>
            {schedulePlan && (
              <CreateAuditForm
                onSuccess={handleScheduleSuccess}
                open={!!schedulePlan}
                auditPlanId={schedulePlan.id}
                suggestedStartDate={schedulePlan.nextDueDate ?? undefined}
                planName={schedulePlan.name}
                defaultDepartmentId={schedulePlan.departmentId}
                defaultBase={schedulePlan.base ?? undefined}
                defaultScope={schedulePlan.scope ?? undefined}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog open={!!deletePlan} onOpenChange={(open) => { if (!open) setDeletePlan(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete programme entry</DialogTitle>
              <DialogDescription>
                {deletePlan && `Delete "${deletePlan.name}"? Any linked audits will be unlinked from this programme entry; the audits themselves are not deleted.`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDeletePlan(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeletePlan} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

export default AuditsPlanPage
