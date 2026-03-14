'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState, useEffect } from 'react'
import { Pencil, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

export type Violation = {
  id: string
  title: string
  description: string | null
  severity: string | null
  occurredAt: string
  auditId: string | null
  findingId: string | null
  createdAt: string
}

export const RegulatoryViolationsContent = () => {
  const [list, setList] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Violation | null>(null)
  const [form, setForm] = useState({ title: '', description: '', severity: '', occurredAt: '' })
  const [submitting, setSubmitting] = useState(false)

  const fetchList = async () => {
    try {
      const res = await fetch('/api/admin/regulatory-violations', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setList(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [])

  const handleOpenAdd = () => {
    setForm({
      title: '',
      description: '',
      severity: '',
      occurredAt: new Date().toISOString().slice(0, 16),
    })
    setAddOpen(true)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.occurredAt) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/regulatory-violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          severity: form.severity.trim() || undefined,
          occurredAt: new Date(form.occurredAt).toISOString(),
        }),
      })
      if (res.ok) {
        setAddOpen(false)
        fetchList()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to add')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenEdit = (v: Violation) => {
    setEditing(v)
    setForm({
      title: v.title,
      description: v.description ?? '',
      severity: v.severity ?? '',
      occurredAt: v.occurredAt.slice(0, 16),
    })
    setEditOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/regulatory-violations/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          severity: form.severity.trim() || null,
          occurredAt: new Date(form.occurredAt).toISOString(),
        }),
      })
      if (res.ok) {
        setEditOpen(false)
        setEditing(null)
        fetchList()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to update')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this regulatory violation?')) return
    try {
      const res = await fetch(`/api/admin/regulatory-violations/${id}`, { method: 'DELETE' })
      if (res.ok) fetchList()
      else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to delete')
      }
    } catch (e) {
      console.error(e)
      alert('Failed to delete')
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Violations</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Record regulatory violations; they are counted in the Performance dashboard KPI.</p>
            </div>
            <Button onClick={handleOpenAdd} aria-label="Add violation">
              <Plus className="h-4 w-4 mr-2" />
              Add violation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : list.length === 0 ? (
            <p className="text-muted-foreground">No violations recorded.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Title</th>
                    <th className="text-left p-3 font-medium">Occurred</th>
                    <th className="text-left p-3 font-medium">Severity</th>
                    <th className="w-24 p-3" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((v) => (
                    <tr key={v.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">{v.title}</td>
                      <td className="p-3 text-muted-foreground">{new Date(v.occurredAt).toLocaleDateString()}</td>
                      <td className="p-3">{v.severity ?? '—'}</td>
                      <td className="p-3 flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(v)} aria-label="Edit violation">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(v.id)} className="text-destructive">
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add regulatory violation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="add-title">Title *</Label>
              <Input id="add-title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-desc">Description</Label>
              <Textarea id="add-desc" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-severity">Severity</Label>
              <Input id="add-severity" value={form.severity} onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))} placeholder="e.g. Major" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-occurred">Occurred at *</Label>
              <Input id="add-occurred" type="datetime-local" value={form.occurredAt} onChange={(e) => setForm((p) => ({ ...p, occurredAt: e.target.value }))} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit violation</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleSave} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title *</Label>
                <Input id="edit-title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea id="edit-desc" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-severity">Severity</Label>
                <Input id="edit-severity" value={form.severity} onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-occurred">Occurred at *</Label>
                <Input id="edit-occurred" type="datetime-local" value={form.occurredAt} onChange={(e) => setForm((p) => ({ ...p, occurredAt: e.target.value }))} required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
