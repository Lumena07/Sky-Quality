'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  canAccessTrainingCompliancePage,
  canManageTrainingCompliance,
} from '@/lib/permissions'
import {
  DEPARTMENT_CATALOG_ROLE_CODES,
  DEPARTMENT_CATALOG_ROLE_OPTIONS,
  USER_PLATFORM_ROLE_CODES,
  normalizeRoleCode,
} from '@/lib/department-role-catalog'
import { AIRCRAFT_TYPE_OPTIONS } from '@/lib/aircraft-types'
import type { PilotSeat } from '@/lib/role-metadata'
import { rolesFromUserRow } from '@/lib/role-metadata'
import {
  parseRoleCodes,
  parseStringIdArray,
  userMatchesPersonalDocumentKind,
  userMatchesTrainingType,
} from '@/lib/training-compliance-applicability'
import { exportTrainingComplianceMatrixToExcel } from '@/lib/export/excel'
import { exportTrainingComplianceMatrixToPdf } from '@/lib/export/training-compliance-matrix-pdf'
import { cn, formatDate, formatDateOnly, formatDateTime } from '@/lib/utils'
import { ChevronDown, ChevronRight, ExternalLink, Plus, Trash2 } from 'lucide-react'

const AUDIENCE_ROLE_OPTIONS_RAW = [
  ...DEPARTMENT_CATALOG_ROLE_CODES,
  ...USER_PLATFORM_ROLE_CODES.filter((c) => c !== 'FOCAL_PERSON'),
]
const AUDIENCE_ROLE_OPTIONS = AUDIENCE_ROLE_OPTIONS_RAW.filter(
  (code, index) => AUDIENCE_ROLE_OPTIONS_RAW.indexOf(code) === index
).sort()

const COMPLIANCE_DASHBOARD_NO_ROLE = 'NO_ROLE'

const COMPLIANCE_ROLE_LABEL_BY_CODE = new Map<string, string>(
  DEPARTMENT_CATALOG_ROLE_OPTIONS.map((o) => [o.value, o.label])
)

const complianceDashboardRoleLabel = (code: string): string => {
  if (code === COMPLIANCE_DASHBOARD_NO_ROLE) return 'No role assigned'
  const fromCatalog = COMPLIANCE_ROLE_LABEL_BY_CODE.get(code)
  if (fromCatalog) return fromCatalog
  if (code === 'SYSTEM_ADMIN') return 'System admin'
  return code.replace(/_/g, ' ')
}

const CATALOG_ROLE_ORDER = new Map<string, number>(
  DEPARTMENT_CATALOG_ROLE_CODES.map((c, i) => [c, i])
)

const DASHBOARD_UNASSIGNED_DEPT = '__unassigned__'

const compareComplianceDashboardRoles = (a: string, b: string): number => {
  if (a === COMPLIANCE_DASHBOARD_NO_ROLE && b !== COMPLIANCE_DASHBOARD_NO_ROLE) return 1
  if (b === COMPLIANCE_DASHBOARD_NO_ROLE && a !== COMPLIANCE_DASHBOARD_NO_ROLE) return -1
  const ia = CATALOG_ROLE_ORDER.get(a)
  const ib = CATALOG_ROLE_ORDER.get(b)
  if (ia !== undefined && ib !== undefined && ia !== ib) return ia - ib
  if (ia !== undefined && ib === undefined) return -1
  if (ib !== undefined && ia === undefined) return 1
  return a.localeCompare(b)
}

type MatrixTrainingType = {
  id: string
  name: string
  intervalMonths: number
  mandatoryForAll: boolean
  isSystemSeeded: boolean
  applicableRoles?: unknown
  applicableUserIds?: unknown
  applicableDepartmentIds?: unknown
  applicableRoleMetadata?: unknown
}

type MatrixPayload = {
  trainingTypes: MatrixTrainingType[]
  users: Array<{
    id: string
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    roles?: string[]
    role?: string
    departmentId?: string | null
    roleMetadata?: unknown
    Department?: { name?: string } | { name?: string }[] | null
  }>
  completions: Array<{
    id: string
    trainingTypeId: string
    userId: string
    lastCompletedAt: string | null
    nextDueAt: string | null
    completionProofUrl?: string | null
    updatedAt?: string | null
  }>
  userDocuments: Array<{
    id: string
    userId: string
    documentKind: string
    expiryDate: string | null
    pdfFileUrl: string | null
    updatedAt?: string | null
    updatedById?: string | null
  }>
  personalDocumentKinds?: Array<{
    id: string
    code: string
    label: string
    applicableRoles?: unknown
    sortOrder: number
    isSystem: boolean
    createdAt?: string
  }>
}

const formatPersonalDocAudienceSummary = (k: { applicableRoles?: unknown }): string => {
  const roles = parseRoleCodes(k.applicableRoles)
  if (roles.length === 0) return 'All staff'
  return `Roles: ${roles.join(', ')}`
}

const isOrphanPersonalDocKind = (k: { id: string }): boolean => k.id.startsWith('orphan_')

const trainingCellStatus = (nextDue: string | null, last: string | null): 'green' | 'amber' | 'red' => {
  if (!last && !nextDue) return 'red'
  if (!nextDue) return 'red'
  const d = new Date(nextDue)
  if (Number.isNaN(d.getTime())) return 'red'
  const now = new Date()
  if (d < now) return 'red'
  const soon = new Date()
  soon.setDate(soon.getDate() + 30)
  if (d <= soon) return 'amber'
  return 'green'
}

const docCellStatus = (expiry: string | null): 'green' | 'amber' | 'red' | 'neutral' => {
  if (!expiry) return 'neutral'
  const d = new Date(expiry + 'T12:00:00Z')
  const now = new Date()
  if (d < now) return 'red'
  const soon = new Date()
  soon.setDate(soon.getDate() + 30)
  if (d <= soon) return 'amber'
  return 'green'
}

const formatAudienceSummary = (
  t: MatrixTrainingType,
  deptMap: Map<string, string>
): string => {
  if (t.mandatoryForAll) return 'All staff'
  const depts = parseStringIdArray(t.applicableDepartmentIds)
  const roles = Array.isArray(t.applicableRoles) ? (t.applicableRoles as string[]) : []
  const users = parseStringIdArray(t.applicableUserIds)
  const meta =
    t.applicableRoleMetadata &&
    typeof t.applicableRoleMetadata === 'object' &&
    !Array.isArray(t.applicableRoleMetadata) &&
    Object.keys(t.applicableRoleMetadata as object).length > 0
  const parts: string[] = []
  if (depts.length) {
    parts.push(`Dept: ${depts.map((id) => deptMap.get(id) ?? id).join(', ')}`)
  }
  if (roles.length) parts.push(`Roles: ${roles.join(', ')}`)
  if (meta) parts.push('Sub-roles')
  if (users.length) parts.push(`${users.length} named user(s)`)
  if (parts.length === 0) return 'Everyone'
  return parts.join(' · ')
}

type MatrixUserRow = MatrixPayload['users'][0]
type PersonalDocKindRow = NonNullable<MatrixPayload['personalDocumentKinds']>[number]

type ComplianceCellStatus = 'red' | 'amber' | 'green'

const complianceMatrixUserLabel = (u: MatrixUserRow) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || u.id

const getDashboardCellPeople = (
  buckets: Array<{
    departmentId: string
    roleCode: string
    users: MatrixUserRow[]
  }>,
  departmentId: string,
  roleCode: string,
  trainingType: MatrixTrainingType,
  status: ComplianceCellStatus,
  completionMap: Map<string, MatrixPayload['completions'][0]>
): MatrixUserRow[] => {
  const bucket = buckets.find((b) => b.departmentId === departmentId && b.roleCode === roleCode)
  if (!bucket) return []
  const matched: MatrixUserRow[] = []
  for (let i = 0; i < bucket.users.length; i++) {
    const u = bucket.users[i]
    if (
      !userMatchesTrainingType(
        {
          id: u.id,
          departmentId: u.departmentId ?? null,
          roles: u.roles,
          role: u.role ?? null,
          roleMetadata: u.roleMetadata,
        },
        trainingType
      )
    ) {
      continue
    }
    const c = completionMap.get(`${u.id}:${trainingType.id}`)
    const st = trainingCellStatus(c?.nextDueAt ?? null, c?.lastCompletedAt ?? null)
    if (st === status) matched.push(u)
  }
  matched.sort((a, b) =>
    complianceMatrixUserLabel(a).localeCompare(complianceMatrixUserLabel(b), undefined, {
      sensitivity: 'base',
    })
  )
  return matched
}

const countComplianceMatrixCells = (
  users: MatrixUserRow[],
  trainingTypes: MatrixTrainingType[],
  documentKinds: PersonalDocKindRow[],
  completionMap: Map<string, MatrixPayload['completions'][0]>,
  docMap: Map<string, MatrixPayload['userDocuments'][0]>
): { red: number; amber: number; green: number; neutralDoc: number } => {
  let red = 0
  let amber = 0
  let green = 0
  let neutralDoc = 0
  for (const u of users) {
    for (const t of trainingTypes) {
      if (
        !userMatchesTrainingType(
          {
            id: u.id,
            departmentId: u.departmentId ?? null,
            roles: u.roles,
            role: u.role ?? null,
            roleMetadata: u.roleMetadata,
          },
          t
        )
      ) {
        continue
      }
      const c = completionMap.get(`${u.id}:${t.id}`)
      const st = trainingCellStatus(c?.nextDueAt ?? null, c?.lastCompletedAt ?? null)
      if (st === 'red') red += 1
      else if (st === 'amber') amber += 1
      else green += 1
    }
    for (const dk of documentKinds) {
      if (!userMatchesPersonalDocumentKind({ roles: u.roles, role: u.role ?? null }, dk)) continue
      const d = docMap.get(`${u.id}:${dk.code}`)
      const st = docCellStatus(d?.expiryDate ?? null)
      if (st === 'red') red += 1
      else if (st === 'amber') amber += 1
      else if (st === 'green') green += 1
      else neutralDoc += 1
    }
  }
  return { red, amber, green, neutralDoc }
}

type MeApiResponse = {
  roles?: unknown
  departmentId?: string | null
}

