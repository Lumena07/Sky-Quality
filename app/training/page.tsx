'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Plus, AlertTriangle, ExternalLink, Upload, X, Search, GraduationCap, Award } from 'lucide-react'
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
import { formatDate, cn } from '@/lib/utils'
import { canSeeTraining, canAddTraining } from '@/lib/permissions'

type TrainingRecordRow = {
  id: string
  userId: string
  name: string
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
  const router = useRouter()
  const [records, setRecords] = useState<TrainingRecordRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formUserId, setFormUserId] = useState('')
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<'TRAINING' | 'QUALIFICATION'>('TRAINING')
  const [formCompletedAt, setFormCompletedAt] = useState('')
  const [formExpiryDate, setFormExpiryDate] = useState('')
  const [formDocumentUrl, setFormDocumentUrl] = useState('')
  const [certificateUploading, setCertificateUploading] = useState(false)
  const [uploadedCertificateName, setUploadedCertificateName] = useState<string | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [filterUserId, setFilterUserId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const canManage = canAddTraining(userRoles)

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          const roles = Array.isArray(data.roles) ? data.roles : []
          const deptId = data.departmentId ?? null
          setUserRoles(roles)
          setDepartmentId(deptId)
          if (!canSeeTraining(roles, deptId)) {
            router.replace('/dashboard')
            return
          }
        }
      } catch {
        setUserRoles([])
        setDepartmentId(null)
      }
    }
    fetchMe()
  }, [router])

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

  const getStatus = (expiryDate: string | null): 'valid' | 'expiring' | 'expired' | 'none' => {
    if (!expiryDate) return 'none'
    if (isExpired(expiryDate)) return 'expired'
    if (isExpiringSoon(expiryDate)) return 'expiring'
    return 'valid'
  }

  const stats = {
    total: records.length,
    valid: records.filter((r) => getStatus(r.expiryDate) === 'valid').length,
    expiringSoon: records.filter((r) => getStatus(r.expiryDate) === 'expiring').length,
    expired: records.filter((r) => getStatus(r.expiryDate) === 'expired').length,
  }

  const filteredRecords = records.filter((row) => {
    const matchesSearch =
      !searchQuery.trim() ||
      row.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      getUserDisplay(row.User).toLowerCase().includes(searchQuery.trim().toLowerCase())
    const matchesUser = !filterUserId || row.userId === filterUserId
    const status = getStatus(row.expiryDate)
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'valid' && status === 'valid') ||
      (statusFilter === 'expiring' && status === 'expiring') ||
      (statusFilter === 'expired' && status === 'expired')
    return matchesSearch && matchesUser && matchesStatus
  })

  const trainingRecords = filteredRecords.filter((r) => r.recordType === 'TRAINING')
  const qualificationRecords = filteredRecords.filter((r) => r.recordType === 'QUALIFICATION')

  const renderTable = (rows: TrainingRecordRow[], emptyMessage: string) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-3 font-medium">User</th>
            <th className="text-left py-3 px-3 font-medium">Name</th>
            <th className="text-left py-3 px-3 font-medium">Completed</th>
            <th className="text-left py-3 px-3 font-medium">Expiry</th>
            <th className="text-left py-3 px-3 font-medium">Certificate</th>
            <th className="text-left py-3 px-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b hover:bg-muted/50">
                <td className="py-3 px-3">{getUserDisplay(row.User)}</td>
                <td className="py-3 px-3 font-medium">{row.name}</td>
                <td className="py-3 px-3 text-muted-foreground">
                  {row.completedAt ? formatDate(row.completedAt) : '—'}
                </td>
                <td className="py-3 px-3 text-muted-foreground">
                  {row.expiryDate ? formatDate(row.expiryDate) : '—'}
                </td>
                <td className="py-3 px-3">
                  {row.documentUrl ? (
                    <a
                      href={row.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      aria-label="View certificate"
                    >
                      View
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-3 px-3">
                  {getStatus(row.expiryDate) === 'expired' && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Expired
                    </Badge>
                  )}
                  {getStatus(row.expiryDate) === 'expiring' && (
                    <Badge variant="secondary" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Expiring soon
                    </Badge>
                  )}
                  {getStatus(row.expiryDate) === 'valid' && (
                    <Badge variant="outline" className="border-green-500/50 text-green-700 dark:text-green-400">
                      Valid
                    </Badge>
                  )}
                  {getStatus(row.expiryDate) === 'none' && <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )

  const handleCertificateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCertificateUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entityType', 'training')
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Failed to upload certificate')
        return
      }
      const data = await res.json()
      setFormDocumentUrl(data.fileUrl ?? '')
      setUploadedCertificateName(data.fileName ?? file.name)
    } catch {
      alert('Failed to upload certificate')
    } finally {
      setCertificateUploading(false)
    }
    e.target.value = ''
  }

  const handleClearCertificate = () => {
    setFormDocumentUrl('')
    setUploadedCertificateName(null)
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
        setFormCompletedAt('')
        setFormExpiryDate('')
        setFormDocumentUrl('')
        setUploadedCertificateName(null)
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
      <div className="p-8 space-y-8">
        <header>
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Training & Qualifications</h1>
              <p className="text-muted-foreground mt-1">
                Per ICAO and internal manual guidance
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary" className="px-3 py-1.5 text-sm font-normal">
            {stats.total} Training{stats.total !== 1 ? 's' : ''}
          </Badge>
          <Badge variant="outline" className="border-green-500/50 px-3 py-1.5 text-sm font-normal text-green-700 dark:text-green-400">
            {stats.valid} Valid
          </Badge>
          <Badge variant="secondary" className="px-3 py-1.5 text-sm font-normal">
            {stats.expiringSoon} Expiring soon
          </Badge>
          <Badge variant="destructive" className="px-3 py-1.5 text-sm font-normal">
            {stats.expired} Expired
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search training..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search training"
            />
          </div>
          {canManage && users.length > 0 && (
            <Select value={filterUserId || 'all'} onValueChange={(v) => setFilterUserId(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[180px]" aria-label="Filter by user">
                <SelectValue placeholder="User" />
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
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="valid">Valid</SelectItem>
              <SelectItem value="expiring">Expiring soon</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          {canManage && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button aria-label="Add training or qualification">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Training / Qualification
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
                    <Label>Certificate</Label>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        id="tr-certificate-file"
                        accept=".pdf,image/jpeg,image/jpg,image/png,image/gif"
                        onChange={handleCertificateFileChange}
                        className="hidden"
                        disabled={certificateUploading}
                        aria-label="Choose certificate file"
                      />
                      <Label
                        htmlFor="tr-certificate-file"
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground',
                          certificateUploading && 'pointer-events-none opacity-60'
                        )}
                      >
                        <Upload className="h-4 w-4" />
                        {certificateUploading ? 'Uploading…' : 'Choose certificate file'}
                      </Label>
                      {formDocumentUrl && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="truncate">
                            {uploadedCertificateName ? `Uploaded: ${uploadedCertificateName}` : 'Certificate uploaded'}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClearCertificate}
                            disabled={certificateUploading}
                            aria-label="Clear certificate"
                            className="h-auto p-1 text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PDF or image (JPEG, PNG, GIF). Max 2GB.
                    </p>
                  </div>
                  <Button type="submit" disabled={submitLoading}>
                    {submitLoading ? 'Saving…' : 'Save'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse h-48 rounded-lg bg-muted" />
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GraduationCap className="h-5 w-5" />
                  Training
                </CardTitle>
                <CardDescription>
                  Training records ({trainingRecords.length})
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {renderTable(trainingRecords, 'No training records.')}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Award className="h-5 w-5" />
                  Qualifications
                </CardTitle>
                <CardDescription>
                  Qualification records ({qualificationRecords.length})
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {renderTable(qualificationRecords, 'No qualification records.')}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  )
}

export default TrainingPage
