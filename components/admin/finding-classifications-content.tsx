'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { Pencil } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type Classification = {
  id: string
  group: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
}

export const FindingClassificationsContent = () => {
  const [list, setList] = useState<Classification[]>([])
  const [loading, setLoading] = useState(true)
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Classification | null>(null)
  const [form, setForm] = useState({ group: '', code: '', name: '', description: '', isActive: true })
  const [submitting, setSubmitting] = useState(false)

  const fetchList = async () => {
    try {
      const res = await fetch('/api/admin/finding-classifications', { credentials: 'same-origin' })
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

  const groups = Array.from(new Set(list.map((c) => c.group))).sort()
  const filtered = groupFilter === 'all' ? list : list.filter((c) => c.group === groupFilter)

  const handleOpenEdit = (c: Classification) => {
    setEditing(c)
    setForm({
      group: c.group,
      code: c.code,
      name: c.name,
      description: c.description ?? '',
      isActive: c.isActive,
    })
    setEditOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/finding-classifications/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group: form.group.trim(),
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          isActive: form.isActive,
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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Classifications</CardTitle>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-48" aria-label="Filter by group">
                <SelectValue placeholder="All groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground">No classifications.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Group</th>
                    <th className="text-left p-3 font-medium">Code</th>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="w-14 p-3" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="p-3">{c.group}</td>
                      <td className="p-3 font-mono text-muted-foreground">{c.code}</td>
                      <td className="p-3">{c.name}</td>
                      <td className="p-3">
                        <Badge variant={c.isActive ? 'default' : 'destructive'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(c)} aria-label="Edit classification">
                          <Pencil className="h-4 w-4" />
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit classification</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleSave} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="fc-group">Group</Label>
                <Input id="fc-group" value={form.group} onChange={(e) => setForm((p) => ({ ...p, group: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fc-code">Code</Label>
                <Input id="fc-code" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fc-name">Name</Label>
                <Input id="fc-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fc-desc">Description</Label>
                <Input id="fc-desc" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="rounded border-input" aria-label="Classification active" />
                Active
              </label>
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
