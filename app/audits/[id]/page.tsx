'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { formatDate, formatDateTime } from '@/lib/utils'
import { FileText, AlertCircle, CheckCircle, Download } from 'lucide-react'
import Link from 'next/link'
import { FileUpload, FileList } from '@/components/ui/file-upload'
import { AuditExecution } from '@/components/audits/audit-execution'
import { MeetingAttendanceList } from '@/components/audits/meeting-attendance-list'
import { downloadAuditReportPDF } from '@/lib/export/pdf'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { isAdminOrQM } from '@/lib/permissions'

/** Get CorrectiveAction from finding (handles API shape: array or single). */
const getCorrectiveAction = (finding: Record<string, unknown>) => {
  const raw = finding.CorrectiveAction ?? finding.correctiveAction ?? (finding as Record<string, unknown>).corrective_action
  if (Array.isArray(raw) && raw.length > 0) return raw[0] as Record<string, unknown>
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

const AuditDetailPage = () => {
  const params = useParams()
  const [me, setMe] = useState<{ id: string; roles: string[] } | null>(null)
  const [audit, setAudit] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const [checklists, setChecklists] = useState<any[]>([])
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null)
  const [savingChecklist, setSavingChecklist] = useState(false)
  const [checklistResponses, setChecklistResponses] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleForm, setRescheduleForm] = useState({
    startDate: '',
    endDate: '',
    openingMeetingAt: '',
    closingMeetingAt: '',
    scheduleNotes: '',
  })
  const [savingReschedule, setSavingReschedule] = useState(false)
  const [openingAttendance, setOpeningAttendance] = useState<any[]>([])
  const [closingAttendance, setClosingAttendance] = useState<any[]>([])
  const [sendingToAuditee, setSendingToAuditee] = useState(false)
  const [closingNotesEdit, setClosingNotesEdit] = useState('')
  const [savingClosingNotes, setSavingClosingNotes] = useState(false)

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          setMe({ id: data.id, roles: Array.isArray(data.roles) ? data.roles : [] })
        }
      } catch {
        setMe(null)
      }
    }
    fetchMe()
  }, [])

  useEffect(() => {
    if (params.id) {
      fetchAudit()
      fetchChecklists()
      fetchDepartments()
      fetchUsers()
    }
  }, [params.id])

  useEffect(() => {
    if (params.id && audit?.status === 'ACTIVE' && audit?.checklistId) {
      fetchChecklistResponses()
    }
  }, [params.id, audit?.status, audit?.checklistId])

  const fetchOpeningAttendance = async () => {
    try {
      const res = await fetch(`/api/audits/${params.id}/meetings/attendance?meetingType=OPENING`)
      if (res.ok) {
        const data = await res.json()
        setOpeningAttendance(data)
      }
    } catch {
      setOpeningAttendance([])
    }
  }
  const fetchClosingAttendance = async () => {
    try {
      const res = await fetch(`/api/audits/${params.id}/meetings/attendance?meetingType=CLOSING`)
      if (res.ok) {
        const data = await res.json()
        setClosingAttendance(data)
      }
    } catch {
      setClosingAttendance([])
    }
  }
  useEffect(() => {
    if (params.id && audit?.status === 'ACTIVE' && activeTab === 'opening') {
      fetchOpeningAttendance()
    }
  }, [params.id, audit?.status, activeTab])
  useEffect(() => {
    if (params.id && (audit?.status === 'ACTIVE' || audit?.status === 'COMPLETED') && activeTab === 'closing') {
      fetchClosingAttendance()
    }
  }, [params.id, audit?.status, activeTab])
  useEffect(() => {
    if (audit && activeTab === 'closing') {
      setClosingNotesEdit(audit.closingMeetingNotes ?? '')
    }
  }, [activeTab, audit])

  const assignableUsers = useMemo(() => {
    if (!audit) return []
    if (audit.type === 'EXTERNAL') {
      const auditees = audit.Auditees ?? audit.auditees ?? []
      return auditees
        .filter((a: { userId?: string; User?: { id: string; firstName?: string; lastName?: string; email?: string } }) => a.userId && a.User)
        .map((a: { userId: string; User: { id: string; firstName?: string; lastName?: string; email?: string } }) => ({
          id: a.userId,
          firstName: a.User?.firstName ?? '',
          lastName: a.User?.lastName ?? '',
          email: a.User?.email ?? '',
        }))
    }
    return users
  }, [audit, users])

  const normalizeChecklistItems = (checklist: any): any[] => {
    if (!checklist) return []
    const raw =
      checklist.Items ??
      checklist.ChecklistItem ??
      checklist.items ??
      []
    return Array.isArray(raw) ? raw : []
  }

  const fetchAudit = async () => {
    try {
      const res = await fetch(`/api/audits/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setAudit(data)
        setUploadedFiles(data.documents || [])
        if (data.checklistId && data.Checklist) {
          setSelectedChecklist({
            ...data.Checklist,
            items: normalizeChecklistItems(data.Checklist),
          })
        } else if (data.checklistId) {
          fetchSelectedChecklist(data.checklistId)
        }
      }
    } catch (error) {
      console.error('Failed to fetch audit:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchChecklists = async () => {
    try {
      const res = await fetch('/api/checklists?isActive=true')
      if (res.ok) {
        const data = await res.json()
        setChecklists(data)
      }
    } catch (error) {
      console.error('Failed to fetch checklists:', error)
    }
  }

  const fetchSelectedChecklist = async (checklistId: string) => {
    try {
      const res = await fetch(`/api/checklists/${checklistId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedChecklist(data)
      }
    } catch (error) {
      console.error('Failed to fetch selected checklist:', error)
    }
  }

  const fetchChecklistResponses = async () => {
    try {
      const res = await fetch(`/api/audits/${params.id}/checklist/responses`)
      if (res.ok) {
        const data = await res.json()
        setChecklistResponses(data)
      }
    } catch (error) {
      console.error('Failed to fetch checklist responses:', error)
    }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments')
      if (res.ok) {
        const data = await res.json()
        setDepartments(data)
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const handleStartAudit = async () => {
    if (audit?.type !== 'ERP' && !audit?.checklistId) {
      alert('Please select a checklist before starting the audit')
      return
    }

    try {
      const res = await fetch(`/api/audits/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })

      if (res.ok) {
        fetchAudit()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to start audit')
      }
    } catch (error) {
      console.error('Failed to start audit:', error)
      alert('Failed to start audit')
    }
  }

  const handleChecklistChange = async (checklistId: string) => {
    if (checklistId === 'none') {
      checklistId = ''
    }
    setSavingChecklist(true)
    try {
      const res = await fetch(`/api/audits/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistId: checklistId || null }),
      })

      if (res.ok) {
        const updatedAudit = await res.json()
        setAudit(updatedAudit)
        if (checklistId && updatedAudit.Checklist) {
          setSelectedChecklist({
            ...updatedAudit.Checklist,
            items: normalizeChecklistItems(updatedAudit.Checklist),
          })
        } else if (checklistId) {
          await fetchSelectedChecklist(checklistId)
        } else {
          setSelectedChecklist(null)
        }
      } else {
        alert('Failed to update checklist selection')
      }
    } catch (error) {
      console.error('Failed to update checklist:', error)
      alert('Failed to update checklist selection')
    } finally {
      setSavingChecklist(false)
    }
  }

  const handleFileUpload = async (file: any) => {
    try {
      // Save file reference to database
      const res = await fetch(`/api/audits/${params.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.fileName,
          fileUrl: file.fileUrl,
          fileType: file.fileType,
          fileSize: file.fileSize,
        }),
      })

      if (res.ok) {
        const newDoc = await res.json()
        setUploadedFiles([...uploadedFiles, newDoc])
        fetchAudit() // Refresh audit data
      }
    } catch (error) {
      console.error('Failed to save file reference:', error)
    }
  }

  const handleExportPDF = () => {
    if (!audit) return

    const auditStart = audit.startDate ?? audit.scheduledDate
    const auditEnd = audit.endDate ?? audit.scheduledDate
    const reportData = {
      auditNumber: audit.auditNumber,
      title: audit.title,
      department: audit.department?.name || 'N/A',
      base: audit.base,
      scheduledDate: auditStart === auditEnd ? formatDate(auditStart) : `${formatDate(auditStart)} – ${formatDate(auditEnd)}`,
      status: audit.status,
      scope: audit.scope,
      description: audit.description,
      auditors: (audit.Auditors ?? audit.auditors ?? []).map((a: any) =>
        a.Organization?.name ?? a.organization?.name
          ? (a.Organization ?? a.organization).name
          : a.User ?? a.user
            ? `${(a.User ?? a.user).firstName} ${(a.User ?? a.user).lastName}`
            : '—'
      ),
      auditees: (audit.Auditees ?? audit.auditees ?? []).map((a: any) =>
        a.Organization?.name ?? a.organization?.name
          ? (a.Organization ?? a.organization).name
          : a.User ?? a.user
            ? `${(a.User ?? a.user).firstName} ${(a.User ?? a.user).lastName}`
            : a.name || a.email || '—'
      ),
      findings: (audit.Findings ?? audit.findings)?.map((f: any) => ({
        findingNumber: f.findingNumber,
        description: f.description,
        severity: f.severity,
        status: f.status,
      })) || [],
    }

    downloadAuditReportPDF(reportData)
  }

  const handleRescheduleSubmit = async () => {
    if (!audit) return
    const start = rescheduleForm.startDate
      ? new Date(rescheduleForm.startDate + 'T00:00:00').toISOString()
      : undefined
    const end = rescheduleForm.endDate
      ? new Date(rescheduleForm.endDate + 'T23:59:59').toISOString()
      : undefined
    if (rescheduleForm.startDate && rescheduleForm.endDate && rescheduleForm.endDate < rescheduleForm.startDate) {
      alert('End date must be on or after start date')
      return
    }
    setSavingReschedule(true)
    try {
      const res = await fetch(`/api/audits/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          openingMeetingAt: rescheduleForm.openingMeetingAt || null,
          closingMeetingAt: rescheduleForm.closingMeetingAt || null,
          scheduleNotes: rescheduleForm.scheduleNotes || null,
        }),
      })
      if (res.ok) {
        setRescheduleOpen(false)
        fetchAudit()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to update schedule')
      }
    } catch (e) {
      console.error(e)
      alert('Failed to update schedule')
    } finally {
      setSavingReschedule(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED':
        return 'bg-blue-100 text-blue-800'
      case 'ACTIVE':
        return 'bg-orange-100 text-orange-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-8">
          <p>Loading...</p>
        </div>
      </MainLayout>
    )
  }

  if (!audit) {
    return (
      <MainLayout>
        <div className="p-8">
          <p>Audit not found</p>
        </div>
      </MainLayout>
    )
  }

  const isERP = audit.type === 'ERP'
  const auditorUserIds = (audit.Auditors ?? audit.auditors ?? []).map(
    (a: { userId?: string; User?: { id: string } }) => a.userId ?? a.User?.id
  )
  const canEditAudit =
    me &&
    (isAdminOrQM(me.roles) || (me.roles.some((r) => r === 'AUDITOR') && auditorUserIds.includes(me.id)))

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-6">
          <Link href="/audits">
            <Button variant="ghost" className="mb-4">
              ← Back to Audits
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{audit.title}</h1>
              <p className="text-muted-foreground mt-2">
                {audit.auditNumber}
                {audit.department?.name && ` • ${audit.department.name}`}
                {audit.base && ` • ${audit.base}`}
                {isERP && (
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    (ERP – upload report only)
                  </span>
                )}
              </p>
            </div>
            <Badge className={getStatusColor(audit.status)}>
              {audit.status}
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {!isERP && (
              <TabsTrigger value="schedule">Audit Schedule</TabsTrigger>
            )}
            {!isERP && (
              <>
                {audit.status === 'ACTIVE' && (
                  <TabsTrigger value="opening">Opening Meeting</TabsTrigger>
                )}
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                {audit.status === 'ACTIVE' && (
                  <TabsTrigger value="execution">Execution</TabsTrigger>
                )}
                <TabsTrigger value="findings">Findings</TabsTrigger>
                {(audit.status === 'ACTIVE' || audit.status === 'COMPLETED') && (
                  <TabsTrigger value="closing">Closing Meeting</TabsTrigger>
                )}
              </>
            )}
            <TabsTrigger value="team">Team</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {isERP && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium">
                    ERP – No checklist or findings. Upload the report when complete, then mark the audit as Complete.
                  </p>
                </CardContent>
              </Card>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Audit Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Schedule</p>
                    <p className="font-medium">
                      {audit.startDate && audit.endDate
                        ? (() => {
                            const start = formatDate(audit.startDate)
                            const end = formatDate(audit.endDate)
                            return start === end ? start : `${start} – ${end}`
                          })()
                        : formatDate(audit.scheduledDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Scope</p>
                    <p className="font-medium">{audit.scope}</p>
                  </div>
                  {audit.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="font-medium">{audit.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!isERP && (
                    <Button className="w-full" variant="outline" onClick={handleExportPDF}>
                      <Download className="mr-2 h-4 w-4" />
                      Export PDF Report
                    </Button>
                  )}
                  {audit.status === 'PLANNED' && canEditAudit && (
                    <Button className="w-full" variant="default" onClick={handleStartAudit}>
                      {isERP ? 'Start' : 'Start Audit'}
                    </Button>
                  )}
                  {audit.status === 'ACTIVE' && canEditAudit && (
                    <Button className="w-full" variant="default">
                      Complete Audit
                    </Button>
                  )}
                  {(audit.status === 'PLANNED' || audit.status === 'ACTIVE') && canEditAudit && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        const start = audit.startDate ?? audit.scheduledDate
                        const end = audit.endDate ?? audit.scheduledDate
                        const toLocalDatetime = (d: string | undefined) => {
                          if (!d) return ''
                          const date = new Date(d)
                          const y = date.getFullYear()
                          const m = String(date.getMonth() + 1).padStart(2, '0')
                          const day = String(date.getDate()).padStart(2, '0')
                          const h = String(date.getHours()).padStart(2, '0')
                          const min = String(date.getMinutes()).padStart(2, '0')
                          return `${y}-${m}-${day}T${h}:${min}`
                        }
                        setRescheduleForm({
                          startDate: start ? formatDate(start) : '',
                          endDate: end ? formatDate(end) : '',
                          openingMeetingAt: audit.openingMeetingAt ? toLocalDatetime(audit.openingMeetingAt) : '',
                          closingMeetingAt: audit.closingMeetingAt ? toLocalDatetime(audit.closingMeetingAt) : '',
                          scheduleNotes: audit.scheduleNotes ?? '',
                        })
                        setRescheduleOpen(true)
                      }}
                    >
                      Reschedule
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {!isERP && (
          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Audit Schedule</CardTitle>
                  {audit.status === 'PLANNED' && canEditAudit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const start = audit.startDate ?? audit.scheduledDate
                        const end = audit.endDate ?? audit.scheduledDate
                        const toLocalDatetime = (d: string | undefined) => {
                          if (!d) return ''
                          const date = new Date(d)
                          const y = date.getFullYear()
                          const m = String(date.getMonth() + 1).padStart(2, '0')
                          const day = String(date.getDate()).padStart(2, '0')
                          const h = String(date.getHours()).padStart(2, '0')
                          const min = String(date.getMinutes()).padStart(2, '0')
                          return `${y}-${m}-${day}T${h}:${min}`
                        }
                        setRescheduleForm({
                          startDate: start ? formatDate(start) : '',
                          endDate: end ? formatDate(end) : '',
                          openingMeetingAt: audit.openingMeetingAt ? toLocalDatetime(audit.openingMeetingAt) : '',
                          closingMeetingAt: audit.closingMeetingAt ? toLocalDatetime(audit.closingMeetingAt) : '',
                          scheduleNotes: audit.scheduleNotes ?? '',
                        })
                        setRescheduleOpen(true)
                      }}
                    >
                      Edit schedule
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Opening meeting</p>
                    <p className="font-medium">
                      {audit.openingMeetingAt
                        ? formatDateTime(audit.openingMeetingAt)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Closing meeting</p>
                    <p className="font-medium">
                      {audit.closingMeetingAt
                        ? formatDateTime(audit.closingMeetingAt)
                        : '—'}
                    </p>
                  </div>
                </div>
                {audit.scheduleNotes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Schedule notes</p>
                    <p className="font-medium whitespace-pre-wrap">{audit.scheduleNotes}</p>
                  </div>
                )}
                {!audit.openingMeetingAt && !audit.closingMeetingAt && !audit.scheduleNotes && (
                  <p className="text-sm text-muted-foreground">
                    No schedule details yet. Use Edit schedule or Reschedule from Overview to add opening/closing meeting times and notes.
                  </p>
                )}
                {audit.status === 'PLANNED' && canEditAudit && (
                  <Button
                    className="w-full mt-4"
                    variant="secondary"
                    disabled={sendingToAuditee}
                    onClick={async () => {
                      setSendingToAuditee(true)
                      try {
                        const res = await fetch(`/api/audits/${params.id}/send-to-auditee`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                        })
                        const data = await res.json().catch(() => ({}))
                        if (res.ok) {
                          alert(data.message ?? 'Checklist and schedule sent to auditees.')
                        } else {
                          alert(data.error ?? 'Failed to send')
                        }
                      } finally {
                        setSendingToAuditee(false)
                      }
                    }}
                  >
                    {sendingToAuditee ? 'Sending...' : 'Send checklist & schedule to auditee'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {!isERP && audit.status === 'ACTIVE' && (
          <TabsContent value="opening" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Opening meeting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {audit.openingMeetingAt
                    ? formatDateTime(audit.openingMeetingAt)
                    : 'Date/time not set — update in Audit Schedule.'}
                </p>
                <div>
                  <p className="text-sm font-medium mb-2">Attendance</p>
                  <MeetingAttendanceList
                    auditId={params.id as string}
                    meetingType="OPENING"
                    attendance={openingAttendance}
                    canEdit={canEditAudit}
                    onRefresh={fetchOpeningAttendance}
                    meId={me?.id}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {!isERP && (audit.status === 'ACTIVE' || audit.status === 'COMPLETED') && (
          <TabsContent value="closing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Closing meeting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {audit.closingMeetingAt
                    ? formatDateTime(audit.closingMeetingAt)
                    : 'Date/time not set — update in Audit Schedule.'}
                </p>
                <div>
                  <p className="text-sm font-medium mb-2">Findings summary</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    {(audit.Findings ?? audit.findings)?.length > 0
                      ? `${(audit.Findings ?? audit.findings).length} finding(s). See Findings tab for details.`
                      : 'No findings recorded.'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Closing meeting notes</p>
                  {canEditAudit ? (
                    <div className="space-y-2">
                      <Textarea
                        value={closingNotesEdit}
                        placeholder="Discussion summary, action items..."
                        className="min-h-[100px]"
                        onChange={(e) => setClosingNotesEdit(e.target.value)}
                      />
                      <Button
                        size="sm"
                        disabled={savingClosingNotes}
                        onClick={async () => {
                          setSavingClosingNotes(true)
                          try {
                            const res = await fetch(`/api/audits/${params.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ closingMeetingNotes: closingNotesEdit.trim() || null }),
                            })
                            if (res.ok) fetchAudit()
                          } finally {
                            setSavingClosingNotes(false)
                          }
                        }}
                      >
                        {savingClosingNotes ? 'Saving...' : 'Save notes'}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{audit.closingMeetingNotes || '—'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Attendance</p>
                  <MeetingAttendanceList
                    auditId={params.id as string}
                    meetingType="CLOSING"
                    attendance={closingAttendance}
                    canEdit={canEditAudit}
                    onRefresh={fetchClosingAttendance}
                    meId={me?.id}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {!isERP && (
          <TabsContent value="checklist" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Checklist</CardTitle>
                  {canEditAudit && (
                    <Link href="/checklists">
                      <Button variant="outline" size="sm">
                        Manage Checklists
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="checklist-select">Select Checklist for This Audit</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose a checklist template to use for this audit. You can manage checklists in the{' '}
                    <Link href="/checklists" className="text-primary underline">
                      Checklists
                    </Link>{' '}
                    section.
                  </p>
                  <Select
                    value={audit?.checklistId || 'none'}
                    onValueChange={handleChecklistChange}
                    disabled={savingChecklist || !canEditAudit}
                  >
                    <SelectTrigger id="checklist-select" className="w-full">
                      <SelectValue placeholder="Select a checklist" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Checklist</SelectItem>
                      {checklists.map((checklist) => (
                        <SelectItem key={checklist.id} value={checklist.id}>
                          {checklist.name}
                          {checklist.type && ` (${checklist.type})`}
                          {checklist.version && ` - v${checklist.version}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {savingChecklist && (
                    <p className="text-sm text-muted-foreground">Saving checklist selection...</p>
                  )}
                </div>

                {selectedChecklist && (
                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <h3 className="font-semibold mb-2">{selectedChecklist.name}</h3>
                      {selectedChecklist.description && (
                        <p className="text-sm text-muted-foreground mb-4">
                          {selectedChecklist.description}
                        </p>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium border border-border w-24">
                              {selectedChecklist.checklistType === 'External' ? 'Checklist ID' : 'Ref'}
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-medium border border-border w-1/3">Audit Question / Check Item</th>
                            <th className="px-4 py-2 text-left text-sm font-medium border border-border w-1/3">Compliance Criteria</th>
                            {selectedChecklist.checklistType === 'External' && (
                              <th className="px-4 py-2 text-left text-sm font-medium border border-border w-32">Doc Ref</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedChecklist.items ?? selectedChecklist.Items ?? []).length > 0 ? (
                            (selectedChecklist.items ?? selectedChecklist.Items ?? []).map((item: any, index: number) => (
                              item.type === 'title' ? (
                                <tr key={item.id} className="bg-muted/30">
                                  <td colSpan={selectedChecklist.checklistType === 'External' ? 4 : 3} className="px-4 py-2 border border-border font-semibold">
                                    {item.content}
                                  </td>
                                </tr>
                              ) : (
                                <tr key={item.id} className="hover:bg-muted/50">
                                  <td className="px-4 py-2 border border-border">{item.ref || '-'}</td>
                                  <td className="px-4 py-2 border border-border">{item.auditQuestion || '-'}</td>
                                  <td className="px-4 py-2 border border-border">{item.complianceCriteria || '-'}</td>
                                  {selectedChecklist.checklistType === 'External' && (
                                    <td className="px-4 py-2 border border-border">{item.docRef || '-'}</td>
                                  )}
                                </tr>
                              )
                            ))
                          ) : (
                            <tr>
                              <td colSpan={selectedChecklist.checklistType === 'External' ? 4 : 3} className="px-4 py-8 text-center text-muted-foreground border border-border">
                                This checklist has no items.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!selectedChecklist && audit?.checklistId === null && (
                  <div className="py-8 text-center text-muted-foreground border rounded-lg">
                    <p>No checklist selected for this audit.</p>
                    <p className="text-sm mt-2">
                      Select a checklist from the dropdown above or create a new one in{' '}
                      <Link href="/checklists" className="text-primary underline">
                        Checklists
                      </Link>
                      .
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {!isERP && audit.status === 'ACTIVE' && selectedChecklist && (
            <TabsContent value="execution" className="space-y-4">
              <AuditExecution
                auditId={params.id as string}
                checklistItems={selectedChecklist.items ?? selectedChecklist.Items ?? []}
                responses={checklistResponses}
                onResponseUpdate={() => {
                  fetchChecklistResponses()
                  fetchAudit()
                }}
                activeTab={activeTab}
                departments={departments}
                users={assignableUsers}
              />
            </TabsContent>
          )}

          {!isERP && (
          <TabsContent value="findings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Findings</CardTitle>
              </CardHeader>
              <CardContent>
                {(audit.Findings ?? audit.findings)?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium border border-border">Finding</th>
                          <th className="px-3 py-2 text-left font-medium border border-border">Root Cause</th>
                          <th className="px-3 py-2 text-left font-medium border border-border">Root Cause Due Date</th>
                          <th className="px-3 py-2 text-left font-medium border border-border">Root Cause Entered</th>
                          <th className="px-3 py-2 text-left font-medium border border-border">CAP</th>
                          <th className="px-3 py-2 text-left font-medium border border-border">CAP Due Date</th>
                          <th className="px-3 py-2 text-left font-medium border border-border">CAP Entered</th>
                          <th className="px-3 py-2 text-left font-medium border border-border">CAT</th>
                          <th className="px-3 py-2 text-left font-medium border border-border">CAT Due Date</th>
                          <th className="px-3 py-2 text-left font-medium border border-border">CAT Entered</th>
                          <th className="px-3 py-2 text-left font-medium border border-border">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(audit.Findings ?? audit.findings ?? []).map((finding: any) => {
                          const correctiveAction = getCorrectiveAction(finding)
                          const rootCauseDue = finding.capDueDate ?? correctiveAction?.dueDate ?? null
                          const catSubmitted = Boolean((correctiveAction?.correctiveActionTaken ?? '').toString().trim())
                          return (
                            <tr key={finding.id} className="hover:bg-muted/50">
                              <td className="px-3 py-2 border border-border align-top">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">{finding.findingNumber}</span>
                                    {finding.status && (
                                      <Badge variant="outline" className="text-[11px]">
                                        {finding.status}
                                      </Badge>
                                    )}
                                    {finding.severity && (
                                      <Badge variant="destructive" className="text-[11px]">
                                        {finding.severity}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {finding.description}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Assigned to:{' '}
                                    {finding.AssignedTo?.firstName || finding.assignedTo?.firstName}{' '}
                                    {finding.AssignedTo?.lastName || finding.assignedTo?.lastName}
                                  </p>
                                </div>
                              </td>
                              <td className="px-3 py-2 border border-border align-top">
                                {finding.rootCause || '—'}
                              </td>
                              <td className="px-3 py-2 border border-border align-top">
                                {rootCauseDue ? formatDate(rootCauseDue) : '—'}
                              </td>
                              <td className="px-3 py-2 border border-border align-top">
                                {finding.rootCause && finding.updatedAt
                                  ? formatDate(finding.updatedAt)
                                  : '—'}
                              </td>
                              <td className="px-3 py-2 border border-border align-top">
                                {correctiveAction?.actionPlan != null ? String(correctiveAction.actionPlan) : '—'}
                              </td>
                              <td className="px-3 py-2 border border-border align-top">
                                {rootCauseDue ? formatDate(rootCauseDue) : '—'}
                              </td>
                              <td className="px-3 py-2 border border-border align-top">
                                {correctiveAction?.createdAt ? formatDateTime(correctiveAction.createdAt as string) : '—'}
                              </td>
                              <td className="px-3 py-2 border border-border align-top">
                                {correctiveAction?.correctiveActionTaken ? (
                                  <span className="line-clamp-2" title={String(correctiveAction.correctiveActionTaken)}>
                                    {String(correctiveAction.correctiveActionTaken)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-2 border border-border align-top">
                                {finding.closeOutDueDate ? formatDate(finding.closeOutDueDate) : '—'}
                              </td>
                              <td className="px-3 py-2 border border-border align-top">
                                {catSubmitted ? (
                                  <span className="text-green-600 font-medium" title="Corrective action taken submitted">
                                    ✓ {correctiveAction?.updatedAt ? formatDateTime(correctiveAction.updatedAt as string) : ''}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-2 border border-border align-top">
                                <Link href={`/findings/${finding.id}`}>
                                  <Button variant="ghost" size="sm">
                                    View
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No findings recorded</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}

          <TabsContent value="team" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Auditors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(audit.Auditors ?? audit.auditors ?? []).map((auditor: any) => {
                      const isOrg = auditor.Organization ?? auditor.organization
                      const user = auditor.User ?? auditor.user
                      return (
                        <div
                          key={auditor.id}
                          className="flex items-center gap-3 p-2 border rounded-lg"
                        >
                          <div className="flex-1">
                            {isOrg ? (
                              <>
                                <p className="font-medium">{isOrg.name}</p>
                                {(isOrg.type || isOrg.contact || isOrg.address) && (
                                  <p className="text-sm text-muted-foreground">
                                    {[isOrg.type, isOrg.contact, isOrg.address]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </p>
                                )}
                              </>
                            ) : user ? (
                              <>
                                <p className="font-medium">
                                  {user.firstName} {user.lastName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {user.email}
                                </p>
                              </>
                            ) : null}
                          </div>
                          {auditor.role && (
                            <Badge variant="secondary">{auditor.role}</Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Auditees</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(audit.Auditees ?? audit.auditees ?? []).map((auditee: any) => {
                      const isOrg = auditee.Organization ?? auditee.organization
                      const user = auditee.User ?? auditee.user
                      return (
                        <div
                          key={auditee.id}
                          className="flex items-center gap-3 p-2 border rounded-lg"
                        >
                          <div className="flex-1">
                            {isOrg ? (
                              <>
                                <p className="font-medium">{isOrg.name}</p>
                                {(isOrg.type || isOrg.contact || isOrg.address) && (
                                  <p className="text-sm text-muted-foreground">
                                    {[isOrg.type, isOrg.contact, isOrg.address]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </p>
                                )}
                              </>
                            ) : user ? (
                              <>
                                <p className="font-medium">
                                  {user.firstName} {user.lastName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {user.email}
                                </p>
                              </>
                            ) : (
                              (auditee.name || auditee.email) && (
                                <>
                                  <p className="font-medium">{auditee.name}</p>
                                  {auditee.email && (
                                    <p className="text-sm text-muted-foreground">
                                      {auditee.email}
                                    </p>
                                  )}
                                </>
                              )
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reschedule audit</DialogTitle>
              <DialogDescription>
                Update audit period and opening/closing meeting times.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reschedule-startDate">Start date</Label>
                  <Input
                    id="reschedule-startDate"
                    type="date"
                    value={rescheduleForm.startDate}
                    onChange={(e) =>
                      setRescheduleForm((f) => ({ ...f, startDate: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reschedule-endDate">End date</Label>
                  <Input
                    id="reschedule-endDate"
                    type="date"
                    value={rescheduleForm.endDate}
                    onChange={(e) =>
                      setRescheduleForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reschedule-opening">Opening meeting</Label>
                <Input
                  id="reschedule-opening"
                  type="datetime-local"
                  value={rescheduleForm.openingMeetingAt}
                  onChange={(e) =>
                    setRescheduleForm((f) => ({ ...f, openingMeetingAt: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reschedule-closing">Closing meeting</Label>
                <Input
                  id="reschedule-closing"
                  type="datetime-local"
                  value={rescheduleForm.closingMeetingAt}
                  onChange={(e) =>
                    setRescheduleForm((f) => ({ ...f, closingMeetingAt: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reschedule-notes">Schedule notes</Label>
                <Textarea
                  id="reschedule-notes"
                  value={rescheduleForm.scheduleNotes}
                  onChange={(e) =>
                    setRescheduleForm((f) => ({ ...f, scheduleNotes: e.target.value }))
                  }
                  placeholder="Process steps, agenda..."
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setRescheduleOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRescheduleSubmit} disabled={savingReschedule}>
                  {savingReschedule ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

export default AuditDetailPage
