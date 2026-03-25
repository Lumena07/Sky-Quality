'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Award, Briefcase, Building2, ExternalLink, GraduationCap, Mail, Search, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { canManageSmsPersonnel } from '@/lib/sms-permissions'
import { canSeeSmsSafetyRegister } from '@/lib/permissions'
import { formatDate } from '@/lib/utils'

type QualificationRow = {
  id: string
  qualification_name: string
  awarding_body: string | null
  date_obtained: string | null
  expiry_date: string | null
  certificate_url: string | null
}

type TrainingRow = {
  id: string
  course_name: string
  provider: string | null
  delivery_method: string | null
  completed_at: string | null
  expiry_date: string | null
  certificate_url: string | null
  training_type: string | null
}

type RegulatoryRow = {
  id: string
  notified_at: string
  authority_name: string
  method: string | null
  reference_number: string | null
}

type PersonnelCore = {
  id: string
  user_id: string
  post_holder_type: string
  operational_area: string | null
  appointment_letter_url: string | null
  appointment_date: string | null
}

type RegisterUser = {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  position: string | null
  departmentId: string | null
  departmentName: string | null
  roles: string[]
  personnel: PersonnelCore | null
  qualifications: QualificationRow[]
  training: TrainingRow[]
  regulatoryNotifications: RegulatoryRow[]
  _computed_currency: 'CURRENT' | 'EXPIRING' | 'EXPIRED'
}

type RegisterSectionId = 'am' | 'dos' | 'so' | 'other'

const ROLE_LABELS: Record<string, string> = {
  ACCOUNTABLE_MANAGER: 'Accountable Manager',
  DIRECTOR_OF_SAFETY: 'Director of Safety',
  SAFETY_OFFICER: 'Safety Officer',
  DEPARTMENT_HEAD: 'Department Head',
  STAFF: 'Staff',
}

const formatRoleLabel = (role: string) => ROLE_LABELS[role] ?? role.replace(/_/g, ' ')

const getSection = (u: RegisterUser): RegisterSectionId => {
  if (u.roles.includes('ACCOUNTABLE_MANAGER')) return 'am'
  if (u.roles.includes('DIRECTOR_OF_SAFETY')) return 'dos'
  if (u.roles.includes('SAFETY_OFFICER')) return 'so'
  return 'other'
}

const REGISTER_SECTIONS: { id: RegisterSectionId; title: string; description: string }[] = [
  { id: 'am', title: 'Accountable Managers', description: 'AM role' },
  { id: 'dos', title: 'Director of Safety', description: 'DoS role' },
  { id: 'so', title: 'Safety Officers', description: 'Safety Officer role' },
  { id: 'other', title: 'Other safety staff', description: 'Safety department members without main post-holder role' },
]

const OPER_AREAS = [
  { value: 'airline_ops', label: 'Airline Ops' },
  { value: 'mro_maintenance', label: 'MRO-Maintenance' },
  { value: 'airport_ground_ops', label: 'Airport-Ground Ops' },
  { value: 'other', label: 'Other' },
] as const

const trainingTypes = [
  { value: 'INITIAL_SMS', label: 'Initial SMS' },
  { value: 'RECURRENT_SMS', label: 'Recurrent SMS' },
  { value: 'INVESTIGATION', label: 'Investigation' },
  { value: 'RISK_MANAGEMENT', label: 'Risk Management' },
  { value: 'EMERGENCY_RESPONSE', label: 'Emergency Response' },
  { value: 'CPD', label: 'Continuing Professional Development' },
  { value: 'OTHER', label: 'Other' },
] as const

const currencyBadge = (c: RegisterUser['_computed_currency']) => {
  if (c === 'EXPIRED') return <Badge variant="destructive">Expired</Badge>
  if (c === 'EXPIRING') return <Badge variant="secondary">Expiring within 60 days</Badge>
  return (
    <Badge variant="outline" className="border-green-500/50 text-green-700 dark:text-green-400">
      Current
    </Badge>
  )
}

const inferPostType = (roles: string[]) => {
  if (roles.includes('ACCOUNTABLE_MANAGER')) return 'ACCOUNTABLE_MANAGER'
  if (roles.includes('DIRECTOR_OF_SAFETY')) return 'DIRECTOR_OF_SAFETY'
  return 'SAFETY_OFFICER'
}