const TrainingCompliancePage = () => {
  const router = useRouter()
  const [roles, setRoles] = useState<string[]>([])
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [matrix, setMatrix] = useState<MatrixPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')
  const [deptFilter, setDeptFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [dashboardUserFilter, setDashboardUserFilter] = useState('')

  const [typeName, setTypeName] = useState('')
  const [typeInterval, setTypeInterval] = useState('12')
  const [typeMandatory, setTypeMandatory] = useState(false)
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [typeAudienceDepts, setTypeAudienceDepts] = useState<string[]>([])
  const [typeAudienceRoles, setTypeAudienceRoles] = useState<string[]>([])
  const [typePilotSeat, setTypePilotSeat] = useState<PilotSeat | ''>('')
  const [typePilotTypes, setTypePilotTypes] = useState<string[]>([])
  const [typeDispatcherTypes, setTypeDispatcherTypes] = useState<string[]>([])

  const [completeTypeId, setCompleteTypeId] = useState('')
  const [completeDate, setCompleteDate] = useState('')
  const [completeApplicantFilter, setCompleteApplicantFilter] = useState('')
  const [completeSelectedUserIds, setCompleteSelectedUserIds] = useState<string[]>([])
  const [completeProofByUser, setCompleteProofByUser] = useState<
    Record<string, { fileUrl: string; fileName: string }>
  >({})
  const [completeProofUploadingUserId, setCompleteProofUploadingUserId] = useState<string | null>(null)
  const [completeBatchSaving, setCompleteBatchSaving] = useState(false)

  const [dcUploadingKey, setDcUploadingKey] = useState<string | null>(null)
  const [dcUpdateModal, setDcUpdateModal] = useState<{
    kindCode: string
    userId: string
    kindLabel: string
    personLabel: string
  } | null>(null)
  const [dcUpdateExpiry, setDcUpdateExpiry] = useState('')
  const [dcUpdateFile, setDcUpdateFile] = useState<File | undefined>(undefined)
  const [trUploadingKey, setTrUploadingKey] = useState<string | null>(null)
  const [trUpdateModal, setTrUpdateModal] = useState<{
    trainingTypeId: string
    userId: string
    trainingName: string
    personLabel: string
  } | null>(null)
  const [trUpdateLastCompleted, setTrUpdateLastCompleted] = useState('')
  const [trUpdateFile, setTrUpdateFile] = useState<File | undefined>(undefined)
  const [pdNewLabel, setPdNewLabel] = useState('')
  const [pdNewRoles, setPdNewRoles] = useState<string[]>([])
  const [pdKindDialogOpen, setPdKindDialogOpen] = useState(false)
  const [pdEditingKind, setPdEditingKind] = useState<
    NonNullable<MatrixPayload['personalDocumentKinds']>[0] | null
  >(null)
  const [pdEditLabel, setPdEditLabel] = useState('')
  const [pdEditRoles, setPdEditRoles] = useState<string[]>([])
  const [pdKindSaving, setPdKindSaving] = useState(false)

  const [dashboardDepartmentExpanded, setDashboardDepartmentExpanded] = useState<Record<string, boolean>>({})
  const [complianceDrawer, setComplianceDrawer] = useState<null | {
    departmentId: string
    departmentLabel: string
    roleCode: string
    roleLabel: string
    trainingTypeId: string
    trainingTypeName: string
    status: ComplianceCellStatus
  }>(null)

  const [dcHistoryOpen, setDcHistoryOpen] = useState<{
    userId: string
    documentKind: string
    personLabel: string
    kindLabel: string
  } | null>(null)
  const [dcHistoryLoading, setDcHistoryLoading] = useState(false)
  const [dcHistoryRows, setDcHistoryRows] = useState<
    Array<{
      id: string
      createdAt: string
      expiryDate: string | null
      pdfFileUrl: string | null
      createdById: string | null
    }>
  >([])

  const [tcHistoryOpen, setTcHistoryOpen] = useState<{
    userId: string
    trainingTypeId: string
    personLabel: string
    trainingName: string
  } | null>(null)
  const [tcHistoryLoading, setTcHistoryLoading] = useState(false)
  const [tcHistoryRows, setTcHistoryRows] = useState<
    Array<{
      id: string
      createdAt: string
      lastCompletedAt: string | null
      nextDueAt: string | null
      completionProofUrl: string | null
      createdById: string | null
    }>
  >([])

  const canAccessPage = canAccessTrainingCompliancePage(roles, departmentId)
  const canEditTrainingCompliance = canManageTrainingCompliance(roles, departmentId)

  const deptNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of departments) m.set(d.id, d.name)
    return m
  }, [departments])

  const selectedTrainingTypeForComplete = useMemo(() => {
    if (!matrix || !completeTypeId) return null
    return matrix.trainingTypes.find((t) => t.id === completeTypeId) ?? null
  }, [matrix, completeTypeId])

  const usersApplicableToCompleteType = useMemo(() => {
    if (!matrix || !selectedTrainingTypeForComplete) return []
    const t = selectedTrainingTypeForComplete
    return matrix.users.filter((u) =>
      userMatchesTrainingType(
        {
          id: u.id,
          departmentId: u.departmentId ?? null,
          roles: u.roles,
          role: u.role ?? null,
          roleMetadata: u.roleMetadata,
        },
        t
      )
    )
  }, [matrix, selectedTrainingTypeForComplete])

  const filteredUsersApplicableToComplete = useMemo(() => {
    const q = completeApplicantFilter.trim().toLowerCase()
    if (!q) return usersApplicableToCompleteType
    return usersApplicableToCompleteType.filter((u) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim().toLowerCase()
      const email = (u.email ?? '').toLowerCase()
      return name.includes(q) || email.includes(q) || u.id.toLowerCase().includes(q)
    })
  }, [usersApplicableToCompleteType, completeApplicantFilter])

  useEffect(() => {
    setCompleteSelectedUserIds([])
    setCompleteProofByUser({})
  }, [completeTypeId])

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((res): Promise<MeApiResponse> =>
        res.ok ? res.json() : Promise.resolve({})
      )
      .then((d) => {
        const nextRoles = Array.isArray(d.roles) ? (d.roles as string[]) : []
        setRoles(nextRoles)
        setDepartmentId(d.departmentId ?? null)
        if (!canAccessTrainingCompliancePage(nextRoles, d.departmentId ?? null)) {
          router.replace('/dashboard')
          return
        }
        setChecked(true)
      })
      .catch(() => setChecked(true))
  }, [router])

  const loadMatrix = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/training-compliance/matrix', { credentials: 'include' })
      if (res.ok) {
        setMatrix(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!checked || !canAccessPage) return
    loadMatrix()
  }, [checked, canAccessPage, loadMatrix])

  useEffect(() => {
    if (!dcHistoryOpen) {
      setDcHistoryRows([])
      return
    }
    setDcHistoryLoading(true)
    const q = new URLSearchParams({
      userId: dcHistoryOpen.userId,
      documentKind: dcHistoryOpen.documentKind,
    })
    void fetch(`/api/training-compliance/user-document/history?${q}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((d) => {
        setDcHistoryRows(Array.isArray(d) ? d : [])
      })
      .catch(() => setDcHistoryRows([]))
      .finally(() => setDcHistoryLoading(false))
  }, [dcHistoryOpen])

  useEffect(() => {
    if (!tcHistoryOpen) {
      setTcHistoryRows([])
      return
    }
    setTcHistoryLoading(true)
    const q = new URLSearchParams({
      userId: tcHistoryOpen.userId,
      trainingTypeId: tcHistoryOpen.trainingTypeId,
    })
    void fetch(`/api/training-compliance/completion/history?${q}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((d) => {
        setTcHistoryRows(Array.isArray(d) ? d : [])
      })
      .catch(() => setTcHistoryRows([]))
      .finally(() => setTcHistoryLoading(false))
  }, [tcHistoryOpen])

  useEffect(() => {
    if (!checked || !canAccessPage) return
    const load = async () => {
      try {
        const res = await fetch('/api/departments?includeInactive=true', {
          credentials: 'include',
        })
        const data = res.ok ? await res.json() : []
        setDepartments(Array.isArray(data) ? data : [])
      } catch {
        setDepartments([])
      }
    }
    void load()
  }, [checked, canAccessPage])

  useEffect(() => {
    if (!matrix || !completeTypeId) return
    const exists = matrix.trainingTypes.some((t) => t.id === completeTypeId)
    if (!exists) setCompleteTypeId('')
  }, [matrix, completeTypeId])

  const deptName = (u: MatrixPayload['users'][0]) => {
    const d = u.Department
    if (!d) return ''
    if (Array.isArray(d)) return d[0]?.name ?? ''
    return d.name ?? ''
  }

  const filteredUsers = useMemo(() => {
    if (!matrix) return []
    const q = dashboardUserFilter.trim().toLowerCase()
    return matrix.users.filter((u) => {
      const dn = deptName(u)
      if (deptFilter && !dn.toLowerCase().includes(deptFilter.toLowerCase())) return false
      const ur = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : u.role ? [u.role] : []
      if (roleFilter && !ur.includes(roleFilter)) return false
      if (q) {
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim().toLowerCase()
        const email = (u.email ?? '').toLowerCase()
        if (!name.includes(q) && !email.includes(q) && !u.id.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [matrix, deptFilter, roleFilter, dashboardUserFilter])

  const completionMap = useMemo(() => {
    const m = new Map<string, MatrixPayload['completions'][0]>()
    if (!matrix) return m
    for (const c of matrix.completions) {
      m.set(`${c.userId}:${c.trainingTypeId}`, c)
    }
    return m
  }, [matrix])

  const docMap = useMemo(() => {
    const m = new Map<string, MatrixPayload['userDocuments'][0]>()
    if (!matrix) return m
    for (const d of matrix.userDocuments) {
      m.set(`${d.userId}:${d.documentKind}`, d)
    }
    return m
  }, [matrix])

  const dashboardUsersByDept = useMemo(() => {
    const byDept = new Map<string, MatrixUserRow[]>()
    for (let i = 0; i < filteredUsers.length; i++) {
      const u = filteredUsers[i]
      const id = u.departmentId?.trim() ? u.departmentId : DASHBOARD_UNASSIGNED_DEPT
      const list = byDept.get(id)
      if (list) list.push(u)
      else byDept.set(id, [u])
    }
    return byDept
  }, [filteredUsers])

  const dashboardTrainingOnlyCellCounts = useMemo(() => {
    if (!matrix) return null
    const { red, amber, green } = countComplianceMatrixCells(
      filteredUsers,
      matrix.trainingTypes,
      [],
      completionMap,
      docMap
    )
    return { red, amber, green, people: filteredUsers.length }
  }, [matrix, filteredUsers, completionMap, docMap])

  const dashboardGroupedBuckets = useMemo(() => {
    if (!matrix) return []
    const docKindsAll = matrix.personalDocumentKinds ?? []
    const bucketUserMaps = new Map<string, Map<string, MatrixPayload['users'][0]>>()

    const userSortKey = (u: MatrixPayload['users'][0]) => {
      const label =
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || u.id
      return label.toLocaleLowerCase()
    }

    for (const u of filteredUsers) {
      const deptId = u.departmentId?.trim() ? u.departmentId! : DASHBOARD_UNASSIGNED_DEPT
      const raw = rolesFromUserRow(u).map((r) => normalizeRoleCode(r)).filter(Boolean)
      const roleCodes =
        raw.length > 0 ? raw.filter((code, index) => raw.indexOf(code) === index) : [COMPLIANCE_DASHBOARD_NO_ROLE]
      for (const roleCode of roleCodes) {
        if (roleFilter && roleCode !== roleFilter) continue
        const key = `${deptId}::${roleCode}`
        let inner = bucketUserMaps.get(key)
        if (!inner) {
          inner = new Map()
          bucketUserMaps.set(key, inner)
        }
        inner.set(u.id, u)
      }
    }

    const departmentLabel = (deptId: string) =>
      deptId === DASHBOARD_UNASSIGNED_DEPT ? 'Unassigned' : deptNameById.get(deptId) ?? '—'

    const buckets: Array<{
      departmentId: string
      departmentLabel: string
      roleCode: string
      roleLabel: string
      users: MatrixPayload['users']
      trainingTypes: MatrixTrainingType[]
      documentKinds: NonNullable<MatrixPayload['personalDocumentKinds']>[number][]
    }> = []

    bucketUserMaps.forEach((userMap, key) => {
      if (userMap.size === 0) return
      const [deptId, roleCode] = key.split('::') as [string, string]
      const users: MatrixPayload['users'][0][] = []
      userMap.forEach((u) => users.push(u))
      users.sort((a, b) => userSortKey(a).localeCompare(userSortKey(b)))
      const trainingTypes = matrix.trainingTypes.filter((t) =>
        users.some((u) =>
          userMatchesTrainingType(
            {
              id: u.id,
              departmentId: u.departmentId ?? null,
              roles: u.roles,
              role: u.role ?? null,
              roleMetadata: u.roleMetadata,
            },
            t
          )
        )
      )
      const documentKinds = docKindsAll.filter((k) =>
        users.some((u) =>
          userMatchesPersonalDocumentKind({ roles: u.roles, role: u.role ?? null }, k)
        )
      )
      buckets.push({
        departmentId: deptId,
        departmentLabel: departmentLabel(deptId),
        roleCode,
        roleLabel: complianceDashboardRoleLabel(roleCode),
        users,
        trainingTypes,
        documentKinds,
      })
    })

    buckets.sort((a, b) => {
      const ua = a.departmentId === DASHBOARD_UNASSIGNED_DEPT ? 1 : 0
      const ub = b.departmentId === DASHBOARD_UNASSIGNED_DEPT ? 1 : 0
      if (ua !== ub) return ua - ub
      const d = a.departmentLabel.localeCompare(b.departmentLabel, undefined, {
        sensitivity: 'base',
      })
      if (d !== 0) return d
      return compareComplianceDashboardRoles(a.roleCode, b.roleCode)
    })

    return buckets
  }, [matrix, filteredUsers, deptNameById, roleFilter])

  type ComplianceDashboardBucket = (typeof dashboardGroupedBuckets)[number]

  type DashboardDeptRoleTrainingCell = {
    na: boolean
    red: number
    amber: number
    green: number
  }

  const dashboardDeptRoleTrainingMatrix = useMemo(() => {
    if (!matrix || dashboardGroupedBuckets.length === 0) return []
    const byDept = new Map<string, ComplianceDashboardBucket[]>()
    for (let i = 0; i < dashboardGroupedBuckets.length; i++) {
      const b = dashboardGroupedBuckets[i]
      const arr = byDept.get(b.departmentId)
      if (arr) arr.push(b)
      else byDept.set(b.departmentId, [b])
    }
    const out: Array<{
      departmentId: string
      departmentLabel: string
      uniquePeople: number
      roles: Array<{ roleCode: string; roleLabel: string; people: number }>
      trainingRows: Array<{
        trainingType: MatrixTrainingType
        cellsByRole: Record<string, DashboardDeptRoleTrainingCell>
      }>
      summaryOverdueByRole: Record<string, number>
      buckets: ComplianceDashboardBucket[]
    }> = []

    byDept.forEach((buckets, deptId) => {
      const departmentLabel = buckets[0]?.departmentLabel ?? '—'
      const sortedBuckets = [...buckets].sort((a, b) =>
        compareComplianceDashboardRoles(a.roleCode, b.roleCode)
      )
      const roles = sortedBuckets.map((b) => ({
        roleCode: b.roleCode,
        roleLabel: b.roleLabel,
        people: b.users.length,
      }))
      const bucketByRole = new Map<string, ComplianceDashboardBucket>()
      for (let si = 0; si < sortedBuckets.length; si++) {
        bucketByRole.set(sortedBuckets[si].roleCode, sortedBuckets[si])
      }

      const trainingIdSet = new Set<string>()
      for (let bi = 0; bi < buckets.length; bi++) {
        const tt = buckets[bi].trainingTypes
        for (let ti = 0; ti < tt.length; ti++) trainingIdSet.add(tt[ti].id)
      }
      const trainingTypesForRows = matrix.trainingTypes
        .filter((t) => trainingIdSet.has(t.id))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

      const trainingRows: Array<{
        trainingType: MatrixTrainingType
        cellsByRole: Record<string, DashboardDeptRoleTrainingCell>
      }> = []

      for (let ri = 0; ri < trainingTypesForRows.length; ri++) {
        const t = trainingTypesForRows[ri]
        const cellsByRole: Record<string, DashboardDeptRoleTrainingCell> = {}
        for (let ci = 0; ci < roles.length; ci++) {
          const roleCode = roles[ci].roleCode
          const bucket = bucketByRole.get(roleCode)
          if (!bucket) {
            cellsByRole[roleCode] = { na: true, red: 0, amber: 0, green: 0 }
            continue
          }
          const inScope: MatrixUserRow[] = []
          for (let ui = 0; ui < bucket.users.length; ui++) {
            const u = bucket.users[ui]
            if (
              userMatchesTrainingType(
                {
                  id: u.id,
                  departmentId: u.departmentId ?? null,
                  roles: u.roles,
                  role: u.role ?? null,
                  roleMetadata: u.roleMetadata,
                },
                t
              )
            ) {
              inScope.push(u)
            }
          }
          if (inScope.length === 0) {
            cellsByRole[roleCode] = { na: true, red: 0, amber: 0, green: 0 }
          } else {
            let red = 0
            let amber = 0
            let green = 0
            for (let ii = 0; ii < inScope.length; ii++) {
              const u = inScope[ii]
              const c = completionMap.get(`${u.id}:${t.id}`)
              const st = trainingCellStatus(c?.nextDueAt ?? null, c?.lastCompletedAt ?? null)
              if (st === 'red') red++
              else if (st === 'amber') amber++
              else green++
            }
            cellsByRole[roleCode] = { na: false, red, amber, green }
          }
        }
        trainingRows.push({ trainingType: t, cellsByRole })
      }

      const summaryOverdueByRole: Record<string, number> = {}
      for (let ci = 0; ci < roles.length; ci++) {
        const roleCode = roles[ci].roleCode
        let sum = 0
        for (let tri = 0; tri < trainingRows.length; tri++) {
          const cell = trainingRows[tri].cellsByRole[roleCode]
          if (cell && !cell.na) sum += cell.red
        }
        summaryOverdueByRole[roleCode] = sum
      }

      const uniquePeople = dashboardUsersByDept.get(deptId)?.length ?? 0
      out.push({
        departmentId: deptId,
        departmentLabel,
        uniquePeople,
        roles,
        trainingRows,
        summaryOverdueByRole,
        buckets,
      })
    })

    out.sort((a, b) => {
      const ua = a.departmentId === DASHBOARD_UNASSIGNED_DEPT ? 1 : 0
      const ub = b.departmentId === DASHBOARD_UNASSIGNED_DEPT ? 1 : 0
      if (ua !== ub) return ua - ub
      return a.departmentLabel.localeCompare(b.departmentLabel, undefined, { sensitivity: 'base' })
    })
    return out
  }, [matrix, dashboardGroupedBuckets, completionMap, dashboardUsersByDept])

  const complianceDrawerPeople = useMemo(() => {
    if (!complianceDrawer || !matrix) return []
    const deptRow = dashboardDeptRoleTrainingMatrix.find(
      (d) => d.departmentId === complianceDrawer.departmentId
    )
    if (!deptRow) return []
    const t = matrix.trainingTypes.find((x) => x.id === complianceDrawer.trainingTypeId)
    if (!t) return []
    return getDashboardCellPeople(
      deptRow.buckets,
      complianceDrawer.departmentId,
      complianceDrawer.roleCode,
      t,
      complianceDrawer.status,
      completionMap
    )
  }, [complianceDrawer, dashboardDeptRoleTrainingMatrix, matrix, completionMap])

  const personalDocumentKindsList = useMemo(
    () => matrix?.personalDocumentKinds ?? [],
    [matrix?.personalDocumentKinds]
  )

  const displayUserLabel = (u: MatrixPayload['users'][0]) =>
    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || u.id

  const documentComplianceUsersByKind = useMemo(() => {
    const m = new Map<string, MatrixPayload['users']>()
    if (!matrix) return m
    const userLabel = (u: MatrixPayload['users'][0]) =>
      [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || u.id
    const labelCmp = (a: MatrixPayload['users'][0], b: MatrixPayload['users'][0]) =>
      userLabel(a).localeCompare(userLabel(b), undefined, { sensitivity: 'base' })
    for (const k of personalDocumentKindsList) {
      const users = matrix.users
        .filter((u) =>
          userMatchesPersonalDocumentKind({ roles: u.roles, role: u.role ?? null }, k)
        )
        .sort(labelCmp)
      m.set(k.code, users)
    }
    return m
  }, [matrix, personalDocumentKindsList])

  const trainingComplianceUsersByType = useMemo(() => {
    const m = new Map<string, MatrixPayload['users']>()
    if (!matrix) return m
    const userLabel = (u: MatrixPayload['users'][0]) =>
      [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || u.id
    const labelCmp = (a: MatrixPayload['users'][0], b: MatrixPayload['users'][0]) =>
      userLabel(a).localeCompare(userLabel(b), undefined, { sensitivity: 'base' })
    for (const t of matrix.trainingTypes) {
      const users = matrix.users
        .filter((u) =>
          userMatchesTrainingType(
            {
              id: u.id,
              departmentId: u.departmentId ?? null,
              roles: u.roles,
              role: u.role ?? null,
              roleMetadata: u.roleMetadata,
            },
            t
          )
        )
        .sort(labelCmp)
      m.set(t.id, users)
    }
    return m
  }, [matrix])

  const handleToggleCompleteApplicant = (userId: string, nextChecked: boolean) => {
    if (nextChecked) {
      setCompleteSelectedUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]))
      return
    }
    setCompleteSelectedUserIds((prev) => prev.filter((id) => id !== userId))
    setCompleteProofByUser((p) => {
      const next = { ...p }
      delete next[userId]
      return next
    })
  }

  const handleSelectAllFilteredApplicants = () => {
    const ids = filteredUsersApplicableToComplete.map((u) => u.id)
    setCompleteSelectedUserIds((prev) => {
      const next = prev.slice()
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]
        if (next.indexOf(id) === -1) next.push(id)
      }
      return next
    })
  }

  const handleClearFilteredApplicantsSelection = () => {
    const visibleIds = filteredUsersApplicableToComplete.map((u) => u.id)
    setCompleteSelectedUserIds((prev) =>
      prev.filter((id) => visibleIds.indexOf(id) === -1)
    )
    setCompleteProofByUser((p) => {
      const next = { ...p }
      for (let i = 0; i < visibleIds.length; i++) {
        delete next[visibleIds[i]]
      }
      return next
    })
  }

  const handleCompleteProofFileChange = async (
    userId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCompleteProofUploadingUserId(userId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entityType', 'training-compliance-document')
      formData.append('entityId', userId)
      const res = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(typeof err.error === 'string' ? err.error : 'Upload failed')
        return
      }
      const data = (await res.json()) as { fileUrl?: string; fileName?: string }
      const fileUrl = data.fileUrl ?? ''
      if (!fileUrl.startsWith('/uploads/')) {
        alert('Invalid upload response')
        return
      }
      setCompleteProofByUser((p) => ({
        ...p,
        [userId]: { fileUrl, fileName: data.fileName ?? file.name },
      }))
    } catch {
      alert('Upload failed')
    } finally {
      setCompleteProofUploadingUserId(null)
      e.target.value = ''
    }
  }

  const handleClearCompleteProof = (userId: string) => {
    setCompleteProofByUser((p) => {
      const next = { ...p }
      delete next[userId]
      return next
    })
  }

  const handleSaveCompleteBatch = async () => {
    if (!completeTypeId || !completeDate) {
      alert('Select training type and completion date')
      return
    }
    if (completeSelectedUserIds.length === 0) {
      alert('Select at least one person')
      return
    }
    for (const uid of completeSelectedUserIds) {
      if (!completeProofByUser[uid]?.fileUrl) {
        alert('Upload a completion document for every selected person')
        return
      }
    }
    setCompleteBatchSaving(true)
    try {
      const results = await Promise.allSettled(
        completeSelectedUserIds.map(async (userId) => {
          const res = await fetch('/api/training-compliance/completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              userId,
              trainingTypeId: completeTypeId,
              lastCompletedAt: completeDate,
              completionProofUrl: completeProofByUser[userId].fileUrl,
            }),
          })
          const errBody = (await res.json().catch(() => ({}))) as { error?: string }
          if (!res.ok) {
            throw new Error(typeof errBody.error === 'string' ? errBody.error : 'Failed')
          }
          return errBody
        })
      )
      const failures: string[] = []
      let ok = 0
      results.forEach((r, i) => {
        const id = completeSelectedUserIds[i]
        const u = matrix?.users.find((x) => x.id === id)
        const label = u ? displayUserLabel(u) : id
        if (r.status === 'fulfilled') ok += 1
        else
          failures.push(
            `${label}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`
          )
      })
      await loadMatrix()
      if (failures.length === 0) {
        setCompleteDate('')
        setCompleteSelectedUserIds([])
        setCompleteProofByUser({})
        setCompleteApplicantFilter('')
        alert(`Saved ${ok} completion(s).`)
      } else {
        alert(
          `Saved ${ok}, failed ${failures.length}:\n${failures.slice(0, 8).join('\n')}${failures.length > 8 ? '\n…' : ''}`
        )
      }
    } finally {
      setCompleteBatchSaving(false)
    }
  }

  const handleOpenPersonalDocKindEdit = (
    k: NonNullable<MatrixPayload['personalDocumentKinds']>[0]
  ) => {
    setPdEditingKind(k)
    setPdEditLabel(k.label)
    setPdEditRoles(parseRoleCodes(k.applicableRoles))
    setPdKindDialogOpen(true)
  }

  const handleSavePersonalDocKindEdit = async () => {
    if (!pdEditingKind || isOrphanPersonalDocKind(pdEditingKind)) return
    const label = pdEditLabel.trim()
    if (!label) {
      alert('Label required')
      return
    }
    setPdKindSaving(true)
    try {
      const res = await fetch(`/api/training-compliance/personal-document-kinds/${pdEditingKind.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          label,
          applicableRoles: pdEditRoles.length > 0 ? pdEditRoles : null,
        }),
      })
      if (res.ok) {
        setPdKindDialogOpen(false)
        setPdEditingKind(null)
        loadMatrix()
      } else alert((await res.json().catch(() => ({}))).error ?? 'Failed')
    } finally {
      setPdKindSaving(false)
    }
  }

  const handleCreatePersonalDocKind = async () => {
    const label = pdNewLabel.trim()
    if (!label) {
      alert('Enter a document type name')
      return
    }
    setPdKindSaving(true)
    try {
      const res = await fetch('/api/training-compliance/personal-document-kinds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          label,
          applicableRoles: pdNewRoles.length > 0 ? pdNewRoles : null,
        }),
      })
      if (res.ok) {
        setPdNewLabel('')
        setPdNewRoles([])
        loadMatrix()
      } else alert((await res.json().catch(() => ({}))).error ?? 'Failed')
    } finally {
      setPdKindSaving(false)
    }
  }

  const handleDeletePersonalDocKind = async (
    k: NonNullable<MatrixPayload['personalDocumentKinds']>[0]
  ) => {
    if (k.isSystem || isOrphanPersonalDocKind(k)) return
    if (!confirm(`Delete document type "${k.label}"?`)) return
    const res = await fetch(`/api/training-compliance/personal-document-kinds/${k.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) loadMatrix()
    else alert((await res.json().catch(() => ({}))).error ?? 'Failed')
  }

  const handleSaveDocumentComplianceRow = async (
    kindCode: string,
    userId: string,
    expiryDate: string,
    file: File | undefined
  ) => {
    const rowKey = `${kindCode}:${userId}`
    if (!expiryDate.trim()) {
      alert('Expiry date required')
      return
    }
    const existing = docMap.get(`${userId}:${kindCode}`)
    setDcUploadingKey(rowKey)
    try {
      let pdfFileUrl: string | null = null
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('entityType', 'training-compliance-document')
        fd.append('entityId', userId)
        const up = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' })
        if (!up.ok) {
          const err = await up.json().catch(() => ({}))
          alert(typeof err.error === 'string' ? err.error : 'Upload failed')
          return
        }
        const upJson = (await up.json()) as { fileUrl?: string }
        pdfFileUrl = upJson.fileUrl ?? null
        if (!pdfFileUrl || !pdfFileUrl.startsWith('/uploads/')) {
          alert('Invalid upload response')
          return
        }
      } else if (existing?.pdfFileUrl) {
        pdfFileUrl = existing.pdfFileUrl
      } else {
        alert('Upload a file (required when there is no document on file yet)')
        return
      }
      const res = await fetch('/api/training-compliance/user-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          documentKind: kindCode,
          expiryDate: expiryDate.trim(),
          pdfFileUrl,
        }),
      })
      if (res.ok) {
        setDcUpdateModal(null)
        setDcUpdateFile(undefined)
        loadMatrix()
      } else alert((await res.json().catch(() => ({}))).error ?? 'Failed')
    } finally {
      setDcUploadingKey(null)
    }
  }

  const handleSaveTrainingComplianceRow = async (
    trainingTypeId: string,
    userId: string,
    lastCompletedDate: string,
    file: File | undefined
  ) => {
    const rowKey = `${trainingTypeId}:${userId}`
    if (!lastCompletedDate.trim()) {
      alert('Last completed date required')
      return
    }
    const existing = completionMap.get(`${userId}:${trainingTypeId}`)
    setTrUploadingKey(rowKey)
    try {
      let completionProofUrl: string | undefined
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('entityType', 'training-compliance-document')
        fd.append('entityId', userId)
        const up = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' })
        if (!up.ok) {
          const err = await up.json().catch(() => ({}))
          alert(typeof err.error === 'string' ? err.error : 'Upload failed')
          return
        }
        const upJson = (await up.json()) as { fileUrl?: string }
        const url = upJson.fileUrl ?? null
        if (!url || !url.startsWith('/uploads/')) {
          alert('Invalid upload response')
          return
        }
        completionProofUrl = url
      } else if (!existing?.completionProofUrl?.trim()) {
        alert('Upload proof (required when there is no proof on file yet)')
        return
      }
      const body: Record<string, unknown> = {
        userId,
        trainingTypeId,
        lastCompletedAt: lastCompletedDate.trim(),
      }
      if (completionProofUrl) body.completionProofUrl = completionProofUrl
      const res = await fetch('/api/training-compliance/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setTrUpdateModal(null)
        setTrUpdateFile(undefined)
        loadMatrix()
      } else alert((await res.json().catch(() => ({}))).error ?? 'Failed')
    } finally {
      setTrUploadingKey(null)
    }
  }

  const buildMatrixExportRows = (): Record<string, string>[] => {
    if (!matrix) return []
    const exportRows: Record<string, string>[] = []
    for (const u of filteredUsers) {
      const name =
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || u.id
      const rcRaw = rolesFromUserRow(u).map((r) => normalizeRoleCode(r)).filter(Boolean)
      const roleCodes =
        rcRaw.length > 0
          ? rcRaw.filter((code, index) => rcRaw.indexOf(code) === index)
          : [COMPLIANCE_DASHBOARD_NO_ROLE]
      for (const roleCode of roleCodes) {
        if (roleFilter && roleCode !== roleFilter) continue
        const row: Record<string, string> = {
          Name: name,
          Department: deptName(u) || '—',
          Role: complianceDashboardRoleLabel(roleCode),
        }
        for (const t of matrix.trainingTypes) {
          const applies = userMatchesTrainingType(
            {
              id: u.id,
              departmentId: u.departmentId ?? null,
              roles: u.roles,
              role: u.role ?? null,
              roleMetadata: u.roleMetadata,
            },
            t
          )
          if (!applies) {
            row[t.name] = 'N/A'
            continue
          }
          const c = completionMap.get(`${u.id}:${t.id}`)
          const st = trainingCellStatus(c?.nextDueAt ?? null, c?.lastCompletedAt ?? null)
          row[t.name] = c?.nextDueAt ? `${st} (${formatDate(c.nextDueAt)})` : st
        }
        for (const dk of matrix.personalDocumentKinds ?? []) {
          const applies = userMatchesPersonalDocumentKind(
            {
              roles: u.roles,
              role: u.role ?? null,
            },
            dk
          )
          if (!applies) {
            row[dk.label] = 'N/A'
            continue
          }
          const d = docMap.get(`${u.id}:${dk.code}`)
          const st = docCellStatus(d?.expiryDate ?? null)
          row[dk.label] = d?.expiryDate ? `${st} (${d.expiryDate})` : st
        }
        exportRows.push(row)
      }
    }
    return exportRows
  }

  const handleExportExcel = () => {
    const exportRows = buildMatrixExportRows()
    if (exportRows.length === 0) return
    exportTrainingComplianceMatrixToExcel(exportRows)
  }

  const handleExportPdf = () => {
    const exportRows = buildMatrixExportRows()
    if (exportRows.length === 0) return
    exportTrainingComplianceMatrixToPdf(exportRows)
  }

  const cellClass = (s: 'green' | 'amber' | 'red' | 'neutral') => {
    if (s === 'green') return 'bg-green-600/20 text-green-800 dark:text-green-300'
    if (s === 'amber') return 'bg-amber-500/25 text-amber-900 dark:text-amber-200'
    if (s === 'red') return 'bg-red-600/20 text-red-800 dark:text-red-300'
    return 'bg-muted text-muted-foreground'
  }

  if (!checked) {
    return (
      <MainLayout>
        <div className="p-8 text-muted-foreground">Loading…</div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Training Compliance</h1>
          <p className="text-muted-foreground mt-2">
            {canEditTrainingCompliance
              ? 'Training intervals, document compliance, and the compliance matrix (Training department / Quality Manager).'
              : 'Oversight view of the compliance matrix. Training types and records are managed by Training / Quality Manager.'}
          </p>
        </div>

        <Tabs
          value={canEditTrainingCompliance ? tab : 'dashboard'}
          onValueChange={(v) => {
            if (canEditTrainingCompliance) setTab(v)
          }}
        >
          {canEditTrainingCompliance ? (
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="dashboard">Compliance dashboard</TabsTrigger>
              <TabsTrigger value="types">Training types</TabsTrigger>
              <TabsTrigger value="records">Record completion</TabsTrigger>
              <TabsTrigger value="training">Training compliance</TabsTrigger>
              <TabsTrigger value="documents">Document compliance</TabsTrigger>
            </TabsList>
          ) : null}

          {canEditTrainingCompliance ? (
            <>
              <TabsContent value="types" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add training type</CardTitle>
                <p className="text-sm text-muted-foreground font-normal">
                  Scope who must complete this training: all staff, departments, roles, and sub-roles (pilot seat /
                  aircraft type). Set filters combine with AND.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} className="w-56" />
                  </div>
                  <div className="space-y-1">
                    <Label>Interval (months)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={typeInterval}
                      onChange={(e) => setTypeInterval(e.target.value)}
                      className="w-28"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={typeMandatory}
                      onChange={(e) => {
                        const v = e.target.checked
                        setTypeMandatory(v)
                        if (v) {
                          setTypeAudienceDepts([])
                          setTypeAudienceRoles([])
                          setTypePilotSeat('')
                          setTypePilotTypes([])
                          setTypeDispatcherTypes([])
                        }
                      }}
                      aria-label="Mandatory for all staff"
                    />
                    Mandatory for all
                  </label>
                </div>
                {!typeMandatory && (
                  <div className="space-y-4 rounded-md border p-4">
                    <p className="text-sm font-medium">Audience</p>
                    <p className="text-xs text-muted-foreground">
                      Leave everything empty to apply to everyone. Otherwise set any combination of department,
                      roles, and sub-roles.
                    </p>
                    <div className="space-y-2">
                      <Label className="text-xs">Departments</Label>
                      <div
                        className="max-h-28 overflow-y-auto rounded border p-2 flex flex-wrap gap-2"
                        role="group"
                        aria-label="Departments"
                      >
                        {departments.map((d) => (
                          <label key={d.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={typeAudienceDepts.includes(d.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTypeAudienceDepts((p) => (p.includes(d.id) ? p : [...p, d.id]))
                                } else {
                                  setTypeAudienceDepts((p) => p.filter((x) => x !== d.id))
                                }
                              }}
                              className="rounded border-input"
                            />
                            {d.name}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Roles</Label>
                      <div
                        className="max-h-28 overflow-y-auto rounded border p-2 flex flex-wrap gap-2"
                        role="group"
                        aria-label="Roles"
                      >
                        {AUDIENCE_ROLE_OPTIONS.map((code) => (
                          <label key={code} className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={typeAudienceRoles.includes(code)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTypeAudienceRoles((p) => (p.includes(code) ? p : [...p, code]))
                                } else {
                                  setTypeAudienceRoles((p) => {
                                    const next = p.filter((x) => x !== code)
                                    if (code === 'PILOT') {
                                      setTypePilotSeat('')
                                      setTypePilotTypes([])
                                    }
                                    if (code === 'FLIGHT_DISPATCHERS') setTypeDispatcherTypes([])
                                    return next
                                  })
                                }
                              }}
                              className="rounded border-input"
                            />
                            {code.replace(/_/g, ' ')}
                          </label>
                        ))}
                      </div>
                    </div>
                    {typeAudienceRoles.includes('PILOT') && (
                      <div className="space-y-2 rounded border p-3">
                        <p className="text-xs font-medium">Pilot sub-roles (optional refinement)</p>
                        <div className="space-y-1">
                          <Label className="text-xs">Seat</Label>
                          <Select
                            value={typePilotSeat || '__none__'}
                            onValueChange={(v) =>
                              setTypePilotSeat(v === '__none__' ? '' : (v as PilotSeat))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs" aria-label="Pilot seat filter">
                              <SelectValue placeholder="Any" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Any seat</SelectItem>
                              <SelectItem value="CAPTAIN">Captain</SelectItem>
                              <SelectItem value="FIRST_OFFICER">First Officer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Pilot aircraft types">
                          {AIRCRAFT_TYPE_OPTIONS.map(({ value, label }) => (
                            <label key={value} className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={typePilotTypes.includes(value)}
                                onChange={(e) => {
                                  const ch = e.target.checked
                                  setTypePilotTypes((p) =>
                                    ch ? (p.includes(value) ? p : [...p, value]) : p.filter((x) => x !== value)
                                  )
                                }}
                                className="rounded border-input"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {typeAudienceRoles.includes('FLIGHT_DISPATCHERS') && (
                      <div className="space-y-2 rounded border p-3">
                        <p className="text-xs font-medium">Dispatcher aircraft types</p>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Dispatcher types">
                          {AIRCRAFT_TYPE_OPTIONS.map(({ value, label }) => (
                            <label key={value} className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={typeDispatcherTypes.includes(value)}
                                onChange={(e) => {
                                  const ch = e.target.checked
                                  setTypeDispatcherTypes((p) =>
                                    ch ? (p.includes(value) ? p : [...p, value]) : p.filter((x) => x !== value)
                                  )
                                }}
                                className="rounded border-input"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <Button
                  type="button"
                  onClick={async () => {
                    const nm = typeName.trim()
                    const mo = parseInt(typeInterval, 10)
                    if (!nm || Number.isNaN(mo) || mo < 1) {
                      alert('Name and a positive interval are required')
                      return
                    }
                    const meta: Record<string, unknown> = {}
                    if (!typeMandatory && typeAudienceRoles.includes('PILOT')) {
                      const block: Record<string, unknown> = {}
                      if (typePilotSeat) block.pilotSeat = typePilotSeat
                      if (typePilotTypes.length > 0) block.aircraftTypeCodes = typePilotTypes
                      if (Object.keys(block).length > 0) meta.PILOT = block
                    }
                    if (!typeMandatory && typeAudienceRoles.includes('FLIGHT_DISPATCHERS')) {
                      if (typeDispatcherTypes.length > 0) {
                        meta.FLIGHT_DISPATCHERS = { aircraftTypeCodes: typeDispatcherTypes }
                      }
                    }
                    const body: Record<string, unknown> = {
                      name: nm,
                      intervalMonths: mo,
                      mandatoryForAll: typeMandatory,
                    }
                    if (!typeMandatory) {
                      if (typeAudienceDepts.length > 0) body.applicableDepartmentIds = typeAudienceDepts
                      if (typeAudienceRoles.length > 0) body.applicableRoles = typeAudienceRoles
                      if (Object.keys(meta).length > 0) body.applicableRoleMetadata = meta
                    }
                    const res = await fetch('/api/training-compliance/types', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify(body),
                    })
                    if (res.ok) {
                      setTypeName('')
                      setTypeInterval('12')
                      setTypeMandatory(false)
                      setTypeAudienceDepts([])
                      setTypeAudienceRoles([])
                      setTypePilotSeat('')
                      setTypePilotTypes([])
                      setTypeDispatcherTypes([])
                      loadMatrix()
                    } else alert((await res.json().catch(() => ({}))).error ?? 'Failed')
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Existing types</CardTitle>
              </CardHeader>
              <CardContent>
                {loading || !matrix ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {matrix.trainingTypes.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                        <span>
                          {t.name}{' '}
                          <span className="text-muted-foreground">
                            ({t.intervalMonths} mo
                            {t.isSystemSeeded ? ', system' : ''})
                          </span>
                          <span className="block text-xs text-muted-foreground mt-0.5">
                            {formatAudienceSummary(t, deptNameById)}
                          </span>
                        </span>
                        {!t.isSystemSeeded && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (!confirm('Delete this type?')) return
                              const res = await fetch(`/api/training-compliance/types/${t.id}`, {
                                method: 'DELETE',
                                credentials: 'include',
                              })
                              if (res.ok) loadMatrix()
                            }}
                            aria-label="Delete type"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="training" className="mt-4 space-y-6">
            {!matrix || matrix.trainingTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No training types loaded.</p>
            ) : (
              matrix.trainingTypes.map((t) => {
                const people = trainingComplianceUsersByType.get(t.id) ?? []
                return (
                  <Card key={t.id}>
                    <CardHeader>
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="text-lg">{t.name}</CardTitle>
                        <p className="text-sm text-muted-foreground font-normal">
                          {formatAudienceSummary(t, deptNameById)} · Interval {t.intervalMonths} months
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div
                        className="max-h-[min(420px,55vh)] overflow-auto rounded-md border"
                        role="region"
                        aria-label={`People who need ${t.name}`}
                      >
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-muted z-[1] border-b">
                            <tr>
                              <th className="text-left p-2 font-medium">Person</th>
                              <th className="text-left p-2 font-medium hidden sm:table-cell">Dept</th>
                              <th className="text-left p-2 font-medium min-w-[110px]">Next due</th>
                              <th className="text-left p-2 font-medium min-w-[130px]">Last completed</th>
                              <th className="text-left p-2 font-medium min-w-[100px]">Proof</th>
                              <th className="text-left p-2 font-medium min-w-[110px]">Last updated</th>
                              <th className="text-left p-2 font-medium w-[88px]">History</th>
                              <th className="text-left p-2 font-medium w-[96px]">Update</th>
                            </tr>
                          </thead>
                          <tbody>
                            {people.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="p-4 text-muted-foreground text-center">
                                  No one is in scope for this training with the current rules.
                                </td>
                              </tr>
                            ) : (
                              people.map((u) => {
                                const rowKey = `${t.id}:${u.id}`
                                const c = completionMap.get(`${u.id}:${t.id}`)
                                const rowStatus = trainingCellStatus(
                                  c?.nextDueAt ?? null,
                                  c?.lastCompletedAt ?? null
                                )
                                const uploading = trUploadingKey === rowKey
                                const name = displayUserLabel(u)
                                const proofUrl = c?.completionProofUrl?.trim()
                                return (
                                  <tr key={u.id} className="border-b border-border/60 last:border-0 align-top">
                                    <td className="p-2 font-medium">{name}</td>
                                    <td className="p-2 text-muted-foreground hidden sm:table-cell">
                                      {deptName(u) || '—'}
                                    </td>
                                    <td className="p-2">
                                      <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded ${cellClass(rowStatus)} inline-block`}
                                      >
                                        {c?.nextDueAt ? formatDate(c.nextDueAt) : '—'}
                                      </span>
                                    </td>
                                    <td className="p-2 text-sm text-muted-foreground">
                                      {c?.lastCompletedAt ? formatDate(c.lastCompletedAt) : '—'}
                                    </td>
                                    <td className="p-2">
                                      {proofUrl ? (
                                        <a
                                          href={proofUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary text-xs inline-flex items-center gap-0.5 hover:underline"
                                          tabIndex={0}
                                          aria-label={`View completion proof for ${name}`}
                                        >
                                          View
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                                      {c?.updatedAt ? formatDateTime(c.updatedAt) : '—'}
                                    </td>
                                    <td className="p-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs"
                                        disabled={uploading}
                                        onClick={() =>
                                          setTcHistoryOpen({
                                            userId: u.id,
                                            trainingTypeId: t.id,
                                            personLabel: name,
                                            trainingName: t.name,
                                          })
                                        }
                                        aria-label={`View completion history for ${name}, ${t.name}`}
                                      >
                                        History
                                      </Button>
                                    </td>
                                    <td className="p-2">
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="h-8 text-xs"
                                        disabled={uploading}
                                        onClick={() => {
                                          setTrUpdateLastCompleted(
                                            c?.lastCompletedAt?.slice(0, 10) ?? ''
                                          )
                                          setTrUpdateFile(undefined)
                                          setTrUpdateModal({
                                            trainingTypeId: t.id,
                                            userId: u.id,
                                            trainingName: t.name,
                                            personLabel: name,
                                          })
                                        }}
                                        aria-label={`Update training completion for ${name}, ${t.name}`}
                                      >
                                        Update
                                      </Button>
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </TabsContent>

          <TabsContent value="records" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mark training completed</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Choose a training type first to see who it applies to. Select people, upload proof for each, then save.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 max-w-3xl">
                <div className="space-y-1">
                  <Label htmlFor="record-training-type">Training type</Label>
                  <Select value={completeTypeId} onValueChange={setCompleteTypeId}>
                    <SelectTrigger id="record-training-type" aria-label="Training type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {matrix?.trainingTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="record-complete-date">Last completed date (applies to everyone selected)</Label>
                  <Input
                    id="record-complete-date"
                    type="date"
                    value={completeDate}
                    onChange={(e) => setCompleteDate(e.target.value)}
                    disabled={!completeTypeId}
                  />
                </div>
                {!completeTypeId ? (
                  <p className="text-sm text-muted-foreground">Select a training type to choose attendees.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="record-applicant-filter">Filter names</Label>
                      <Input
                        id="record-applicant-filter"
                        placeholder="Name or email"
                        value={completeApplicantFilter}
                        onChange={(e) => setCompleteApplicantFilter(e.target.value)}
                        aria-label="Filter applicable users by name or email"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleSelectAllFilteredApplicants}>
                          Select all in list
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleClearFilteredApplicantsSelection}
                        >
                          Clear selection (list)
                        </Button>
                      </div>
                      <div
                        className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1"
                        role="group"
                        aria-label="People this training applies to"
                      >
                        {filteredUsersApplicableToComplete.length === 0 ? (
                          <p className="text-sm text-muted-foreground px-1 py-2">No matches.</p>
                        ) : (
                          filteredUsersApplicableToComplete.map((u) => {
                            const name = displayUserLabel(u)
                            const checked = completeSelectedUserIds.includes(u.id)
                            const trainingName = selectedTrainingTypeForComplete?.name ?? 'Training'
                            return (
                              <div
                                key={u.id}
                                className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/60"
                              >
                                <label className="flex flex-1 min-w-0 items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 shrink-0 rounded border border-input"
                                    checked={checked}
                                    onChange={(e) => handleToggleCompleteApplicant(u.id, e.target.checked)}
                                    aria-label={`Select ${name} for completion`}
                                  />
                                  <span className="text-sm truncate">{name}</span>
                                  {u.email ? (
                                    <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                                  ) : null}
                                </label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 shrink-0 text-xs px-2"
                                  disabled={completeBatchSaving}
                                  onClick={() =>
                                    setTcHistoryOpen({
                                      userId: u.id,
                                      trainingTypeId: completeTypeId,
                                      personLabel: name,
                                      trainingName,
                                    })
                                  }
                                  aria-label={`View previous completion records for ${name}, ${trainingName}`}
                                >
                                  History
                                </Button>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                    {completeSelectedUserIds.length > 0 ? (
                      <div className="space-y-3 rounded-md border p-3">
                        <p className="text-sm font-medium">Proof document per person (required)</p>
                        <ul className="space-y-3">
                          {completeSelectedUserIds.map((userId) => {
                            const u = matrix?.users.find((x) => x.id === userId)
                            const name = u ? displayUserLabel(u) : userId
                            const proof = completeProofByUser[userId]
                            const uploading = completeProofUploadingUserId === userId
                            return (
                              <li key={userId} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end border-b border-border/60 pb-3 last:border-0 last:pb-0">
                                <div className="space-y-1 min-w-0">
                                  <span className="text-sm font-medium block truncate">{name}</span>
                                  <Input
                                    type="file"
                                    accept="application/pdf,image/jpeg,image/png,image/gif,.pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => void handleCompleteProofFileChange(userId, e)}
                                    disabled={uploading || completeBatchSaving}
                                    aria-label={`Upload completion proof for ${name}`}
                                    className="text-xs"
                                  />
                                  {uploading ? (
                                    <span className="text-xs text-muted-foreground">Uploading…</span>
                                  ) : null}
                                  {proof ? (
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                      <span className="text-muted-foreground truncate max-w-[220px]" title={proof.fileName}>
                                        {proof.fileName}
                                      </span>
                                      <a
                                        href={proof.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary underline inline-flex items-center gap-0.5"
                                        tabIndex={0}
                                        aria-label={`View uploaded file for ${name}`}
                                      >
                                        View
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() => handleClearCompleteProof(userId)}
                                        disabled={completeBatchSaving}
                                      >
                                        Remove file
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      onClick={() => void handleSaveCompleteBatch()}
                      disabled={
                        completeBatchSaving ||
                        !completeDate ||
                        completeSelectedUserIds.length === 0
                      }
                    >
                      {completeBatchSaving ? 'Saving…' : 'Save completions'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add document type</CardTitle>
                <p className="text-sm text-muted-foreground font-normal">
                  Create a compliance document category (e.g. a certificate or form). Leave roles empty so it applies
                  to everyone; otherwise only those roles will appear under that document below.
                </p>
              </CardHeader>
              <CardContent className="grid gap-3 max-w-xl">
                <div className="space-y-1">
                  <Label htmlFor="dc-new-label">Name</Label>
                  <Input
                    id="dc-new-label"
                    value={pdNewLabel}
                    onChange={(e) => setPdNewLabel(e.target.value)}
                    placeholder="e.g. Dangerous goods awareness"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Limit to roles (optional)</Label>
                  <div
                    className="max-h-32 overflow-y-auto rounded border p-2 flex flex-wrap gap-2"
                    role="group"
                    aria-label="Roles for new document type"
                  >
                    {AUDIENCE_ROLE_OPTIONS.map((code) => (
                      <label key={code} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pdNewRoles.includes(code)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPdNewRoles((p) => (p.includes(code) ? p : [...p, code]))
                            } else {
                              setPdNewRoles((p) => p.filter((x) => x !== code))
                            }
                          }}
                          className="rounded border-input"
                        />
                        {code.replace(/_/g, ' ')}
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="button" disabled={pdKindSaving} onClick={() => void handleCreatePersonalDocKind()}>
                  Add document type
                </Button>
              </CardContent>
            </Card>

            {personalDocumentKindsList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No document types loaded.</p>
            ) : (
              personalDocumentKindsList.map((k) => {
                const people = documentComplianceUsersByKind.get(k.code) ?? []
                return (
                  <Card key={k.id}>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="text-lg">{k.label}</CardTitle>
                        <p className="text-sm text-muted-foreground font-normal">
                          {formatPersonalDocAudienceSummary(k)}
                        </p>
                        {isOrphanPersonalDocKind(k) ? (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Legacy code in data only — add a catalog entry with this code or migrate records.
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {!isOrphanPersonalDocKind(k) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPersonalDocKindEdit(k)}
                          >
                            Edit audience
                          </Button>
                        ) : null}
                        {!k.isSystem && !isOrphanPersonalDocKind(k) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => void handleDeletePersonalDocKind(k)}
                          >
                            Delete type
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div
                        className="max-h-[min(420px,55vh)] overflow-auto rounded-md border"
                        role="region"
                        aria-label={`People who need ${k.label}`}
                      >
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-muted z-[1] border-b">
                            <tr>
                              <th className="text-left p-2 font-medium">Person</th>
                              <th className="text-left p-2 font-medium hidden sm:table-cell">Dept</th>
                              <th className="text-left p-2 font-medium min-w-[130px]">Expiry</th>
                              <th className="text-left p-2 font-medium min-w-[100px]">File</th>
                              <th className="text-left p-2 font-medium min-w-[110px]">Last updated</th>
                              <th className="text-left p-2 font-medium w-[88px]">History</th>
                              <th className="text-left p-2 font-medium w-[96px]">Update</th>
                            </tr>
                          </thead>
                          <tbody>
                            {people.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="p-4 text-muted-foreground text-center">
                                  No one is in scope for this document with the current role rules.
                                </td>
                              </tr>
                            ) : (
                              people.map((u) => {
                                const rowKey = `${k.code}:${u.id}`
                                const doc = docMap.get(`${u.id}:${k.code}`)
                                const st = docCellStatus(doc?.expiryDate ?? null)
                                const uploading = dcUploadingKey === rowKey
                                const name = displayUserLabel(u)
                                return (
                                  <tr key={u.id} className="border-b border-border/60 last:border-0 align-top">
                                    <td className="p-2 font-medium">{name}</td>
                                    <td className="p-2 text-muted-foreground hidden sm:table-cell">
                                      {deptName(u) || '—'}
                                    </td>
                                    <td className="p-2">
                                      <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded ${cellClass(st)} inline-block`}
                                      >
                                        {doc?.expiryDate ? formatDate(doc.expiryDate) : 'No expiry saved'}
                                      </span>
                                    </td>
                                    <td className="p-2">
                                      {doc?.pdfFileUrl ? (
                                        <a
                                          href={doc.pdfFileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary text-xs inline-flex items-center gap-0.5 hover:underline"
                                          tabIndex={0}
                                          aria-label={`View current file for ${name}`}
                                        >
                                          View
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                                      {doc?.updatedAt ? formatDateTime(doc.updatedAt) : '—'}
                                    </td>
                                    <td className="p-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs"
                                        disabled={pdKindSaving}
                                        onClick={() =>
                                          setDcHistoryOpen({
                                            userId: u.id,
                                            documentKind: k.code,
                                            personLabel: name,
                                            kindLabel: k.label,
                                          })
                                        }
                                        aria-label={`View document history for ${name}, ${k.label}`}
                                      >
                                        History
                                      </Button>
                                    </td>
                                    <td className="p-2">
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="h-8 text-xs"
                                        disabled={uploading || pdKindSaving}
                                        onClick={() => {
                                          setDcUpdateExpiry(doc?.expiryDate?.slice(0, 10) ?? '')
                                          setDcUpdateFile(undefined)
                                          setDcUpdateModal({
                                            kindCode: k.code,
                                            userId: u.id,
                                            kindLabel: k.label,
                                            personLabel: name,
                                          })
                                        }}
                                        aria-label={`Update document compliance for ${name}, ${k.label}`}
                                      >
                                        Update
                                      </Button>
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}

            <Dialog
              open={pdKindDialogOpen}
              onOpenChange={(open) => {
                setPdKindDialogOpen(open)
                if (!open) setPdEditingKind(null)
              }}
            >
              <DialogContent className="max-w-md" aria-describedby={undefined}>
                <DialogHeader>
                  <DialogTitle>Edit document type (audience)</DialogTitle>
                  <DialogDescription>
                    Change the display name and which roles must provide this document for compliance.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1">
                    <Label htmlFor="dc-edit-label">Name</Label>
                    <Input
                      id="dc-edit-label"
                      value={pdEditLabel}
                      onChange={(e) => setPdEditLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Limit to roles (optional)</Label>
                    <div
                      className="max-h-40 overflow-y-auto rounded border p-2 flex flex-wrap gap-2"
                      role="group"
                      aria-label="Roles for document type"
                    >
                      {AUDIENCE_ROLE_OPTIONS.map((code) => (
                        <label key={code} className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pdEditRoles.includes(code)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPdEditRoles((p) => (p.includes(code) ? p : [...p, code]))
                              } else {
                                setPdEditRoles((p) => p.filter((x) => x !== code))
                              }
                            }}
                            className="rounded border-input"
                          />
                          {code.replace(/_/g, ' ')}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setPdKindDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" disabled={pdKindSaving} onClick={() => void handleSavePersonalDocKindEdit()}>
                    {pdKindSaving ? 'Saving…' : 'Save'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={dcHistoryOpen !== null}
              onOpenChange={(open) => {
                if (!open) setDcHistoryOpen(null)
              }}
            >
              <DialogContent
                className="max-w-lg max-h-[min(520px,80vh)] flex flex-col"
                aria-describedby="dc-history-desc"
              >
                <DialogHeader>
                  <DialogTitle>Previous document records</DialogTitle>
                  <DialogDescription id="dc-history-desc">
                    {dcHistoryOpen
                      ? `Snapshots saved before each change for ${dcHistoryOpen.personLabel} — ${dcHistoryOpen.kindLabel}.`
                      : ''}
                  </DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto flex-1 min-h-0 border rounded-md">
                  {dcHistoryLoading ? (
                    <p className="p-4 text-sm text-muted-foreground">Loading…</p>
                  ) : dcHistoryRows.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No previous versions on file yet.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted border-b">
                        <tr>
                          <th className="text-left p-2 font-medium">Recorded</th>
                          <th className="text-left p-2 font-medium">Expiry then</th>
                          <th className="text-left p-2 font-medium">File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dcHistoryRows.map((row) => (
                          <tr key={row.id} className="border-b border-border/60">
                            <td className="p-2 align-top whitespace-nowrap">
                              {formatDateTime(row.createdAt)}
                            </td>
                            <td className="p-2 align-top">
                              {row.expiryDate ? formatDateOnly(row.expiryDate.slice(0, 10)) : '—'}
                            </td>
                            <td className="p-2 align-top">
                              {row.pdfFileUrl ? (
                                <a
                                  href={row.pdfFileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary inline-flex items-center gap-0.5 hover:underline"
                                  tabIndex={0}
                                >
                                  View
                                  <ExternalLink className="h-3 w-3" aria-hidden />
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDcHistoryOpen(null)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
            </>
          ) : null}

          <TabsContent value="dashboard" className="mt-4 focus-visible:outline-none">
            <div className="mx-auto max-w-6xl bg-white px-8 py-10">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-[#1B3A6B]">Compliance Training</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Currency status by department, role and training type
                  </p>
                </div>
                <div
                  className="flex flex-col gap-1 text-xs text-gray-600 sm:items-end sm:text-right"
                  aria-label="Status legend"
                >
                  <span>
                    <span aria-hidden>🔴</span> Overdue
                  </span>
                  <span>
                    <span aria-hidden>🟡</span> Due ≤30d
                  </span>
                  <span>
                    <span aria-hidden>🟢</span> OK
                  </span>
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-2 items-center">
                <Input
                  placeholder="Filter department"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="max-w-xs"
                  aria-label="Filter by department name"
                />
                <Input
                  placeholder="Search name or email"
                  value={dashboardUserFilter}
                  onChange={(e) => setDashboardUserFilter(e.target.value)}
                  className="max-w-xs"
                  aria-label="Search people by name or email"
                />
                <Select value={roleFilter || 'all'} onValueChange={(v) => setRoleFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="QUALITY_MANAGER">Quality Manager</SelectItem>
                    <SelectItem value="AUDITOR">Auditor</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="DEPARTMENT_HEAD">Department Head</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={handleExportExcel} disabled={!matrix}>
                  Export Excel
                </Button>
                <Button type="button" variant="outline" onClick={handleExportPdf} disabled={!matrix}>
                  Export PDF
                </Button>
              </div>

              <p className="mb-6 text-sm text-gray-600" role="status" aria-live="polite">
                {loading || !matrix ? (
                  'Loading summary…'
                ) : (
                  <>
                    <span className="font-medium text-gray-800">
                      {dashboardTrainingOnlyCellCounts?.people ?? 0}
                    </span>{' '}
                    people shown ·{' '}
                    <span className="font-medium text-red-600">
                      {dashboardTrainingOnlyCellCounts?.red ?? 0}
                    </span>{' '}
                    overdue ·{' '}
                    <span className="font-medium text-amber-600">
                      {dashboardTrainingOnlyCellCounts?.amber ?? 0}
                    </span>{' '}
                    due within 30 days ·{' '}
                    <span className="font-medium text-green-700">
                      {dashboardTrainingOnlyCellCounts?.green ?? 0}
                    </span>{' '}
                    OK
                  </>
                )}
              </p>

              {loading || !matrix ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : dashboardDeptRoleTrainingMatrix.length === 0 ? (
                <p className="text-sm text-gray-500">No people match the current filters.</p>
              ) : (
                <div className="space-y-4">
                  {dashboardDeptRoleTrainingMatrix.map((dept, deptIndex) => {
                    const deptBodyId = `dept-matrix-${dept.departmentId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
                    const deptExpanded =
                      dashboardDepartmentExpanded[dept.departmentId] ?? (deptIndex === 0)
                    return (
                      <section
                        key={dept.departmentId}
                        className="overflow-hidden rounded-md border border-gray-200 shadow-sm"
                        aria-labelledby={`compliance-dept-h-${dept.departmentId}`}
                      >
                        <button
                          type="button"
                          id={`compliance-dept-h-${dept.departmentId}`}
                          className="flex w-full items-center justify-between gap-3 bg-[#1B3A6B] px-4 py-3 text-left transition-colors hover:bg-[#16325c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B3A6B]"
                          onClick={() =>
                            setDashboardDepartmentExpanded((prev) => ({
                              ...prev,
                              [dept.departmentId]: !deptExpanded,
                            }))
                          }
                          aria-expanded={deptExpanded}
                          aria-controls={deptBodyId}
                        >
                          <span className="flex items-center gap-2">
                            {deptExpanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-white" aria-hidden />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-white" aria-hidden />
                            )}
                            <span className="text-[15px] font-bold text-white">{dept.departmentLabel}</span>
                          </span>
                          <span className="text-sm text-gray-200">
                            {dept.uniquePeople} {dept.uniquePeople === 1 ? 'person' : 'people'} total
                          </span>
                        </button>
                        <div
                          className={cn(
                            'grid transition-[grid-template-rows] duration-300 ease-in-out',
                            deptExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                          )}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div id={deptBodyId} className="overflow-x-auto border-t border-gray-200">
                              <table className="w-full min-w-[640px] border-collapse text-sm">
                                <thead className="sticky top-0 z-20 bg-white shadow-[0_1px_0_0_rgb(229,231,235)]">
                                  <tr>
                                    <th
                                      scope="col"
                                      className="sticky left-0 z-30 min-w-[140px] bg-white px-3 py-3 text-left text-xs font-semibold text-gray-700"
                                    >
                                      Training
                                    </th>
                                    {dept.roles.map((col) => (
                                      <th
                                        key={col.roleCode}
                                        scope="col"
                                        className="min-w-[120px] border-l border-gray-200 px-2 py-3 text-center align-bottom"
                                      >
                                        <div className="font-bold text-gray-900">{col.roleLabel}</div>
                                        <div className="mt-0.5 text-[11px] font-normal text-gray-500">
                                          {col.people} {col.people === 1 ? 'person' : 'people'}
                                        </div>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {dept.trainingRows.length === 0 ? (
                                    <tr>
                                      <td
                                        colSpan={dept.roles.length + 1}
                                        className="px-3 py-6 text-center text-sm text-gray-500"
                                      >
                                        No applicable training types for this department with the current filters.
                                      </td>
                                    </tr>
                                  ) : null}
                                  {dept.trainingRows.map((row, rowIdx) => (
                                    <tr
                                      key={row.trainingType.id}
                                      className={cn(
                                        'group border-b border-gray-200 transition-colors hover:bg-[#EFF6FF]',
                                        rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FB]'
                                      )}
                                    >
                                      <th
                                        scope="row"
                                        className={cn(
                                          'sticky left-0 z-10 px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 group-hover:bg-[#EFF6FF]',
                                          rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FB]'
                                        )}
                                      >
                                        {row.trainingType.name}
                                      </th>
                                      {dept.roles.map((col) => {
                                        const cell = row.cellsByRole[col.roleCode]
                                        const na = !cell || cell.na
                                        const showPills = cell && !cell.na
                                        const cellBg = na
                                          ? 'bg-gray-50'
                                          : cell.red > 0
                                            ? 'bg-[#FFF5F5]'
                                            : cell.amber > 0
                                              ? 'bg-[#FFFBEB]'
                                              : 'bg-transparent'
                                        const openDrawer = (status: ComplianceCellStatus) => {
                                          setComplianceDrawer({
                                            departmentId: dept.departmentId,
                                            departmentLabel: dept.departmentLabel,
                                            roleCode: col.roleCode,
                                            roleLabel: col.roleLabel,
                                            trainingTypeId: row.trainingType.id,
                                            trainingTypeName: row.trainingType.name,
                                            status,
                                          })
                                        }
                                        return (
                                          <td
                                            key={col.roleCode}
                                            className={cn(
                                              'border-l border-gray-200 px-2 py-2 align-middle group-hover:bg-[#EFF6FF]',
                                              cellBg
                                            )}
                                          >
                                            {na ? (
                                              <div className="text-center text-gray-400">—</div>
                                            ) : (
                                              <div className="flex flex-wrap items-center justify-center gap-1">
                                                {cell.red > 0 ? (
                                                  <button
                                                    type="button"
                                                    className="inline-flex items-center gap-0.5 rounded-full border border-red-200 bg-white px-2 py-0.5 text-[10px] font-medium text-red-700 shadow-sm hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                                    onClick={() => openDrawer('red')}
                                                    aria-haspopup="dialog"
                                                    aria-label={`${cell.red} overdue for ${row.trainingType.name}, ${col.roleLabel}`}
                                                  >
                                                    <span aria-hidden>🔴</span> {cell.red} overdue
                                                  </button>
                                                ) : null}
                                                {cell.amber > 0 ? (
                                                  <button
                                                    type="button"
                                                    className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-medium text-amber-800 shadow-sm hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                                    onClick={() => openDrawer('amber')}
                                                    aria-haspopup="dialog"
                                                    aria-label={`${cell.amber} due soon for ${row.trainingType.name}, ${col.roleLabel}`}
                                                  >
                                                    <span aria-hidden>🟡</span> {cell.amber} due soon
                                                  </button>
                                                ) : null}
                                                {cell.green > 0 ? (
                                                  <button
                                                    type="button"
                                                    className="inline-flex items-center gap-0.5 rounded-full border border-green-200 bg-white px-2 py-0.5 text-[10px] font-medium text-green-800 shadow-sm hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
                                                    onClick={() => openDrawer('green')}
                                                    aria-haspopup="dialog"
                                                    aria-label={`${cell.green} OK for ${row.trainingType.name}, ${col.roleLabel}`}
                                                  >
                                                    <span aria-hidden>🟢</span> {cell.green} ok
                                                  </button>
                                                ) : null}
                                              </div>
                                            )}
                                          </td>
                                        )
                                      })}
                                    </tr>
                                  ))}
                                  {dept.trainingRows.length > 0 ? (
                                    <tr className="bg-[#F1F4F8] font-semibold">
                                      <th
                                        scope="row"
                                        className="sticky left-0 z-10 bg-[#F1F4F8] px-3 py-3 text-left text-sm text-gray-900"
                                      >
                                        Department Total
                                      </th>
                                      {dept.roles.map((col) => (
                                        <td
                                          key={col.roleCode}
                                          className="border-l border-gray-200 px-2 py-3 text-center text-sm font-bold text-red-600"
                                        >
                                          {dept.summaryOverdueByRole[col.roleCode] ?? 0}
                                        </td>
                                      ))}
                                    </tr>
                                  ) : null}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </section>
                    )
                  })}
                </div>
              )}

              <Sheet
                open={complianceDrawer !== null}
                onOpenChange={(open) => {
                  if (!open) setComplianceDrawer(null)
                }}
              >
                <SheetContent
                  side="right"
                  className="flex w-[420px] max-w-[100vw] flex-col border-l p-0 sm:max-w-[420px]"
                  aria-describedby={complianceDrawer ? 'compliance-drawer-desc' : undefined}
                >
                  {complianceDrawer ? (
                    <>
                      <SheetHeader className="border-b border-gray-200">
                        <SheetTitle className="text-left text-xl font-bold text-[#1B3A6B]">
                          {complianceDrawer.trainingTypeName}
                        </SheetTitle>
                        <SheetDescription id="compliance-drawer-desc" className="text-left text-xs text-gray-500">
                          {complianceDrawer.departmentLabel} › {complianceDrawer.roleLabel} ›{' '}
                          {complianceDrawer.status === 'red'
                            ? 'Overdue'
                            : complianceDrawer.status === 'amber'
                              ? 'Due ≤30d'
                              : 'OK'}
                        </SheetDescription>
                      </SheetHeader>
                      <div className="flex-1 overflow-y-auto px-6 py-4">
                        {complianceDrawerPeople.length === 0 ? (
                          <p className="text-sm text-gray-500">No people in this group.</p>
                        ) : (
                          <ul className="space-y-3">
                            {complianceDrawerPeople.map((u) => {
                              const c = completionMap.get(`${u.id}:${complianceDrawer.trainingTypeId}`)
                              const name = complianceMatrixUserLabel(u)
                              return (
                                <li
                                  key={u.id}
                                  className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="font-semibold text-gray-900">{name}</span>
                                    <span
                                      className={cn(
                                        'shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase',
                                        complianceDrawer.status === 'red' && 'bg-red-100 text-red-800',
                                        complianceDrawer.status === 'amber' && 'bg-amber-100 text-amber-900',
                                        complianceDrawer.status === 'green' && 'bg-green-100 text-green-800'
                                      )}
                                    >
                                      {complianceDrawer.status === 'red'
                                        ? 'Overdue'
                                        : complianceDrawer.status === 'amber'
                                          ? 'Due soon'
                                          : 'OK'}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-gray-500">
                                    Next due: {c?.nextDueAt ? formatDate(c.nextDueAt) : '—'}
                                  </p>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    </>
                  ) : null}
                </SheetContent>
              </Sheet>
            </div>
          </TabsContent>

        </Tabs>

        <Dialog
          open={dcUpdateModal !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDcUpdateModal(null)
              setDcUpdateFile(undefined)
            }
          }}
        >
          <DialogContent className="max-w-md" aria-describedby="dc-update-desc">
            <DialogHeader>
              <DialogTitle>Update document</DialogTitle>
              <DialogDescription id="dc-update-desc">
                {dcUpdateModal
                  ? `${dcUpdateModal.personLabel} — ${dcUpdateModal.kindLabel}. Set expiry and upload a file if required, then save.`
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="dc-update-expiry">Expiry date</Label>
                <Input
                  id="dc-update-expiry"
                  type="date"
                  value={dcUpdateExpiry}
                  onChange={(e) => setDcUpdateExpiry(e.target.value)}
                  disabled={
                    !!dcUpdateModal &&
                    dcUploadingKey === `${dcUpdateModal.kindCode}:${dcUpdateModal.userId}`
                  }
                  aria-label="Document expiry date"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dc-update-file">Certificate or document file</Label>
                <Input
                  id="dc-update-file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/gif,.pdf,.jpg,.jpeg,.png"
                  disabled={
                    !!dcUpdateModal &&
                    dcUploadingKey === `${dcUpdateModal.kindCode}:${dcUpdateModal.userId}`
                  }
                  aria-label="Upload or replace document file"
                  onChange={(e) => {
                    setDcUpdateFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                  className="cursor-pointer text-sm"
                />
                <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                  <p className="text-xs text-muted-foreground">
                    {dcUpdateFile ? (
                      <>
                        Selected:{' '}
                        <span className="font-medium text-foreground" title={dcUpdateFile.name}>
                          {dcUpdateFile.name.length > 48
                            ? `${dcUpdateFile.name.slice(0, 45)}…`
                            : dcUpdateFile.name}
                        </span>
                      </>
                    ) : dcUpdateModal &&
                      docMap.get(`${dcUpdateModal.userId}:${dcUpdateModal.kindCode}`)?.pdfFileUrl ? (
                      'No new file selected — existing file on record will be kept if you save.'
                    ) : (
                      'No new file selected.'
                    )}
                  </p>
                  {dcUpdateFile ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setDcUpdateFile(undefined)}
                      aria-label="Clear selected file"
                    >
                      Clear selection
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Required when no file is on record yet; otherwise optional to keep the existing file.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDcUpdateModal(null)
                  setDcUpdateFile(undefined)
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  pdKindSaving ||
                  (dcUpdateModal !== null &&
                    dcUploadingKey === `${dcUpdateModal.kindCode}:${dcUpdateModal.userId}`)
                }
                onClick={() => {
                  if (!dcUpdateModal) return
                  void handleSaveDocumentComplianceRow(
                    dcUpdateModal.kindCode,
                    dcUpdateModal.userId,
                    dcUpdateExpiry,
                    dcUpdateFile
                  )
                }}
              >
                {dcUpdateModal !== null &&
                dcUploadingKey === `${dcUpdateModal.kindCode}:${dcUpdateModal.userId}`
                  ? 'Saving…'
                  : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={trUpdateModal !== null}
          onOpenChange={(open) => {
            if (!open) {
              setTrUpdateModal(null)
              setTrUpdateFile(undefined)
            }
          }}
        >
          <DialogContent className="max-w-md" aria-describedby="tr-update-desc">
            <DialogHeader>
              <DialogTitle>Update training completion</DialogTitle>
              <DialogDescription id="tr-update-desc">
                {trUpdateModal
                  ? `${trUpdateModal.personLabel} — ${trUpdateModal.trainingName}. Set last completed date and proof file, then save.`
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="tr-update-last-completed">Last completed date</Label>
                <Input
                  id="tr-update-last-completed"
                  type="date"
                  value={trUpdateLastCompleted}
                  onChange={(e) => setTrUpdateLastCompleted(e.target.value)}
                  disabled={
                    !!trUpdateModal &&
                    trUploadingKey === `${trUpdateModal.trainingTypeId}:${trUpdateModal.userId}`
                  }
                  aria-label="Last completed date"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tr-update-proof">Completion proof file</Label>
                <Input
                  id="tr-update-proof"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/gif,.pdf,.jpg,.jpeg,.png"
                  disabled={
                    !!trUpdateModal &&
                    trUploadingKey === `${trUpdateModal.trainingTypeId}:${trUpdateModal.userId}`
                  }
                  aria-label="Upload or replace completion proof"
                  onChange={(e) => {
                    setTrUpdateFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                  className="cursor-pointer text-sm"
                />
                <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                  <p className="text-xs text-muted-foreground">
                    {trUpdateFile ? (
                      <>
                        Selected:{' '}
                        <span className="font-medium text-foreground" title={trUpdateFile.name}>
                          {trUpdateFile.name.length > 48
                            ? `${trUpdateFile.name.slice(0, 45)}…`
                            : trUpdateFile.name}
                        </span>
                      </>
                    ) : trUpdateModal &&
                      completionMap
                        .get(`${trUpdateModal.userId}:${trUpdateModal.trainingTypeId}`)
                        ?.completionProofUrl?.trim() ? (
                      'No new file selected — existing proof on record will be kept if you save.'
                    ) : (
                      'No new file selected.'
                    )}
                  </p>
                  {trUpdateFile ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setTrUpdateFile(undefined)}
                      aria-label="Clear selected proof file"
                    >
                      Clear selection
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Required when no proof is on file yet; otherwise optional to keep the existing proof.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTrUpdateModal(null)
                  setTrUpdateFile(undefined)
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  trUpdateModal !== null &&
                  trUploadingKey === `${trUpdateModal.trainingTypeId}:${trUpdateModal.userId}`
                }
                onClick={() => {
                  if (!trUpdateModal) return
                  void handleSaveTrainingComplianceRow(
                    trUpdateModal.trainingTypeId,
                    trUpdateModal.userId,
                    trUpdateLastCompleted,
                    trUpdateFile
                  )
                }}
              >
                {trUpdateModal !== null &&
                trUploadingKey === `${trUpdateModal.trainingTypeId}:${trUpdateModal.userId}`
                  ? 'Saving…'
                  : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={tcHistoryOpen !== null}
          onOpenChange={(open) => {
            if (!open) setTcHistoryOpen(null)
          }}
        >
          <DialogContent
            className="max-w-2xl max-h-[min(520px,80vh)] flex flex-col"
            aria-describedby="tc-history-desc"
          >
            <DialogHeader>
              <DialogTitle>Previous training completion records</DialogTitle>
              <DialogDescription id="tc-history-desc">
                {tcHistoryOpen
                  ? `Values stored before each update for ${tcHistoryOpen.personLabel} — ${tcHistoryOpen.trainingName}.`
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 min-h-0 border rounded-md">
              {tcHistoryLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading…</p>
              ) : tcHistoryRows.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No previous completion records on file yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted border-b">
                    <tr>
                      <th className="text-left p-2 font-medium">Recorded</th>
                      <th className="text-left p-2 font-medium">Last completed (then)</th>
                      <th className="text-left p-2 font-medium">Next due (then)</th>
                      <th className="text-left p-2 font-medium">Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tcHistoryRows.map((row) => (
                      <tr key={row.id} className="border-b border-border/60">
                        <td className="p-2 align-top whitespace-nowrap">
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td className="p-2 align-top whitespace-nowrap">
                          {row.lastCompletedAt ? formatDateTime(row.lastCompletedAt) : '—'}
                        </td>
                        <td className="p-2 align-top whitespace-nowrap">
                          {row.nextDueAt ? formatDateTime(row.nextDueAt) : '—'}
                        </td>
                        <td className="p-2 align-top">
                          {row.completionProofUrl ? (
                            <a
                              href={row.completionProofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary inline-flex items-center gap-0.5 hover:underline"
                              tabIndex={0}
                            >
                              View
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTcHistoryOpen(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

export default TrainingCompliancePage
