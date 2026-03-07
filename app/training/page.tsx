'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { BookOpen, Plus, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/utils'

type TrainingRecordRow = {
  id: string
  userId: string
  name: string
  code: string | null
  description: string | null
  recordType: string
  completedAt: string | null
  expiryDate: string | null
  documentUrl: string | null
  createdAt: string
  updatedAt: string
  User?: Array<{ id: string; email?: string; firstName?: string; lastName?: string }> | { id: string; email?: string; firstName?: string; lastName?: string }
}

type UserOption = { id: string; email?: string; firstName?: string; lastName?: string }

const TrainingPage = () => {
  const [records, setRecords] = useState<TrainingRecordRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formUserId, setFormUserId] = useState('')
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState<'TRAINING' | 'QUALIFICATION'>('TRAINING')
  const [formCompletedAt, setFormCompletedAt] = useState('')
  const [formExpiryDate, setFormExpiryDate] = useState('')
  const [formDocumentUrl, setFormDocumentUrl] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [filterUserId, setFilterUserId] = useState('')

  const canManage = userRoles.some(
    (r) =>
      ['SYSTEM_ADMIN', 'QUALITY_MANAGER', 'AUDITOR', 'ACCOUNTABLE_MANAGER'].includes(r)
  )

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          setUserRoles(Array.isArray(data.roles) ? data.roles : [])
        }
      } catch {
        setUserRoles([])
      }
    }
    fetchMe()
  }, [])

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const url = filterUserId
        ? `/api/training?userId=${encodeURIComponent(filterUserId)}`
        : '/api/training'
      const res = await fetch(url, { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setRecords(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch training records:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [filterUserId])

  useEffect(() => {
    if (!canManage) return
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          setUsers(Array.isArray(data) ? data : [])
        }
      } catch {
        setUsers([])
      }
    }
    fetchUsers()
  }, [canManage])

  const getUserDisplay = (u: TrainingRecordRow['User']): string => {
    if (!u) return '—'
    const arr = Array.isArray(u) ? u : [u]
    const first = arr[0]
    if (!first) return '—'
    const name = [first.firstName, first.lastName].filter(Boolean).join(' ').trim()
    return name || first.email || first.id || '—'
  }

  const isExpired = (expiryDate: string | null): boolean => {
    if (!expiryDate) return false
    return new Date(expiryDate) < new Date()
  }

  const isExpiringSoon = (expiryDate: string | null, days = 30): boolean => {
    if (!expiryDate) return false
    const d = new Date(expiryDate)
    const limit = new Date()
    limit.setDate(limit.getDate() + days)
    return d >= new Date() && d <= limit
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formUserId || !formName.trim()) return
    setSubmitLoading(true)
    try {
      const res = await fetch('/api/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          userId: formUserId,
          name: formName.trim(),
          code: formCode.trim() || undefined,
          description: formDescription.trim() || undefined,
          recordType: formType,
          completedAt: formCompletedAt || undefined,
          expiryDate: formExpiryDate || undefined,
          documentUrl: formDocumentUrl.trim() || undefined,
        }),
      })
      if (res.ok) {
        setDialogOpen(false)
        setFormUserId('')
        setFormName('')
        setFormCode('')
        setFormDescription('')
        setFormCompletedAt('')
        setFormExpiryDate('')
        setFormDocumentUrl('')
        fetchRecords()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Failed to create training record')
      }
    } catch {
      alert('Failed to create training record')
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Training & Qualifications</h1>
              <p className="text-muted-foreground mt-1">
                Per ICAO and Auric Air Manual guidance
              </p>
            </div>
          </div>
          {canManage && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button aria-label="Add training record">
                  <Plus className="mr-2 h-4 w-4" />
                  Add training
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add training record</DialogTitle>
                  <DialogDescription>
                    Record training or qualification for a user
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tr-user">User</Label>
                    <Select value={formUserId} onValueChange={setFormUserId} required>
                      <SelectTrigger id="tr-user">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {[u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || u.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tr-name">Name</Label>
                    <Input
                      id="tr-name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Safety Management System"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tr-code">Code</Label>
                    <Input
                      id="tr-code"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="Optional code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tr-type">Type</Label>
                    <Select value={formType} onValueChange={(v) => setFormType(v as 'TRAINING' | 'QUALIFICATION')}>
                      <SelectTrigger id="tr-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRAINING">Training</SelectItem>
                        <SelectItem value="QUALIFICATION">Qualification</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tr-description">Description</Label>
                    <Input
                      id="tr-description"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tr-completedAt">Completed date</Label>
                    <Input
                      id="tr-completedAt"
                      type="date"
                      value={formCompletedAt}
                      onChange={(e) => setFormCompletedAt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tr-expiryDate">Expiry date</Label>
                    <Input
                      id="tr-expiryDate"
                      type="date"
                      value={formExpiryDate}
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tr-documentUrl">Document URL</Label>
                    <Input
                      id="tr-documentUrl"
                      value={formDocumentUrl}
                      onChange={(e) => setFormDocumentUrl(e.target.value)}
                      placeholder="Optional link"
                    />
                  </div>
                  <Button type="submit" disabled={submitLoading}>
                    {submitLoading ? 'Saving…' : 'Save'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {canManage && users.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filter by user</CardTitle>
              <CardDescription>Managers can filter by user</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={filterUserId || 'all'} onValueChange={(v) => setFilterUserId(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {[u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Records</CardTitle>
            <CardDescription>Training and qualifications with expiry</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse h-48 rounded bg-muted" />
            ) : records.length === 0 ? (
              <p className="text-muted-foreground">No training records.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">User</th>
                      <th className="text-left py-2 px-2 font-medium">Name</th>
                      <th className="text-left py-2 px-2 font-medium">Type</th>
                      <th className="text-left py-2 px-2 font-medium">Completed</th>
                      <th className="text-left py-2 px-2 font-medium">Expiry</th>
                      <th className="text-left py-2 px-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="py-2 px-2">{getUserDisplay(row.User)}</td>
                        <td className="py-2 px-2">{row.name}</td>
                        <td className="py-2 px-2">{row.recordType}</td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {row.completedAt ? formatDate(row.completedAt) : '—'}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {row.expiryDate ? formatDate(row.expiryDate) : '—'}
                        </td>
                        <td className="py-2 px-2">
                          {isExpired(row.expiryDate) && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Expired
                            </Badge>
                          )}
                          {!isExpired(row.expiryDate) && isExpiringSoon(row.expiryDate) && (
                            <Badge variant="secondary" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Expiring soon
                            </Badge>
                          )}
                          {!isExpired(row.expiryDate) && !isExpiringSoon(row.expiryDate) && row.expiryDate && (
                            <Badge variant="outline">Valid</Badge>
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
      </div>
    </MainLayout>
  )
}

export default TrainingPage