const SmsPersonnelPage = () => {
  const [roles, setRoles] = useState<string[]>([])
  const [meChecked, setMeChecked] = useState(false)
  const [users, setUsers] = useState<RegisterUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [gaps, setGaps] = useState<string[]>([])
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [coverageError, setCoverageError] = useState<string | null>(null)

  const manage = canManageSmsPersonnel(roles)

  const loadRegister = useCallback(async () => {
    const res = await fetch('/api/sms/personnel/register', { credentials: 'same-origin' })
    if (!res.ok) {
      setUsers([])
      const body = await res.json().catch(() => ({}))
      setRegisterError(
        typeof (body as { error?: string }).error === 'string'
          ? (body as { error: string }).error
          : `Could not load register (${res.status})`
      )
      return
    }
    setRegisterError(null)
    const data = await res.json()
    setUsers(Array.isArray(data.users) ? data.users : [])
  }, [])

  const loadCoverage = useCallback(async () => {
    if (!manage) return
    const res = await fetch('/api/sms/personnel/coverage', { credentials: 'same-origin' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setCoverageError(
        typeof (body as { error?: string }).error === 'string'
          ? (body as { error: string }).error
          : `Coverage check failed (${res.status})`
      )
      return
    }
    setCoverageError(null)
    const data = await res.json()
    setGaps(Array.isArray(data.gaps) ? data.gaps : [])
  }, [manage])

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          const userRoles = Array.isArray(data.roles) ? data.roles : []
          setRoles(userRoles)
        }
      } finally {
        setMeChecked(true)
      }
    }
    void fetchMe()
  }, [])

  useEffect(() => {
    if (!meChecked || !canSeeSmsSafetyRegister(roles)) {
      setLoading(false)
      return
    }
    const run = async () => {
      setLoading(true)
      setRegisterError(null)
      setCoverageError(null)
      await Promise.all([loadRegister(), loadCoverage()])
      setLoading(false)
    }
    void run()
  }, [meChecked, roles, loadRegister, loadCoverage])

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase()
      const email = (u.email ?? '').toLowerCase()
      const position = (u.position ?? '').toLowerCase()
      const dept = (u.departmentName ?? '').toLowerCase()
      return (
        name.includes(q) ||
        email.includes(q) ||
        position.includes(q) ||
        dept.includes(q) ||
        u.roles.some((r) => formatRoleLabel(r).toLowerCase().includes(q))
      )
    })
  }, [users, searchQuery])

  const grouped = useMemo(() => {
    const buckets: Record<RegisterSectionId, RegisterUser[]> = { am: [], dos: [], so: [], other: [] }
    for (const u of filteredUsers) buckets[getSection(u)].push(u)
    return buckets
  }, [filteredUsers])

  if (!meChecked) {
    return (
      <div className="p-8">
        <div className="h-56 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  if (!canSeeSmsSafetyRegister(roles)) {
    return <div className="p-8 text-sm text-muted-foreground">You do not have access to Safety personnel register.</div>
  }

  return (
    <div className="space-y-8 p-8">
      <header>
        <div className="flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" aria-hidden />
          <h1 className="text-3xl font-bold">Safety personnel register</h1>
        </div>
      </header>

      {registerError ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Could not load personnel</CardTitle>
            <CardDescription>{registerError}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {manage && coverageError ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Coverage check failed</CardTitle>
            <CardDescription>{coverageError}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {manage && gaps.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">Safety Officer coverage gaps</CardTitle>
            <CardDescription>
              No active Safety Officer for: {gaps.join(', ')}.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          placeholder="Search by name, email, role, department…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          aria-label="Search safety personnel"
        />
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      ) : filteredUsers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No personnel found.</p>
      ) : (
        <div className="space-y-10">
          {REGISTER_SECTIONS.map((section) => {
            const people = grouped[section.id]
            if (people.length === 0) return null
            return (
              <section key={section.id} className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {section.description} ({people.length})
                  </p>
                </div>
                <div className="space-y-6">
                  {people.map((person) => (
                    <PersonnelPersonCard
                      key={person.id}
                      person={person}
                      canManage={manage}
                      onChanged={async () => {
                        await Promise.all([loadRegister(), loadCoverage()])
                      }}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

const PersonnelPersonCard = ({
  person,
  canManage,
  onChanged,
}: {
  person: RegisterUser
  canManage: boolean
  onChanged: () => Promise<void>
}) => {
  const displayName = [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || person.email || person.id
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)

  const [qualName, setQualName] = useState('')
  const [qualBody, setQualBody] = useState('')
  const [qualExpiry, setQualExpiry] = useState('')
  const [qualDateObtained, setQualDateObtained] = useState('')
  const [qualFile, setQualFile] = useState<File | null>(null)

  const [courseName, setCourseName] = useState('')
  const [courseProvider, setCourseProvider] = useState('')
  const [courseMethod, setCourseMethod] = useState('classroom')
  const [courseCompleted, setCourseCompleted] = useState('')
  const [courseExpiry, setCourseExpiry] = useState('')
  const [courseType, setCourseType] = useState('INITIAL_SMS')
  const [courseFile, setCourseFile] = useState<File | null>(null)

  const [appointmentDate, setAppointmentDate] = useState(person.personnel?.appointment_date?.slice(0, 10) ?? '')
  const [operArea, setOperArea] = useState(person.personnel?.operational_area ?? 'other')
  const [appointmentFile, setAppointmentFile] = useState<File | null>(null)

  const [regDate, setRegDate] = useState('')
  const [regAuthority, setRegAuthority] = useState('')
  const [regMethod, setRegMethod] = useState('')
  const [regRef, setRegRef] = useState('')

  const ensurePersonnel = async (): Promise<PersonnelCore | null> => {
    if (person.personnel) return person.personnel

    const inferred = inferPostType(person.roles)
    const body: Record<string, unknown> = {
      userId: person.id,
      postHolderType: inferred,
      appointmentDate: appointmentDate || null,
      operationalArea: inferred === 'SAFETY_OFFICER' ? operArea : null,
    }

    const res = await fetch('/api/sms/personnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      alert((e as { error?: string }).error ?? 'Failed to create personnel record')
      return null
    }
    return await res.json()
  }

  const uploadFile = async (file: File, entityType: 'sms-personnel') => {
    const form = new FormData()
    form.append('file', file)
    form.append('entityType', entityType)
    form.append('entityId', person.id)
    const up = await fetch('/api/upload', { method: 'POST', credentials: 'same-origin', body: form })
    if (!up.ok) return null
    const j = await up.json()
    return j.fileUrl as string
  }

  const statusFromExpiry = (expiryDate: string | null) => {
    if (!expiryDate) return 'none'
    const now = new Date()
    const exp = new Date(expiryDate)
    if (exp < now) return 'expired'
    const in60 = new Date()
    in60.setDate(in60.getDate() + 60)
    if (exp <= in60) return 'expiring'
    return 'valid'
  }

  const handleAddQualification = async () => {
    if (!canManage) return
    if (!qualName.trim()) {
      alert('Qualification name is required')
      return
    }
    setSaving(true)
    try {
      const p = await ensurePersonnel()
      if (!p) return
      let certificateUrl: string | null = null
      if (qualFile) certificateUrl = await uploadFile(qualFile, 'sms-personnel')

      const res = await fetch(`/api/sms/personnel/${p.id}/qualifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          qualificationName: qualName,
          awardingBody: qualBody || null,
          dateObtained: qualDateObtained || null,
          expiryDate: qualExpiry || null,
          certificateUrl,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? 'Failed to add qualification')
        return
      }
      setQualName('')
      setQualBody('')
      setQualDateObtained('')
      setQualExpiry('')
      setQualFile(null)
      await onChanged()
    } finally {
      setSaving(false)
    }
  }

  const handleAddTraining = async () => {
    if (!canManage) return
    if (!courseName.trim()) {
      alert('Course name is required')
      return
    }
    setSaving(true)
    try {
      const p = await ensurePersonnel()
      if (!p) return
      let certificateUrl: string | null = null
      if (courseFile) certificateUrl = await uploadFile(courseFile, 'sms-personnel')

      const res = await fetch(`/api/sms/personnel/${p.id}/training`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          courseName,
          provider: courseProvider || null,
          deliveryMethod: courseMethod,
          completedAt: courseCompleted || null,
          expiryDate: courseExpiry || null,
          trainingType: courseType,
          certificateUrl,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? 'Failed to add training')
        return
      }
      setCourseName('')
      setCourseProvider('')
      setCourseCompleted('')
      setCourseExpiry('')
      setCourseMethod('classroom')
      setCourseType('INITIAL_SMS')
      setCourseFile(null)
      await onChanged()
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAppointment = async () => {
    if (!canManage) return
    setSaving(true)
    try {
      const p = await ensurePersonnel()
      if (!p) return
      let appointmentLetterUrl: string | null | undefined = undefined
      if (appointmentFile) appointmentLetterUrl = await uploadFile(appointmentFile, 'sms-personnel')

      const res = await fetch(`/api/sms/personnel/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          appointmentDate: appointmentDate || null,
          appointmentLetterUrl,
          operationalArea: p.post_holder_type === 'SAFETY_OFFICER' ? operArea : null,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? 'Failed to save appointment')
        return
      }
      await onChanged()
    } finally {
      setSaving(false)
    }
  }

  const handleAddRegulatory = async () => {
    if (!canManage) return
    if (!regDate || !regAuthority.trim()) {
      alert('Notification date and authority name are required')
      return
    }
    setSaving(true)
    try {
      const p = await ensurePersonnel()
      if (!p) return
      const res = await fetch(`/api/sms/personnel/${p.id}/regulatory-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          notifiedAt: regDate,
          authorityName: regAuthority,
          method: regMethod || null,
          referenceNumber: regRef || null,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? 'Failed to add regulatory notification')
        return
      }
      setRegDate('')
      setRegAuthority('')
      setRegMethod('')
      setRegRef('')
      await onChanged()
    } finally {
      setSaving(false)
    }
  }

  const renderRecordTable = (
    rows: Array<QualificationRow | TrainingRow>,
    labelForName: (r: QualificationRow | TrainingRow) => string,
    completedKey: 'date_obtained' | 'completed_at',
    expiryKey: 'expiry_date',
    certKey: 'certificate_url',
    emptyMessage: string,
    ariaLabelPrefix: string,
  ) => (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">Name</th>
            <th className="px-3 py-2 text-left font-medium">Completed/Obtained</th>
            <th className="px-3 py-2 text-left font-medium">Expiry</th>
            <th className="px-3 py-2 text-left font-medium">Certificate</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{emptyMessage}</td>
            </tr>
          ) : (
            rows.map((row) => {
              const completed = (row as Record<string, string | null>)[completedKey]
              const expiry = (row as Record<string, string | null>)[expiryKey]
              const cert = (row as Record<string, string | null>)[certKey]
              const status = statusFromExpiry(expiry)
              return (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{labelForName(row)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{completed ? formatDate(completed) : '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{expiry ? formatDate(expiry) : '—'}</td>
                  <td className="px-3 py-2">
                    {cert ? (
                      <a
                        href={cert}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        aria-label={`${ariaLabelPrefix} certificate for ${labelForName(row)}`}
                      >
                        View <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {status === 'expired' && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" aria-hidden />Expired</Badge>}
                    {status === 'expiring' && <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" aria-hidden />Expiring soon</Badge>}
                    {status === 'valid' && <Badge variant="outline" className="border-green-500/50 text-green-700 dark:text-green-400">Valid</Badge>}
                    {status === 'none' && <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{displayName}</CardTitle>
            <CardDescription className="mt-2 flex flex-col gap-1">
              {person.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  <a href={`mailto:${person.email}`} className="text-primary hover:underline">{person.email}</a>
                </span>
              )}
              {person.position && <span className="inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" aria-hidden />{person.position}</span>}
              <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" aria-hidden />{person.departmentName ?? '—'}</span>
            </CardDescription>
          </div>
          <div className="space-y-2 text-right">
            <div className="flex flex-wrap justify-end gap-1.5" role="list" aria-label="Assigned roles">
              {person.roles.map((r) => <Badge key={r} variant="secondary" role="listitem">{formatRoleLabel(r)}</Badge>)}
            </div>
            <div>{currencyBadge(person._computed_currency)}</div>
            {person.personnel?.post_holder_type === 'SAFETY_OFFICER' && person.personnel.operational_area && (
              <p className="text-xs text-muted-foreground">Area: {person.personnel.operational_area}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        <section aria-labelledby={`qual-${person.id}`}>
          <h3 id={`qual-${person.id}`} className="mb-2 flex items-center gap-2 text-base font-semibold">
            <Award className="h-4 w-4" aria-hidden /> Qualifications ({person.qualifications.length})
          </h3>
          {renderRecordTable(
            person.qualifications,
            (r) => (r as QualificationRow).qualification_name,
            'date_obtained',
            'expiry_date',
            'certificate_url',
            'No qualification records.',
            'View qualification'
          )}
          {canManage && (
            <div className="mt-3 grid gap-2 rounded-md border p-3 md:grid-cols-2">
              <Input placeholder="Qualification name" value={qualName} onChange={(e) => setQualName(e.target.value)} />
              <Input placeholder="Awarding body" value={qualBody} onChange={(e) => setQualBody(e.target.value)} />
              <Input type="date" value={qualDateObtained} onChange={(e) => setQualDateObtained(e.target.value)} aria-label="Qualification obtained date" />
              <Input type="date" value={qualExpiry} onChange={(e) => setQualExpiry(e.target.value)} aria-label="Qualification expiry date" />
              <Input type="file" accept="application/pdf" onChange={(e) => setQualFile(e.target.files?.[0] ?? null)} aria-label="Qualification certificate" />
              <Button type="button" onClick={handleAddQualification} disabled={saving}>{saving ? 'Saving…' : 'Add qualification'}</Button>
            </div>
          )}
        </section>

        <section aria-labelledby={`training-${person.id}`}>
          <h3 id={`training-${person.id}`} className="mb-2 flex items-center gap-2 text-base font-semibold">
            <GraduationCap className="h-4 w-4" aria-hidden /> Training ({person.training.length})
          </h3>
          {renderRecordTable(
            person.training,
            (r) => (r as TrainingRow).course_name,
            'completed_at',
            'expiry_date',
            'certificate_url',
            'No training records.',
            'View training'
          )}
          {canManage && (
            <div className="mt-3 grid gap-2 rounded-md border p-3 md:grid-cols-2">
              <Input placeholder="Course name" value={courseName} onChange={(e) => setCourseName(e.target.value)} />
              <Input placeholder="Provider" value={courseProvider} onChange={(e) => setCourseProvider(e.target.value)} />
              <Select value={courseMethod} onValueChange={setCourseMethod}>
                <SelectTrigger aria-label="Delivery method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="classroom">Classroom</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="simulator">Simulator</SelectItem>
                </SelectContent>
              </Select>
              <Select value={courseType} onValueChange={setCourseType}>
                <SelectTrigger aria-label="Training type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {trainingTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={courseCompleted} onChange={(e) => setCourseCompleted(e.target.value)} aria-label="Course completed date" />
              <Input type="date" value={courseExpiry} onChange={(e) => setCourseExpiry(e.target.value)} aria-label="Course expiry date" />
              <Input type="file" accept="application/pdf" onChange={(e) => setCourseFile(e.target.files?.[0] ?? null)} aria-label="Training certificate" />
              <Button type="button" onClick={handleAddTraining} disabled={saving}>{saving ? 'Saving…' : 'Add training'}</Button>
            </div>
          )}
        </section>

        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide appointment and regulatory details' : 'Show appointment and regulatory details'}
          </Button>
        </div>

        {expanded && (
          <div className="space-y-6 rounded-md border p-4">
            <section className="space-y-3">
              <h3 className="text-base font-semibold">Appointment</h3>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label htmlFor={`appointment-${person.id}`}>Appointment date</Label>
                  <Input id={`appointment-${person.id}`} type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} />
                </div>
                {inferPostType(person.roles) === 'SAFETY_OFFICER' && (
                  <div>
                    <Label>Operational area</Label>
                    <Select value={operArea} onValueChange={setOperArea}>
                      <SelectTrigger aria-label="Operational area"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPER_AREAS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Input type="file" accept="application/pdf" onChange={(e) => setAppointmentFile(e.target.files?.[0] ?? null)} aria-label="Appointment letter" />
                <Button type="button" onClick={handleSaveAppointment} disabled={saving || !canManage}>{saving ? 'Saving…' : 'Save appointment details'}</Button>
              </div>
              {person.personnel?.appointment_letter_url && (
                <a className="text-sm text-primary hover:underline" href={person.personnel.appointment_letter_url} target="_blank" rel="noopener noreferrer">View current appointment letter</a>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold">Regulatory notification log</h3>
              <ul className="space-y-2 text-sm">
                {person.regulatoryNotifications.length === 0 ? (
                  <li className="text-muted-foreground">No regulatory notifications logged.</li>
                ) : (
                  person.regulatoryNotifications.map((r) => (
                    <li key={r.id} className="rounded border p-2">
                      <span className="font-medium">{r.authority_name}</span> · {formatDate(r.notified_at)} · {r.method ?? '—'} · {r.reference_number ?? '—'}
                    </li>
                  ))
                )}
              </ul>

              {canManage && (
                <div className="grid gap-2 rounded border p-3 md:grid-cols-2">
                  <Input type="date" value={regDate} onChange={(e) => setRegDate(e.target.value)} aria-label="Regulatory notified date" />
                  <Input placeholder="Authority name" value={regAuthority} onChange={(e) => setRegAuthority(e.target.value)} />
                  <Input placeholder="Method" value={regMethod} onChange={(e) => setRegMethod(e.target.value)} />
                  <Input placeholder="Reference number" value={regRef} onChange={(e) => setRegRef(e.target.value)} />
                  <Button type="button" className="md:col-span-2" onClick={handleAddRegulatory} disabled={saving}>{saving ? 'Saving…' : 'Add regulatory notification'}</Button>
                </div>
              )}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default SmsPersonnelPage
