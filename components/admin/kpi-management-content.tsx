'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type KpiDef = {
  id: string
  code: string | null
  name: string
  area: string | null
  unit: string
  direction: string
  targetValue: number | null
  isComputed: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type KpiValue = {
  id: string
  month: string
  value: number
  note: string | null
  createdAt: string
}

export const KpiManagementContent = () => {
  const [kpis, setKpis] = useState<KpiDef[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<KpiDef | null>(null)
  const [form, setForm] = useState({ targetValue: '' as string, isActive: true })
  const [valuesOpen, setValuesOpen] = useState(false)
  const [valuesKpi, setValuesKpi] = useState<KpiDef | null>(null)
  const [values, setValues] = useState<KpiValue[]>([])
  const [valueMonth, setValueMonth] = useState('')
  const [valueVal, setValueVal] = useState('')
  const [valueNote, setValueNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchKpis = async () => {
    try {
      const res = await fetch('/api/admin/kpis', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setKpis(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKpis()
  }, [])

  const handleOpenEdit = (k: KpiDef) => {
    setEditing(k)
    setForm({
      targetValue: k.targetValue != null ? String(k.targetValue) : '',
      isActive: k.isActive,
    })
    setEditOpen(true)
  }

  const handleSaveKpi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/kpis/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetValue: form.targetValue === '' ? null : Number(form.targetValue),
          isActive: form.isActive,
        }),
      })
      if (res.ok) {
        setEditOpen(false)
        setEditing(null)
        fetchKpis()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to update')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenValues = async (k: KpiDef) => {
    setValuesKpi(k)
    setValueMonth('')
    setValueVal('')
    setValueNote('')
    try {
      const res = await fetch(`/api/admin/kpis/${k.id}/values`, { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setValues(data)
      }
    } catch (e) {
      console.error(e)
    }
    setValuesOpen(true)
  }

  const handleAddValue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valuesKpi || !valueMonth || valueVal === '') return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/kpis/${valuesKpi.id}/values`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: valueMonth, value: Number(valueVal), note: valueNote.trim() || undefined }),
      })
      if (res.ok) {
        setValueMonth('')
        setValueVal('')
        setValueNote('')
        const listRes = await fetch(`/api/admin/kpis/${valuesKpi.id}/values`, { credentials: 'same-origin' })
        if (listRes.ok) setValues(await listRes.json())
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to save value')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>KPI definitions</CardTitle>
          <CardContent className="pt-2 text-sm text-muted-foreground">
            Computed KPIs are filled from system data. You can edit target value and active status only. Manual KPIs can also have monthly values entered here.
          </CardContent>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : kpis.length === 0 ? (
            <p className="text-muted-foreground">No KPIs. Run migrations to seed default KPIs.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Code</th>
                    <th className="text-left p-3 font-medium">Unit</th>
                    <th className="text-left p-3 font-medium">Target</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="w-24 p-3" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((k) => (
                    <tr key={k.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">{k.name}</td>
                      <td className="p-3 font-mono text-muted-foreground">{k.code ?? '—'}</td>
                      <td className="p-3">{k.unit}</td>
                      <td className="p-3">{k.targetValue != null ? k.targetValue : '—'}</td>
                      <td className="p-3">
                        <Badge variant="secondary">{k.isComputed ? 'Computed' : 'Manual'}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={k.isActive ? 'default' : 'destructive'}>{k.isActive ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="p-3 flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(k)} aria-label="Edit KPI">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!k.isComputed && (
                          <Button variant="ghost" size="sm" onClick={() => handleOpenValues(k)}>
                            Values
                          </Button>
                        )}
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
            <DialogTitle>Edit KPI</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleSaveKpi} className="space-y-4 mt-4">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Name:</span> {editing.name}</p>
                <p><span className="font-medium text-foreground">Area:</span> {editing.area ?? '—'}</p>
                <p><span className="font-medium text-foreground">Unit:</span> {editing.unit} · <span className="font-medium text-foreground">Direction:</span> {editing.direction === 'HIGHER_IS_BETTER' ? 'Higher is better' : 'Lower is better'}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-target">Target value</Label>
                <Input id="kpi-target" type="number" value={form.targetValue} onChange={(e) => setForm((p) => ({ ...p, targetValue: e.target.value }))} placeholder="Optional" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="rounded border-input" aria-label="KPI active" />
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

      <Dialog open={valuesOpen} onOpenChange={setValuesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Monthly values – {valuesKpi?.name}</DialogTitle>
          </DialogHeader>
          {valuesKpi && (
            <>
              <form onSubmit={handleAddValue} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="val-month">Month (YYYY-MM)</Label>
                    <Input id="val-month" value={valueMonth} onChange={(e) => setValueMonth(e.target.value)} placeholder="2025-03" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="val-value">Value</Label>
                    <Input id="val-value" type="number" value={valueVal} onChange={(e) => setValueVal(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="val-note">Note (optional)</Label>
                  <Input id="val-note" value={valueNote} onChange={(e) => setValueNote(e.target.value)} />
                </div>
                <Button type="submit" disabled={submitting || !valueMonth || valueVal === ''}>{submitting ? 'Saving...' : 'Add / Update value'}</Button>
              </form>
              <div className="mt-4 border-t pt-4">
                <p className="text-sm font-medium mb-2">Saved values</p>
                {values.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No values yet.</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {values.map((v) => (
                      <li key={v.id}>{v.month}: {v.value}{v.note ? ` – ${v.note}` : ''}</li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
