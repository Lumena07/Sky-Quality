'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Search,
  GraduationCap,
  Award,
  ExternalLink,
  AlertTriangle,
  Mail,
  Briefcase,
  Building2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { canSeeQualityTeamRegister } from '@/lib/permissions'

type TrainingRecordRow = {
  id: string
  userId: string
  name: string
  recordType: string
  completedAt: string | null
  expiryDate: string | null
  documentUrl: string | null
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
  trainingRecords: TrainingRecordRow[]
}

const ROLE_LABELS: Record<string, string> = {
  QUALITY_MANAGER: 'Quality Manager',
  ACCOUNTABLE_MANAGER: 'Accountable Manager',
  AUDITOR: 'Auditor',
  DEPARTMENT_HEAD: 'Department Head',
  STAFF: 'Staff',
  FOCAL_PERSON: 'Focal Person',
}

const formatRoleLabel = (role: string): string =>
  ROLE_LABELS[role] ?? role.replace(/_/g, ' ')

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

const getStatus = (
  expiryDate: string | null
): 'valid' | 'expiring' | 'expired' | 'none' => {
  if (!expiryDate) return 'none'
  if (isExpired(expiryDate)) return 'expired'
  if (isExpiringSoon(expiryDate)) return 'expiring'
  return 'valid'
}

type RegisterSectionId = 'am' | 'qm' | 'auditor' | 'other'

const getRegisterSection = (u: RegisterUser): RegisterSectionId => {
  if (u.roles.includes('ACCOUNTABLE_MANAGER')) return 'am'
  if (u.roles.includes('QUALITY_MANAGER')) return 'qm'
  if (u.roles.includes('AUDITOR')) return 'auditor'
  return 'other'
}

const sortRegisterUsersByName = (a: RegisterUser, b: RegisterUser): number => {
  const ln = (a.lastName ?? '').localeCompare(b.lastName ?? '', undefined, {
    sensitivity: 'base',
  })
  if (ln !== 0) return ln
  return (a.firstName ?? '').localeCompare(b.firstName ?? '', undefined, {
    sensitivity: 'base',
  })
}

const REGISTER_SECTIONS: {
  id: RegisterSectionId
  title: string
  description: string
}[] = [
  {
    id: 'am',
    title: 'Accountable Managers',
    description: 'Accountable Manager role',
  },
  {
    id: 'qm',
    title: 'Quality Managers',
    description: 'Quality Manager role',
  },
  {
    id: 'auditor',
    title: 'Auditors',
    description: 'Auditor role',
  },
  {
    id: 'other',
    title: 'Other Quality department staff',
    description: 'Quality department members without AM, QM, or Auditor role',
  },
]

