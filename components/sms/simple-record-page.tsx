'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type FieldType = 'text' | 'date' | 'textarea'

export type FieldDef = {
  key: string
  label: string
  required?: boolean
  type?: FieldType
}

export const SimpleRecordPage = ({
  title,
  endpoint,
  fields,
  viewOnly = false,
}: {
  title: string
  endpoint: string
  fields: FieldDef[]
  viewOnly?: boolean
}) => {
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map((f) => [f.key, '']))
  )

  const requiredKeys = useMemo(
    () => fields.filter((f) => f.required).map((f) => f.key),
    [fields]
  )

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await fetch(endpoint, { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [endpoint])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (requiredKeys.some((k) => !form[k]?.trim())) return

    setSaving(true)
    try {
      const body = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v.trim() || null])
      )
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || `Failed to create ${title}`)
        return
      }
      setForm(Object.fromEntries(fields.map((f) => [f.key, ''])))
      fetchItems()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 p-6">
      {!viewOnly ? (
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className={field.type === 'textarea' ? 'md:col-span-2 space-y-2' : 'space-y-2'}
                >
                  <Label htmlFor={field.key}>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      id={field.key}
                      value={form[field.key] ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  ) : (
                    <Input
                      id={field.key}
                      type={field.type ?? 'text'}
                      value={form[field.key] ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  )}
                </div>
              ))}
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : `Create ${title}`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{title} records</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records yet.</p>
          ) : (
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(items, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
