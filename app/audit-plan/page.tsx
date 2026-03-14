'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Calendar, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { formatDateOnly } from '@/lib/utils'
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
  Department?: { id: string; name: string; code?: string } | null
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
    fetchPlans()
  }, [])

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { roles: [] }))
      .then((data) => setRoles(Array.isArray(data?.roles) ? data.roles : []))
      .catch(() => setRoles([]))
  }, [])

  useEffect(() => {
    if (addOpen || editPlan) fetchDepartments()
  }, [addOpen, editPlan])

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
      alert('Plan name is required.')
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
            departmentId: formDepartmentId.trim() || null,
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
          alert(err.error || 'Failed to update plan.')
        }
      } else {
        const res = await fetch('/api/audit-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            intervalMonths: interval,
            lastDoneDate: formLastDone.trim() || null,
            departmentId: formDepartmentId.trim() || null,
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
          alert(err.error || 'Failed to create plan.')
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
        alert(err.error || 'Failed to delete plan.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleScheduleSuccess = () => {
    setSchedulePlan(null)
    fetchPlans()
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
          <p className="text-muted-foreground">You do not have permission to view the Audit Plan. Only Quality Manager, auditors, and Accountable Manager can view this page.</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Audit Plan</h1>
            <p className="mt-2 text-muted-foreground">
              Track recurring audits by interval and last done date. Schedule an audit from a plan to link it and update last done when completed.
            </p>
          </div>
          {canManage && (
            <Button onClick={handleOpenAdd} aria-label="Add audit plan">
              <Plus className="mr-2 h-4 w-4" />
              Add plan
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recurring audit plans</CardTitle>
          </CardHeader>
          <CardContent>
            {plans.length === 0 ? (
                <p className="text-muted-foreground">No audit plans yet. Add a plan to track recurring audits and their next due dates.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Name</th>
                        <th className="p-3 text-left font-medium">Interval</th>
                        <th className="p-3 text-left font-medium">Last done</th>
                        <th className="p-3 text-left font-medium">Next due</th>
                        <th className="p-3 text-left font-medium">Scheduled date</th>
                        <th className="p-3 text-left font-medium">Status</th>
                        {canManage && <th className="p-3 text-right font-medium">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((plan) => {
                        const status = getPlanStatus(plan)
                        const scheduledDate = plan.linkedAudit?.scheduledDate
                        return (
                          <tr key={plan.id} className="border-b hover:bg-muted/30">
                            <td className="p-3 font-medium">{plan.name}</td>
                            <td className="p-3">{plan.intervalMonths} months</td>
                            <td className="p-3">{plan.lastDoneDate ? formatDateOnly(plan.lastDoneDate) : '—'}</td>
                            <td className="p-3">{plan.nextDueDate ? formatDateOnly(plan.nextDueDate) : '—'}</td>
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
          </CardContent>
        </Card>

        {/* Add / Edit plan modal */}
        <Dialog open={addOpen || !!editPlan} onOpenChange={(open) => { if (!open) { setAddOpen(false); setEditPlan(null); resetForm() } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editPlan ? 'Edit plan' : 'Add audit plan'}</DialogTitle>
              <DialogDescription>
                {editPlan ? 'Update the recurring audit plan.' : 'Define a recurring audit by name and interval. Next due is calculated from last done + interval.'}
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
                <Label htmlFor="plan-department">Department</Label>
                <Select value={formDepartmentId || 'none'} onValueChange={(v) => setFormDepartmentId(v === 'none' ? '' : v)}>
                  <SelectTrigger id="plan-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <DialogTitle>Schedule audit from plan</DialogTitle>
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
              <DialogTitle>Delete audit plan</DialogTitle>
              <DialogDescription>
                {deletePlan && `Delete "${deletePlan.name}"? Any linked audits will be unlinked from this plan; the audits themselves are not deleted.`}
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