const QualityTeamPage = () => {
  const router = useRouter()
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [meChecked, setMeChecked] = useState(false)
  const [users, setUsers] = useState<RegisterUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          const roles = Array.isArray(data.roles) ? data.roles : []
          setUserRoles(roles)
          if (!canSeeQualityTeamRegister(roles)) {
            router.replace('/dashboard')
            return
          }
        }
      } catch {
        setUserRoles([])
      } finally {
        setMeChecked(true)
      }
    }
    fetchMe()
  }, [router])

  useEffect(() => {
    if (!meChecked || !canSeeQualityTeamRegister(userRoles)) return
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/quality-team/register', {
          credentials: 'same-origin',
        })
        if (res.ok) {
          const data = await res.json()
          setUsers(Array.isArray(data.users) ? data.users : [])
        } else {
          setUsers([])
        }
      } catch {
        setUsers([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [meChecked, userRoles])

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase()
      const email = (u.email ?? '').toLowerCase()
      const pos = (u.position ?? '').toLowerCase()
      const dept = (u.departmentName ?? '').toLowerCase()
      return (
        name.includes(q) ||
        email.includes(q) ||
        pos.includes(q) ||
        dept.includes(q) ||
        u.roles.some((r) => formatRoleLabel(r).toLowerCase().includes(q))
      )
    })
  }, [users, searchQuery])

  const usersBySection = useMemo(() => {
    const buckets: Record<RegisterSectionId, RegisterUser[]> = {
      am: [],
      qm: [],
      auditor: [],
      other: [],
    }
    for (const u of filteredUsers) {
      buckets[getRegisterSection(u)].push(u)
    }
    ;(Object.keys(buckets) as RegisterSectionId[]).forEach((key) => {
      buckets[key].sort(sortRegisterUsersByName)
    })
    return buckets
  }, [filteredUsers])

  const renderRecordTable = (rows: TrainingRecordRow[], emptyMessage: string) => (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left py-2 px-3 font-medium">Name</th>
            <th className="text-left py-2 px-3 font-medium">Completed</th>
            <th className="text-left py-2 px-3 font-medium">Expiry</th>
            <th className="text-left py-2 px-3 font-medium">Certificate</th>
            <th className="text-left py-2 px-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 px-3 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const status = getStatus(row.expiryDate)
              return (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-3 font-medium">{row.name}</td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {row.completedAt ? formatDate(row.completedAt) : '—'}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {row.expiryDate ? formatDate(row.expiryDate) : '—'}
                  </td>
                  <td className="py-2 px-3">
                    {row.documentUrl ? (
                      <a
                        href={row.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        aria-label={`View certificate for ${row.name}`}
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {status === 'expired' && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Expired
                      </Badge>
                    )}
                    {status === 'expiring' && (
                      <Badge variant="secondary" className="gap-1">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Expiring soon
                      </Badge>
                    )}
                    {status === 'valid' && (
                      <Badge
                        variant="outline"
                        className="border-green-500/50 text-green-700 dark:text-green-400"
                      >
                        Valid
                      </Badge>
                    )}
                    {status === 'none' && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )

  if (!meChecked) {
    return (
      <MainLayout>
        <div className="p-8">
          <div className="animate-pulse h-48 rounded-lg bg-muted" aria-hidden />
        </div>
      </MainLayout>
    )
  }

  if (!canSeeQualityTeamRegister(userRoles)) {
    return null
  }

  return (
    <MainLayout>
      <div className="p-8 space-y-8">
        <header>
          <div className="flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" aria-hidden />
            <div>
              <h1 className="text-3xl font-bold">Quality team register</h1>
            </div>
          </div>
        </header>

        <div className="relative max-w-md">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search by name, email, role, department…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search quality team register"
          />
        </div>

        {loading ? (
          <div className="animate-pulse h-64 rounded-lg bg-muted" aria-busy aria-label="Loading register" />
        ) : filteredUsers.length === 0 ? (
          <p className="text-muted-foreground">
            {users.length === 0
              ? 'No people match the register criteria yet.'
              : 'No people match your search.'}
          </p>
        ) : (
          <div className="space-y-10">
            <p className="text-sm text-muted-foreground">
              Showing {filteredUsers.length} of {users.length} people
            </p>
            {REGISTER_SECTIONS.map((section) => {
              const people = usersBySection[section.id]
              if (people.length === 0) return null
              return (
                <section
                  key={section.id}
                  aria-labelledby={`section-${section.id}`}
                  className="space-y-4"
                >
                  <div>
                    <h2
                      id={`section-${section.id}`}
                      className="text-xl font-semibold tracking-tight"
                    >
                      {section.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {section.description} ({people.length})
                    </p>
                  </div>
                  <div className="space-y-6">
                    {people.map((person) => {
                      const displayName =
                        [person.firstName, person.lastName].filter(Boolean).join(' ').trim() ||
                        person.email ||
                        person.id
                      const quals = person.trainingRecords.filter(
                        (r) => r.recordType === 'QUALIFICATION'
                      )
                      const training = person.trainingRecords.filter(
                        (r) => r.recordType === 'TRAINING'
                      )
                      return (
                        <Card key={person.id}>
                          <CardHeader className="pb-2">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <CardTitle className="text-xl">{displayName}</CardTitle>
                                <CardDescription className="flex flex-col gap-1 mt-2">
                                  {person.email && (
                                    <span className="inline-flex items-center gap-1.5">
                                      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                      <a
                                        href={`mailto:${person.email}`}
                                        className="text-primary hover:underline"
                                      >
                                        {person.email}
                                      </a>
                                    </span>
                                  )}
                                  {person.position && (
                                    <span className="inline-flex items-center gap-1.5">
                                      <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                      {person.position}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                    {person.departmentName ?? '—'}
                                  </span>
                                </CardDescription>
                              </div>
                              <div
                                className="flex flex-wrap gap-1.5"
                                role="list"
                                aria-label="Assigned roles"
                              >
                                {person.roles.map((r) => (
                                  <Badge key={r} variant="secondary" role="listitem">
                                    {formatRoleLabel(r)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6 pt-2">
                            <section aria-labelledby={`quals-${person.id}`}>
                              <h3
                                id={`quals-${person.id}`}
                                className="flex items-center gap-2 text-base font-semibold mb-2"
                              >
                                <Award className="h-4 w-4" aria-hidden />
                                Qualifications ({quals.length})
                              </h3>
                              {renderRecordTable(quals, 'No qualification records.')}
                            </section>
                            <section aria-labelledby={`train-${person.id}`}>
                              <h3
                                id={`train-${person.id}`}
                                className="flex items-center gap-2 text-base font-semibold mb-2"
                              >
                                <GraduationCap className="h-4 w-4" aria-hidden />
                                Training ({training.length})
                              </h3>
                              {renderRecordTable(training, 'No training records.')}
                            </section>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </MainLayout>
  )
}

export default QualityTeamPage
