'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Pencil, Plus, Contact } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DEPARTMENT_CATALOG_ROLE_OPTIONS } from '@/lib/department-role-catalog'
type DepartmentOption = { id: string; name: string; code: string; isActive?: boolean }

type DeptRel = { id?: string; name?: string; code?: string; isActive?: boolean }

export type DepartmentRoleCatalogRow = {
  id: string
  departmentId: string
  name: string
  roleCode?: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  Department?: DeptRel | DeptRel[]
}

const getDeptLabel = (row: DepartmentRoleCatalogRow): string => {
  const d = row.Department
  if (!d) return '—'
  const x = Array.isArray(d) ? d[0] : d
  return x?.name ?? '—'
}

export const DepartmentRoleCatalogContent = () => {
  const [rows, setRows] = useState<DepartmentRoleCatalogRow[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>('all')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<DepartmentRoleCatalogRow | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [addForm, setAddForm] = useState({
    departmentId: '',
    name: '',
    roleCode: 'STAFF',
    description: '',
    isActive: true,
  })
  const [editForm, setEditForm] = useState({
    departmentId: '',
    name: '',
    roleCode: 'STAFF',
    description: '',
    isActive: true,
  })

  const activeDepartments = useMemo(
    () => departments.filter((d) => d.isActive !== false),
    [departments]
  )

  const loadDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/departments?includeInactive=true', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setDepartments(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadRoles = useCallback(async () => {
    setLoading(true)
    try {
      const q =
        filterDepartmentId !== 'all'
          ? `?departmentId=${encodeURIComponent(filterDepartmentId)}`
          : ''
      const res = await fetch(`/api/admin/department-roles${q}`, { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setRows(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filterDepartmentId])

  useEffect(() => {
    loadDepartments()
  }, [loadDepartments])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  const filteredRows = useMemo(
    () => (includeInactive ? rows : rows.filter((r) => r.isActive)),
    [rows, includeInactive]
  )

  const handleOpenAdd = () => {
    setAddForm({
      departmentId: activeDepartments[0]?.id ?? '',
      name: '',
      roleCode: 'STAFF',
      description: '',
      isActive: true,
    })
    setAddOpen(true)
  }

  const handleOpenEdit = (row: DepartmentRoleCatalogRow) => {
    const code = row.roleCode?.trim() || 'STAFF'
    const validCode = DEPARTMENT_CATALOG_ROLE_OPTIONS.some((o) => o.value === code) ? code : 'STAFF'
    setEditing(row)
    setEditForm({
      departmentId: row.departmentId,
      name: row.name,
      roleCode: validCode,
      description: row.description ?? '',
      isActive: row.isActive,
    })
    setEditOpen(true)
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.departmentId.trim() || !addForm.name.trim() || !addForm.roleCode.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/department-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          departmentId: addForm.departmentId.trim(),
          name: addForm.name.trim(),
          roleCode: addForm.roleCode.trim(),
          description: addForm.description.trim() || null,
          isActive: addForm.isActive,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert((err as { error?: string }).error ?? 'Failed to add')
        return
      }
      setAddOpen(false)
      await loadRoles()
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || !editForm.departmentId.trim() || !editForm.name.trim() || !editForm.roleCode.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/department-roles/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          departmentId: editForm.departmentId.trim(),
          name: editForm.name.trim(),
          roleCode: editForm.roleCode.trim(),
          description: editForm.description.trim() || null,
          isActive: editForm.isActive,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert((err as { error?: string }).error ?? 'Failed to save')
        return
      }
      setEditOpen(false)
      setEditing(null)
      await loadRoles()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (row: DepartmentRoleCatalogRow) => {
    if (!confirm(`Deactivate “${row.name}” for ${getDeptLabel(row)}?`)) return
    const res = await fetch(`/api/admin/department-roles/${row.id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert((err as { error?: string }).error ?? 'Failed to deactivate')
      return
    }
    await loadRoles()
  }

  const handleReactivate = async (row: DepartmentRoleCatalogRow) => {
    const res = await fetch(`/api/admin/department-roles/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ isActive: true }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert((err as { error?: string }).error ?? 'Failed to reactivate')
      return
    }
    await loadRoles()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Contact className="h-5 w-5" aria-hidden />
              Department role catalog
            </CardTitle>
            <CardDescription>
              Each row belongs to one department and defines an app role code (e.g. STAFF) used when assigning users
              in Admin. Display name can differ from the code.
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={handleOpenAdd}
            className="shrink-0"
            disabled={activeDepartments.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" aria-hidden />
            Add role
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add department role</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="drc-add-dept">Department</Label>
                  <Select
                    value={addForm.departmentId}
                    onValueChange={(v) => setAddForm((f) => ({ ...f, departmentId: v }))}
                    required
                  >
                    <SelectTrigger id="drc-add-dept">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="drc-add-name">Role name</Label>
                  <Input
                    id="drc-add-name"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    placeholder="e.g. Lead auditor, Post holder"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="drc-add-role-code">Role code (app permission)</Label>
                  <Select
                    value={addForm.roleCode}
                    onValueChange={(v) => setAddForm((f) => ({ ...f, roleCode: v }))}
                    required
                  >
                    <SelectTrigger id="drc-add-role-code" className="font-mono text-sm">
                      <SelectValue placeholder="Select role code" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENT_CATALOG_ROLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <span className="font-mono">{o.value}</span>
                          <span className="text-muted-foreground"> — {o.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Fixed list; stored on the user account when this catalog row is used for assignment.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="drc-add-desc">Description (optional)</Label>
                  <Textarea
                    id="drc-add-desc"
                    value={addForm.description}
                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    placeholder="Optional notes"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addForm.isActive}
                      onChange={(e) => setAddForm((f) => ({ ...f, isActive: e.target.checked }))}
                      className="h-4 w-4 rounded border border-input"
                    />
                    Active
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting || activeDepartments.length === 0}>
                    {submitting ? 'Saving…' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 min-w-[12rem]">
            <Label htmlFor="drc-filter-dept">Filter by department</Label>
            <Select value={filterDepartmentId} onValueChange={setFilterDepartmentId}>
              <SelectTrigger id="drc-filter-dept">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="h-4 w-4 rounded border border-input"
            />
            Show inactive roles
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : activeDepartments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add at least one active department before creating catalog roles.
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles match the current filter.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm" role="table">
              <thead className="bg-muted/60">
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Department</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">Code</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Description</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 align-top">{getDeptLabel(row)}</td>
                    <td className="p-3 align-top font-medium">{row.name}</td>
                    <td className="p-3 align-top font-mono text-xs hidden sm:table-cell">
                      {row.roleCode ?? '—'}
                    </td>
                    <td className="p-3 align-top text-muted-foreground hidden md:table-cell max-w-xs truncate">
                      {row.description ?? '—'}
                    </td>
                    <td className="p-3 align-top">
                      {row.isActive ? (
                        <Badge variant="outline" className="border-green-600/40 text-green-700 dark:text-green-400">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </td>
                    <td className="p-3 align-top text-right space-x-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(row)}
                        aria-label={`Edit ${row.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {row.isActive ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDeactivate(row)}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleReactivate(row)}>
                          Reactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o)
            if (!o) setEditing(null)
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit department role</DialogTitle>
            </DialogHeader>
            {editing && (
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="drc-edit-dept">Department</Label>
                  <Select
                    value={editForm.departmentId}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, departmentId: v }))}
                    required
                  >
                    <SelectTrigger id="drc-edit-dept">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments
                        .filter((d) => d.isActive !== false || d.id === editForm.departmentId)
                        .map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} ({d.code})
                            {d.isActive === false ? ' — inactive' : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="drc-edit-name">Role name</Label>
                  <Input
                    id="drc-edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="drc-edit-role-code">Role code (app permission)</Label>
                  <Select
                    value={editForm.roleCode}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, roleCode: v }))}
                    required
                  >
                    <SelectTrigger id="drc-edit-role-code" className="font-mono text-sm">
                      <SelectValue placeholder="Select role code" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENT_CATALOG_ROLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <span className="font-mono">{o.value}</span>
                          <span className="text-muted-foreground"> — {o.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="drc-edit-desc">Description (optional)</Label>
                  <Textarea
                    id="drc-edit-desc"
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                      className="h-4 w-4 rounded border border-input"
                    />
                    Active
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
