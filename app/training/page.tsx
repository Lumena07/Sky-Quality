'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useMemo, useState } from 'react'
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
import { formatDate, formatDateOnly, cn } from '@/lib/utils'
import { canSeeTraining, canAddTraining } from '@/lib/permissions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

type AuditorAssignmentRow = {
  id: string
  courseId: string
  scheduledDate?: string | null
  location?: string | null
  Course?: { id?: string; title?: string } | { id?: string; title?: string }[]
  User?: { id?: string; firstName?: string; lastName?: string; email?: string } | { id?: string; firstName?: string; lastName?: string; email?: string }[]
}

const getAuditorDisplayName = (u: UserOption): string =>
  [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || u.id

const getAssignmentUserDisplay = (usr: AuditorAssignmentRow['User']): string => {
  if (!usr) return '—'
  const first = Array.isArray(usr) ? usr[0] : usr
  if (!first) return '—'
  const name = [first.firstName, first.lastName].filter(Boolean).join(' ').trim()
  return name || first.email || first.id || '—'
}

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
  const [trainTab, setTrainTab] = useState<'records' | 'auditor' | 'requal'>('records')
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([])
  const [assignments, setAssignments] = useState<AuditorAssignmentRow[]>([])
  const [auditorUsers, setAuditorUsers] = useState<UserOption[]>([])
  const [requalRows, setRequalRows] = useState<any[]>([])
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [assignCourseId, setAssignCourseId] = useState('')
  const [assignScheduledDate, setAssignScheduledDate] = useState('')
  const [assignLocation, setAssignLocation] = useState('')
  const [assignSelectedAuditorIds, setAssignSelectedAuditorIds] = useState<string[]>([])
  const [auditorAssignFilter, setAuditorAssignFilter] = useState('')
  const [assignProgrammeSubmitting, setAssignProgrammeSubmitting] = useState(false)
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null)
  const [requalSavingId, setRequalSavingId] = useState<string | null>(null)

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
    if (!canSeeTraining(userRoles, departmentId) || trainTab !== 'auditor') return
    const load = async () => {
      const [c, a, u] = await Promise.all([
        fetch('/api/auditor-training/courses', { credentials: 'same-origin' }).then((r) =>
          r.ok ? r.json() : []
        ),
        fetch('/api/auditor-training/assignments', { credentials: 'same-origin' }).then((r) =>
          r.ok ? r.json() : []
        ),
        fetch('/api/auditors', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : [])),
      ])
      setCourses(Array.isArray(c) ? c : [])
      setAssignments(Array.isArray(a) ? (a as AuditorAssignmentRow[]) : [])
      setAuditorUsers(Array.isArray(u) ? u : [])
    }
    load()
  }, [trainTab, userRoles, departmentId])

  useEffect(() => {
    if (!canSeeTraining(userRoles, departmentId) || trainTab !== 'requal') return
    fetch('/api/auditors/requalification', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRequalRows(Array.isArray(d) ? d : []))
  }, [trainTab, userRoles, departmentId])

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

  const assignmentsByCourseId = useMemo(() => {
    const map = new Map<string, AuditorAssignmentRow[]>()
    for (const row of assignments) {
      const cid = row.courseId
      const prev = map.get(cid) ?? []
      prev.push(row)
      map.set(cid, prev)
    }
    return map
  }, [assignments])

  const rosterCourseIdsOrdered = useMemo(() => {
    const fromAssignments = Array.from(new Set(assignments.map((a) => a.courseId)))
    const courseOrder = new Map(courses.map((c, i) => [c.id, i]))
    return [...fromAssignments].sort((a, b) => {
      const ia = courseOrder.get(a) ?? 9999
      const ib = courseOrder.get(b) ?? 9999
      return ia - ib
    })
  }, [assignments, courses])

  const assignmentCountByCourseId = useMemo(() => {
    const m = new Map<string, number>()
    for (const row of assignments) {
      m.set(row.courseId, (m.get(row.courseId) ?? 0) + 1)
    }
    return m
  }, [assignments])

  const filteredAuditorsForAssign = useMemo(() => {
    const q = auditorAssignFilter.trim().toLowerCase()
    if (!q) return auditorUsers
    return auditorUsers.filter((u) => {
      const label = getAuditorDisplayName(u).toLowerCase()
      return label.includes(q) || (u.email?.toLowerCase().includes(q) ?? false)
    })
  }, [auditorUsers, auditorAssignFilter])

  const handleToggleAuditorAssign = (userId: string) => {
    setAssignSelectedAuditorIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleReloadAuditorAssignments = async () => {
    const a = await fetch('/api/auditor-training/assignments', { credentials: 'same-origin' }).then((r) =>
      r.ok ? r.json() : []
    )
    setAssignments(Array.isArray(a) ? (a as AuditorAssignmentRow[]) : [])
  }

  const handleAssignToProgramme = async () => {
    if (!assignCourseId || assignSelectedAuditorIds.length === 0) return
    if (!assignScheduledDate.trim() || !assignLocation.trim()) {
      alert('Scheduled date and location are required.')
      return
    }
    setAssignProgrammeSubmitting(true)
    try {
      const res = await fetch('/api/auditor-training/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          courseId: assignCourseId,
          userIds: assignSelectedAuditorIds,
          scheduledDate: assignScheduledDate.trim(),
          location: assignLocation.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert((err as { error?: string }).error ?? 'Failed to assign')
        return
      }
      setAssignSelectedAuditorIds([])
      await handleReloadAuditorAssignments()
    } finally {
      setAssignProgrammeSubmitting(false)
    }
  }

  const handleRemoveAssignment = async (assignmentId: string) => {
    setRemovingAssignmentId(assignmentId)
    try {
      const res = await fetch(`/api/auditor-training/assignments/${assignmentId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert((err as { error?: string }).error ?? 'Failed to remove')
        return
      }
      await handleReloadAuditorAssignments()
    } finally {
      setRemovingAssignmentId(null)
    }
  }

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
              <h1 className="text-3xl font-bold">QMS personnel training and qualification</h1>
              <p className="text-muted-foreground mt-1">
                Staff training records, auditor programme, and requalification (per ICAO / internal manual).
              </p>
            </div>
          </div>
        </header>

        <Tabs value={trainTab} onValueChange={(v) => setTrainTab(v as typeof trainTab)} className="w-full">
          <TabsList className="mb-6 flex flex-wrap h-auto gap-1" aria-label="Training sections">
            <TabsTrigger value="records">Training & qualification records</TabsTrigger>
            <TabsTrigger value="auditor">Auditor training programme</TabsTrigger>
            <TabsTrigger value="requal">Requalification dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="auditor" className="space-y-6">
            <Card className="border-primary/20 bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Completion and certificates</CardTitle>
                <CardDescription>
                  The programme below is only who is scheduled on each course. When an auditor completes training,
                  record dates, expiry, and certificates on the{' '}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2 font-medium"
                    onClick={() => setTrainTab('records')}
                  >
                    Training & qualification records
                  </button>{' '}
                  tab.
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <div className="space-y-6">
                {canManage && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Add programme course</CardTitle>
                      <CardDescription>Define a course title; then assign one or many auditors to it.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2 items-end">
                      <Input
                        placeholder="Course title"
                        value={newCourseTitle}
                        onChange={(e) => setNewCourseTitle(e.target.value)}
                        className="max-w-md min-w-[12rem]"
                        aria-label="New course title"
                      />
                      <Button
                        type="button"
                        onClick={async () => {
                          if (!newCourseTitle.trim()) return
                          const res = await fetch('/api/auditor-training/courses', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'same-origin',
                            body: JSON.stringify({ title: newCourseTitle.trim() }),
                          })
                          if (res.ok) {
                            setNewCourseTitle('')
                            const c = await fetch('/api/auditor-training/courses', {
                              credentials: 'same-origin',
                            }).then((r) => (r.ok ? r.json() : []))
                            setCourses(Array.isArray(c) ? c : [])
                          }
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" aria-hidden />
                        Add course
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Programme courses</CardTitle>
                    <CardDescription>Auditor count includes everyone assigned to each course.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {courses.length === 0 ? (
                      <p className="text-muted-foreground">No courses yet.{canManage ? ' Add one above.' : ''}</p>
                    ) : (
                      <ul className="space-y-2" role="list">
                        {courses.map((c) => {
                          const count = assignmentCountByCourseId.get(c.id) ?? 0
                          return (
                            <li
                              key={c.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5"
                            >
                              <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <span className="font-medium truncate">{c.title}</span>
                                <Badge variant="secondary" className="shrink-0">
                                  {count} assigned
                                </Badge>
                              </div>
                              {canManage && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="shrink-0"
                                  onClick={async () => {
                                    if (!confirm('Delete this course? Assigned auditors will be removed from the programme.'))
                                      return
                                    const res = await fetch(`/api/auditor-training/courses/${c.id}`, {
                                      method: 'DELETE',
                                      credentials: 'same-origin',
                                    })
                                    if (res.ok) {
                                      setCourses((prev) => prev.filter((x) => x.id !== c.id))
                                      await handleReloadAuditorAssignments()
                                    }
                                  }}
                                >
                                  Remove course
                                </Button>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              {canManage && (
                <Card className="lg:sticky lg:top-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Assign auditors</CardTitle>
                    <CardDescription>
                      Set when and where the training runs, choose a course and auditors, then assign everyone in one
                      step.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-1">
                        <Label htmlFor="assign-scheduled-date">Scheduled date</Label>
                        <Input
                          id="assign-scheduled-date"
                          type="date"
                          value={assignScheduledDate}
                          onChange={(e) => setAssignScheduledDate(e.target.value)}
                          required
                          aria-required
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="assign-location">Location</Label>
                        <Input
                          id="assign-location"
                          placeholder="e.g. Training room A, online link, or venue"
                          value={assignLocation}
                          onChange={(e) => setAssignLocation(e.target.value)}
                          aria-required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="assign-course-select">Course</Label>
                      <Select
                        value={assignCourseId}
                        onValueChange={(v) => {
                          setAssignCourseId(v)
                          setAssignSelectedAuditorIds([])
                        }}
                      >
                        <SelectTrigger id="assign-course-select">
                          <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                        <SelectContent>
                          {courses.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="auditor-assign-filter">Find auditors</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                          id="auditor-assign-filter"
                          className="pl-9"
                          placeholder="Name or email"
                          value={auditorAssignFilter}
                          onChange={(e) => setAuditorAssignFilter(e.target.value)}
                          aria-label="Filter auditors by name or email"
                        />
                      </div>
                    </div>
                    <div
                      role="group"
                      aria-label="Auditors to assign to the selected course"
                      className="max-h-60 overflow-y-auto rounded-md border p-3 space-y-2"
                    >
                      {auditorUsers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No auditors found.</p>
                      ) : filteredAuditorsForAssign.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No matches for your search.</p>
                      ) : (
                        filteredAuditorsForAssign.map((u) => {
                          const inputId = `assign-auditor-${u.id}`
                          const checked = assignSelectedAuditorIds.includes(u.id)
                          return (
                            <label
                              key={u.id}
                              htmlFor={inputId}
                              className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors',
                                'hover:bg-muted/80 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
                              )}
                            >
                              <input
                                id={inputId}
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleAuditorAssign(u.id)}
                                className="h-4 w-4 shrink-0 rounded border border-input"
                                aria-checked={checked}
                              />
                              <span className="min-w-0 truncate">{getAuditorDisplayName(u)}</span>
                            </label>
                          )
                        })
                      )}
                    </div>
                    <Button
                      type="button"
                      disabled={
                        !assignCourseId ||
                        !assignScheduledDate.trim() ||
                        !assignLocation.trim() ||
                        assignSelectedAuditorIds.length === 0 ||
                        assignProgrammeSubmitting ||
                        courses.length === 0
                      }
                      onClick={handleAssignToProgramme}
                      className="w-full sm:w-auto"
                    >
                      {assignProgrammeSubmitting
                        ? 'Assigning…'
                        : `Assign to programme${assignSelectedAuditorIds.length ? ` (${assignSelectedAuditorIds.length})` : ''}`}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Programme roster</CardTitle>
                <CardDescription>
                  Scheduled date and location are stored per assignment. The same course can include many auditors.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No one is on the programme yet.</p>
                ) : (
                  <div className="space-y-4">
                    {rosterCourseIdsOrdered.map((courseId) => {
                      const rows = assignmentsByCourseId.get(courseId) ?? []
                      if (rows.length === 0) return null
                      const courseTitle =
                        courses.find((c) => c.id === courseId)?.title ??
                        (() => {
                          const first = rows[0]
                          const rel = first?.Course
                          const c = Array.isArray(rel) ? rel[0] : rel
                          return c?.title ?? 'Course'
                        })()
                      return (
                        <div
                          key={courseId}
                          className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden"
                        >
                          <div className="border-b bg-muted/40 px-4 py-3">
                            <h3 className="font-semibold text-sm">{courseTitle}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {rows.length} auditor{rows.length === 1 ? '' : 's'}
                            </p>
                          </div>
                          <ul className="divide-y" role="list">
                            {rows.map((row) => (
                              <li
                                key={row.id}
                                className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="font-medium">{getAssignmentUserDisplay(row.User)}</div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs sm:text-sm">
                                    <span>
                                      Date:{' '}
                                      {row.scheduledDate
                                        ? formatDateOnly(
                                            typeof row.scheduledDate === 'string'
                                              ? row.scheduledDate
                                              : String(row.scheduledDate)
                                          )
                                        : '—'}
                                    </span>
                                    <span>Location: {row.location?.trim() ? row.location.trim() : '—'}</span>
                                  </div>
                                </div>
                                {canManage && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive shrink-0 self-start sm:self-center"
                                    disabled={removingAssignmentId === row.id}
                                    onClick={() => handleRemoveAssignment(row.id)}
                                    aria-label={`Remove ${getAssignmentUserDisplay(row.User)} from ${courseTitle}`}
                                  >
                                    {removingAssignmentId === row.id ? 'Removing…' : 'Remove'}
                                  </Button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requal" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Auditor requalification</CardTitle>
                <CardDescription>
                  Auditors with no audit in 12 months need requalification unless a requalification course was completed
                  in the last 12 months.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border rounded-md text-sm">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Title</th>
                        <th className="text-left p-2">Last audit</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Requal course</th>
                        {canManage && <th className="text-left p-2">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {requalRows.map((r) => {
                        const name =
                          [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.email || r.id
                        return (
                          <tr key={r.id} className="border-t">
                            <td className="p-2 font-medium">{name}</td>
                            <td className="p-2">{r.position ?? '—'}</td>
                            <td className="p-2 text-muted-foreground">
                              {r.lastAuditConductedAt ? formatDate(r.lastAuditConductedAt) : '—'}
                            </td>
                            <td className="p-2">
                              {r.requalificationRequired ? (
                                <Badge variant="destructive">Requalification required</Badge>
                              ) : (
                                <Badge variant="outline" className="border-green-600/50 text-green-700">
                                  Active
                                </Badge>
                              )}
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {r.requalificationCourseCompletedAt
                                ? formatDate(r.requalificationCourseCompletedAt)
                                : 'No'}
                            </td>
                            {canManage && (
                              <td className="p-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={requalSavingId === r.id}
                                  onClick={async () => {
                                    setRequalSavingId(r.id)
                                    try {
                                      const res = await fetch(`/api/auditors/requalification/${r.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        credentials: 'same-origin',
                                        body: JSON.stringify({
                                          auditorRequalificationCompletedAt: new Date().toISOString(),
                                        }),
                                      })
                                      if (res.ok) {
                                        const d = await fetch('/api/auditors/requalification', {
                                          credentials: 'same-origin',
                                        }).then((x) => (x.ok ? x.json() : []))
                                        setRequalRows(Array.isArray(d) ? d : [])
                                      }
                                    } finally {
                                      setRequalSavingId(null)
                                    }
                                  }}
                                >
                                  Record course done
                                </Button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="records" className="space-y-6">
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
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}

export default TrainingPage
