'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Building2, Settings, Building, Pencil, Search, BarChart3, Tags, AlertTriangle } from 'lucide-react'
import { isAdminOrQM } from '@/lib/permissions'
import { KpiManagementContent } from '@/components/admin/kpi-management-content'
import { FindingClassificationsContent } from '@/components/admin/finding-classifications-content'
import { RegulatoryViolationsContent } from '@/components/admin/regulatory-violations-content'
import {
  Dialog,
  DialogContent,
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

const USER_ROLES = [
  'QUALITY_MANAGER',
  'ACCOUNTABLE_MANAGER',
  'AUDITOR',
  'DEPARTMENT_HEAD',
  'STAFF',
  'FOCAL_PERSON',
  'DIRECTOR_OF_SAFETY',
  'SAFETY_OFFICER',
] as const

const SAFETY_OPERATIONAL_AREAS = [
  'airline_ops',
  'mro_maintenance',
  'airport_ground_ops',
  'all',
  'other',
] as const

type UserRole = (typeof USER_ROLES)[number]

type DepartmentOption = {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
}

type UserWithDept = {
  id: string
  email: string
  firstName: string
  lastName: string
  role?: UserRole
  roles?: string[]
  organizationId?: string | null
  safetyOperationalArea?: (typeof SAFETY_OPERATIONAL_AREAS)[number] | null
  position: string | null
  isActive?: boolean
  Department: { id: string; name: string } | null
}

const getUserRoles = (u: UserWithDept): string[] =>
  Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : u.role ? [u.role] : []

type Organization = {
  id: string
  name: string
  type: string | null
  contact: string | null
  address: string | null
  isActive: boolean
}

const AdminPage = () => {
  const router = useRouter()
  const [adminAllowed, setAdminAllowed] = useState<boolean | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [users, setUsers] = useState<UserWithDept[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (!res.ok) {
          setAdminAllowed(false)
          return
        }
        const data = await res.json()
        const userRoles = Array.isArray(data.roles) ? data.roles : []
        if (!isAdminOrQM(userRoles)) {
          router.replace('/dashboard')
          return
        }
        setRoles(userRoles)
        setAdminAllowed(true)
      } catch {
        setAdminAllowed(false)
      }
    }
    check()
  }, [router])
  const [includeInactiveUsers, setIncludeInactiveUsers] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all')
  const [userDeptFilter, setUserDeptFilter] = useState<string>('all')
  const [editUserOpen, setEditUserOpen] = useState(false)
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithDept | null>(null)
  const [userForm, setUserForm] = useState({
    roles: [] as string[],
    safetyOperationalArea: '' as string,
    departmentId: '',
    isActive: true,
    position: '',
    phone: '',
  })
  const [addUserForm, setAddUserForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    roles: ['STAFF'] as string[],
    safetyOperationalArea: '' as string,
    departmentId: '',
    position: '',
    phone: '',
  })
  const [userSubmitting, setUserSubmitting] = useState(false)
  const [addUserSubmitting, setAddUserSubmitting] = useState(false)

  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [deptLoading, setDeptLoading] = useState(false)
  const [includeInactiveDepts, setIncludeInactiveDepts] = useState(false)
  const [deptDialogOpen, setDeptDialogOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<DepartmentOption | null>(null)
  const [deptForm, setDeptForm] = useState({
    name: '',
    code: '',
    description: '',
    isActive: true,
  })
  const [deptSubmitting, setDeptSubmitting] = useState(false)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [orgLoading, setOrgLoading] = useState(false)
  const [orgDialogOpen, setOrgDialogOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [orgForm, setOrgForm] = useState({
    name: '',
    type: '',
    contact: '',
    address: '',
  })
  const [orgSubmitting, setOrgSubmitting] = useState(false)
  const [focalPersonOrg, setFocalPersonOrg] = useState<Organization | null>(null)
  const [focalPersonForm, setFocalPersonForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  })
  const [focalPersonSubmitting, setFocalPersonSubmitting] = useState(false)

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await fetch(
        `/api/users?includeInactive=${includeInactiveUsers}`
      )
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchDepartments = async () => {
    setDeptLoading(true)
    try {
      const res = await fetch(
        `/api/departments?includeInactive=${includeInactiveDepts}`
      )
      if (res.ok) {
        const data = await res.json()
        setDepartments(data)
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error)
    } finally {
      setDeptLoading(false)
    }
  }

  const fetchOrganizations = async () => {
    setOrgLoading(true)
    try {
      const res = await fetch('/api/organizations')
      if (res.ok) {
        const data = await res.json()
        setOrganizations(data)
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
    } finally {
      setOrgLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [includeInactiveUsers])

  useEffect(() => {
    fetchDepartments()
  }, [includeInactiveDepts])

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const filteredUsers = useMemo(() => {
    let list = users
    const q = userSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.firstName.toLowerCase().includes(q)
      )
    }
    if (userRoleFilter !== 'all') {
      list = list.filter((u) => u.role === userRoleFilter)
    }
    if (userDeptFilter !== 'all') {
      list = list.filter(
        (u) => u.Department?.id === userDeptFilter
      )
    }
    return list
  }, [users, userSearch, userRoleFilter, userDeptFilter])

  const handleOpenAddUser = () => {
    setAddUserForm({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      roles: ['STAFF'],
      safetyOperationalArea: '',
      departmentId: '',
      position: '',
      phone: '',
    })
    setAddUserOpen(true)
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !addUserForm.email.trim() ||
      !addUserForm.password ||
      addUserForm.password.length < 6 ||
      !addUserForm.firstName.trim() ||
      !addUserForm.lastName.trim() ||
      addUserForm.roles.length === 0
    )
      return
    if (addUserForm.roles.includes('SAFETY_OFFICER') && !addUserForm.safetyOperationalArea) {
      alert('Safety operational area is required for Safety Officer role')
      return
    }
    setAddUserSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: addUserForm.email.trim(),
          password: addUserForm.password,
          firstName: addUserForm.firstName.trim(),
          lastName: addUserForm.lastName.trim(),
          roles: addUserForm.roles,
          safetyOperationalArea: addUserForm.safetyOperationalArea || undefined,
          departmentId: addUserForm.departmentId || undefined,
          position: addUserForm.position.trim() || undefined,
          phone: addUserForm.phone.trim() || undefined,
        }),
      })
      if (res.ok) {
        setAddUserOpen(false)
        fetchUsers()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to add user')
      }
    } catch (error) {
      console.error('Error adding user:', error)
      alert('Failed to add user')
    } finally {
      setAddUserSubmitting(false)
    }
  }

  const handleOpenEditUser = (user: UserWithDept) => {
    setEditingUser(user)
    setUserForm({
      roles: getUserRoles(user),
      safetyOperationalArea: user.safetyOperationalArea ?? '',
      departmentId: user.Department?.id ?? '',
      isActive: user.isActive !== false,
      position: user.position ?? '',
      phone: '',
    })
    setEditUserOpen(true)
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    if (userForm.roles.length === 0) {
      alert('Select at least one role')
      return
    }
    if (userForm.roles.includes('SAFETY_OFFICER') && !userForm.safetyOperationalArea) {
      alert('Safety operational area is required for Safety Officer role')
      return
    }
    setUserSubmitting(true)
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roles: userForm.roles,
          safetyOperationalArea: userForm.safetyOperationalArea || null,
          departmentId: userForm.departmentId || null,
          isActive: userForm.isActive,
          position: userForm.position || undefined,
          phone: userForm.phone || undefined,
        }),
      })
      if (res.ok) {
        setEditUserOpen(false)
        setEditingUser(null)
        fetchUsers()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to update user')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Failed to update user')
    } finally {
      setUserSubmitting(false)
    }
  }

  const handleOpenAddDept = () => {
    setEditingDept(null)
    setDeptForm({ name: '', code: '', description: '', isActive: true })
    setDeptDialogOpen(true)
  }

  const handleOpenEditDept = (dept: DepartmentOption) => {
    setEditingDept(dept)
    setDeptForm({
      name: dept.name,
      code: dept.code,
      description: dept.description ?? '',
      isActive: dept.isActive,
    })
    setDeptDialogOpen(true)
  }

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deptForm.name.trim() || !deptForm.code.trim()) return
    setDeptSubmitting(true)
    try {
      if (editingDept) {
        const res = await fetch(`/api/departments/${editingDept.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: deptForm.name.trim(),
            code: deptForm.code.trim().toUpperCase(),
            description: deptForm.description.trim() || null,
            isActive: deptForm.isActive,
          }),
        })
        if (res.ok) {
          setDeptDialogOpen(false)
          setEditingDept(null)
          fetchDepartments()
        } else {
          const err = await res.json().catch(() => ({}))
          alert(err.error || 'Failed to update department')
        }
      } else {
        const res = await fetch('/api/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: deptForm.name.trim(),
            code: deptForm.code.trim().toUpperCase(),
            description: deptForm.description.trim() || null,
          }),
        })
        if (res.ok) {
          setDeptForm({ name: '', code: '', description: '', isActive: true })
          setDeptDialogOpen(false)
          fetchDepartments()
        } else {
          const err = await res.json().catch(() => ({}))
          alert(err.error || 'Failed to add department')
        }
      }
    } catch (error) {
      console.error('Error saving department:', error)
      alert('Failed to save department')
    } finally {
      setDeptSubmitting(false)
    }
  }

  const handleAddOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgForm.name.trim()) return
    setOrgSubmitting(true)
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgForm.name.trim(),
          type: orgForm.type.trim() || undefined,
          contact: orgForm.contact.trim() || undefined,
          address: orgForm.address.trim() || undefined,
        }),
      })
      if (res.ok) {
        setOrgForm({ name: '', type: '', contact: '', address: '' })
        setOrgDialogOpen(false)
        fetchOrganizations()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to add organization')
      }
    } catch (error) {
      console.error('Error adding organization:', error)
      alert('Failed to add organization')
    } finally {
      setOrgSubmitting(false)
    }
  }

  const handleOpenEditOrg = (org: Organization) => {
    setEditingOrg(org)
    setOrgForm({
      name: org.name,
      type: org.type ?? '',
      contact: org.contact ?? '',
      address: org.address ?? '',
    })
  }

  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrg || !orgForm.name.trim()) return
    setOrgSubmitting(true)
    try {
      const res = await fetch(`/api/organizations/${editingOrg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgForm.name.trim(),
          type: orgForm.type.trim() || null,
          contact: orgForm.contact.trim() || null,
          address: orgForm.address.trim() || null,
        }),
      })
      if (res.ok) {
        setEditingOrg(null)
        fetchOrganizations()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to update organization')
      }
    } catch (error) {
      console.error('Error updating organization:', error)
      alert('Failed to update organization')
    } finally {
      setOrgSubmitting(false)
    }
  }

  const handleAddFocalPerson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!focalPersonOrg) return
    const { firstName, lastName, email, password } = focalPersonForm
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || password.length < 6) {
      alert('First name, last name, email and a temporary password (min 6 characters) are required.')
      return
    }
    setFocalPersonSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
          roles: ['FOCAL_PERSON'],
          organizationId: focalPersonOrg.id,
        }),
      })
      if (res.ok) {
        setFocalPersonForm({ firstName: '', lastName: '', email: '', password: '' })
        setFocalPersonOrg(null)
        fetchUsers()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to add focal person')
      }
    } catch (error) {
      console.error('Error adding focal person:', error)
      alert('Failed to add focal person')
    } finally {
      setFocalPersonSubmitting(false)
    }
  }

  if (adminAllowed === null) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </MainLayout>
    )
  }
  if (adminAllowed === false) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Access denied. Redirecting...</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="text-muted-foreground mt-2">
            System administration and configuration
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="departments">
              <Building2 className="mr-2 h-4 w-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="organizations">
              <Building className="mr-2 h-4 w-4" />
              Organizations
            </TabsTrigger>
            {roles.includes('QUALITY_MANAGER') && (
              <>
                <TabsTrigger value="kpis">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  KPI Management
                </TabsTrigger>
                <TabsTrigger value="finding-classifications">
                  <Tags className="mr-2 h-4 w-4" />
                  Finding Classifications
                </TabsTrigger>
                <TabsTrigger value="regulatory-violations">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Regulatory Violations
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Only admins add users; set a temporary password. Users log in
                      with these credentials and can change their password after.
                    </p>
                  </div>
                  <Button
                    onClick={handleOpenAddUser}
                    aria-label="Add user"
                  >
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search by name or email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9"
                      aria-label="Search users"
                    />
                  </div>
                  <Select
                    value={userRoleFilter}
                    onValueChange={setUserRoleFilter}
                  >
                    <SelectTrigger className="w-[180px]" aria-label="Filter by role">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      {USER_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={userDeptFilter}
                    onValueChange={setUserDeptFilter}
                  >
                    <SelectTrigger className="w-[180px]" aria-label="Filter by department">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeInactiveUsers}
                      onChange={(e) => setIncludeInactiveUsers(e.target.checked)}
                      className="rounded border-input"
                      aria-label="Include inactive users"
                    />
                    Include inactive
                  </label>
                </div>
                {usersLoading ? (
                  <p className="text-muted-foreground">Loading users...</p>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-muted-foreground">
                    No users match the filters.
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Name</th>
                          <th className="text-left p-3 font-medium">Email</th>
                          <th className="text-left p-3 font-medium">Roles</th>
                          <th className="text-left p-3 font-medium">Department</th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="w-10 p-3" aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => (
                          <tr
                            key={user.id}
                            className="border-t hover:bg-muted/30"
                          >
                            <td className="p-3">
                              {user.firstName} {user.lastName}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {user.email}
                            </td>
                            <td className="p-3 flex flex-wrap gap-1">
                              {getUserRoles(user).map((r) => (
                                <Badge key={r} variant="secondary">
                                  {r.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                              {getUserRoles(user).length === 0 && '—'}
                            </td>
                            <td className="p-3">
                              {user.Department?.name ?? '—'}
                            </td>
                            <td className="p-3">
                              {user.isActive === false ? (
                                <Badge variant="destructive">Inactive</Badge>
                              ) : (
                                <Badge variant="default">Active</Badge>
                              )}
                            </td>
                            <td className="p-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditUser(user)}
                                aria-label={`Edit ${user.firstName} ${user.lastName}`}
                              >
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

            <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
              <DialogContent aria-describedby="edit-user-desc">
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                </DialogHeader>
                <p id="edit-user-desc" className="sr-only">
                  Update role, department, and status for this user
                </p>
                {editingUser && (
                  <form onSubmit={handleSaveUser} className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      {editingUser.firstName} {editingUser.lastName} (
                      {editingUser.email})
                    </p>
                    <div className="space-y-2">
                      <Label>Roles (at least one)</Label>
                      <div className="flex flex-wrap gap-3 pt-1" role="group" aria-label="User roles">
                        {USER_ROLES.map((r) => (
                          <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={userForm.roles.includes(r)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setUserForm((p) => ({ ...p, roles: [...p.roles, r] }))
                                } else {
                                  setUserForm((p) => ({
                                    ...p,
                                    roles: p.roles.filter((x) => x !== r),
                                  }))
                                }
                              }}
                              className="rounded border-input"
                              aria-label={`Role ${r.replace(/_/g, ' ')}`}
                            />
                            {r.replace(/_/g, ' ')}
                          </label>
                        ))}
                      </div>
                    </div>
                    {userForm.roles.includes('SAFETY_OFFICER') && (
                      <div className="space-y-2">
                        <Label htmlFor="user-safety-area">Safety operational area *</Label>
                        <Select
                          value={userForm.safetyOperationalArea || '__none__'}
                          onValueChange={(v) =>
                            setUserForm((p) => ({
                              ...p,
                              safetyOperationalArea: v === '__none__' ? '' : v,
                            }))
                          }
                        >
                          <SelectTrigger id="user-safety-area" aria-label="Safety operational area">
                            <SelectValue placeholder="Select safety area" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Select area</SelectItem>
                            {SAFETY_OPERATIONAL_AREAS.map((area) => (
                              <SelectItem key={area} value={area}>
                                {area.replace(/_/g, ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="user-department">Department</Label>
                      <Select
                        value={userForm.departmentId || '__none__'}
                        onValueChange={(v) =>
                          setUserForm((p) => ({ ...p, departmentId: v === '__none__' ? '' : v }))
                        }
                      >
                        <SelectTrigger id="user-department" aria-label="Department">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} ({d.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-position">Position</Label>
                      <Input
                        id="user-position"
                        value={userForm.position}
                        onChange={(e) =>
                          setUserForm((p) => ({ ...p, position: e.target.value }))
                        }
                        placeholder="Job title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-phone">Phone</Label>
                      <Input
                        id="user-phone"
                        value={userForm.phone}
                        onChange={(e) =>
                          setUserForm((p) => ({ ...p, phone: e.target.value }))
                        }
                        placeholder="Phone number"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userForm.isActive}
                        onChange={(e) =>
                          setUserForm((p) => ({
                            ...p,
                            isActive: e.target.checked,
                          }))
                        }
                        className="rounded border-input"
                        aria-label="User is active"
                      />
                      Active
                    </label>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditUserOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={userSubmitting}>
                        {userSubmitting ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </form>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
              <DialogContent aria-describedby="add-user-desc">
                <DialogHeader>
                  <DialogTitle>Add User</DialogTitle>
                </DialogHeader>
                <p id="add-user-desc" className="sr-only">
                  Create a new user with email and temporary password
                </p>
                <form onSubmit={handleAddUser} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-user-email">Email *</Label>
                    <Input
                      id="add-user-email"
                      type="email"
                      value={addUserForm.email}
                      onChange={(e) =>
                        setAddUserForm((p) => ({ ...p, email: e.target.value }))
                      }
                      placeholder="user@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-user-password">Temporary password *</Label>
                    <Input
                      id="add-user-password"
                      type="password"
                      value={addUserForm.password}
                      onChange={(e) =>
                        setAddUserForm((p) => ({ ...p, password: e.target.value }))
                      }
                      placeholder="Min. 6 characters"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-muted-foreground">
                      User logs in with this; they can change it later from Change password.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-user-firstName">First name *</Label>
                      <Input
                        id="add-user-firstName"
                        value={addUserForm.firstName}
                        onChange={(e) =>
                          setAddUserForm((p) => ({ ...p, firstName: e.target.value }))
                        }
                        placeholder="First name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-user-lastName">Last name *</Label>
                      <Input
                        id="add-user-lastName"
                        value={addUserForm.lastName}
                        onChange={(e) =>
                          setAddUserForm((p) => ({ ...p, lastName: e.target.value }))
                        }
                        placeholder="Last name"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Roles * (at least one)</Label>
                    <div className="flex flex-wrap gap-3 pt-1" role="group" aria-label="User roles">
                      {USER_ROLES.map((r) => (
                        <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addUserForm.roles.includes(r)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAddUserForm((p) => ({ ...p, roles: [...p.roles, r] }))
                              } else {
                                setAddUserForm((p) => ({
                                  ...p,
                                  roles: p.roles.filter((x) => x !== r),
                                }))
                              }
                            }}
                            className="rounded border-input"
                            aria-label={`Role ${r.replace(/_/g, ' ')}`}
                          />
                          {r.replace(/_/g, ' ')}
                        </label>
                      ))}
                    </div>
                  </div>
                  {addUserForm.roles.includes('SAFETY_OFFICER') && (
                    <div className="space-y-2">
                      <Label htmlFor="add-user-safety-area">Safety operational area *</Label>
                      <Select
                        value={addUserForm.safetyOperationalArea || '__none__'}
                        onValueChange={(v) =>
                          setAddUserForm((p) => ({
                            ...p,
                            safetyOperationalArea: v === '__none__' ? '' : v,
                          }))
                        }
                      >
                        <SelectTrigger id="add-user-safety-area" aria-label="Safety operational area">
                          <SelectValue placeholder="Select safety area" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Select area</SelectItem>
                          {SAFETY_OPERATIONAL_AREAS.map((area) => (
                            <SelectItem key={area} value={area}>
                              {area.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="add-user-department">Department</Label>
                    <Select
                      value={addUserForm.departmentId || '__none__'}
                      onValueChange={(v) =>
                        setAddUserForm((p) => ({ ...p, departmentId: v === '__none__' ? '' : v }))
                      }
                    >
                      <SelectTrigger id="add-user-department" aria-label="Department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-user-position">Position</Label>
                    <Input
                      id="add-user-position"
                      value={addUserForm.position}
                      onChange={(e) =>
                        setAddUserForm((p) => ({ ...p, position: e.target.value }))
                      }
                      placeholder="Job title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-user-phone">Phone</Label>
                    <Input
                      id="add-user-phone"
                      type="tel"
                      value={addUserForm.phone}
                      onChange={(e) =>
                        setAddUserForm((p) => ({ ...p, phone: e.target.value }))
                      }
                      placeholder="Phone number"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddUserOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addUserSubmitting}>
                      {addUserSubmitting ? 'Adding...' : 'Add User'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle>Department Management</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create and edit departments. Departments are used for audits,
                      findings, and user assignment.
                    </p>
                  </div>
                  <Button onClick={handleOpenAddDept} aria-label="Add department">
                    Add Department
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeInactiveDepts}
                    onChange={(e) => setIncludeInactiveDepts(e.target.checked)}
                    className="rounded border-input"
                    aria-label="Include inactive departments"
                  />
                  Include inactive
                </label>
                {deptLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : departments.length === 0 ? (
                  <p className="text-muted-foreground">
                    No departments yet. Add one to get started.
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Code</th>
                          <th className="text-left p-3 font-medium">Name</th>
                          <th className="text-left p-3 font-medium">Description</th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="w-10 p-3" aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {departments.map((dept) => (
                          <tr
                            key={dept.id}
                            className="border-t hover:bg-muted/30"
                          >
                            <td className="p-3 font-mono">{dept.code}</td>
                            <td className="p-3 font-medium">{dept.name}</td>
                            <td className="p-3 text-muted-foreground">
                              {dept.description ?? '—'}
                            </td>
                            <td className="p-3">
                              {dept.isActive ? (
                                <Badge variant="default">Active</Badge>
                              ) : (
                                <Badge variant="destructive">Inactive</Badge>
                              )}
                            </td>
                            <td className="p-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditDept(dept)}
                                aria-label={`Edit ${dept.name}`}
                              >
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

            <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
              <DialogContent aria-describedby="dept-form-desc">
                <DialogHeader>
                  <DialogTitle>
                    {editingDept ? 'Edit Department' : 'Add Department'}
                  </DialogTitle>
                </DialogHeader>
                <p id="dept-form-desc" className="sr-only">
                  Department name, code, and description
                </p>
                <form onSubmit={handleSaveDepartment} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="dept-name">Name *</Label>
                    <Input
                      id="dept-name"
                      value={deptForm.name}
                      onChange={(e) =>
                        setDeptForm((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="e.g. Operations"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dept-code">Code *</Label>
                    <Input
                      id="dept-code"
                      value={deptForm.code}
                      onChange={(e) =>
                        setDeptForm((p) => ({
                          ...p,
                          code: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="e.g. OPS"
                      required
                      disabled={!!editingDept}
                      className="font-mono"
                    />
                    {editingDept && (
                      <p className="text-xs text-muted-foreground">
                        Code cannot be changed after creation.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dept-desc">Description</Label>
                    <Textarea
                      id="dept-desc"
                      value={deptForm.description}
                      onChange={(e) =>
                        setDeptForm((p) => ({ ...p, description: e.target.value }))
                      }
                      placeholder="Optional description"
                      rows={2}
                    />
                  </div>
                  {editingDept && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deptForm.isActive}
                        onChange={(e) =>
                          setDeptForm((p) => ({ ...p, isActive: e.target.checked }))
                        }
                        className="rounded border-input"
                        aria-label="Department is active"
                      />
                      Active
                    </label>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDeptDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={deptSubmitting}>
                      {deptSubmitting
                        ? 'Saving...'
                        : editingDept
                          ? 'Save'
                          : 'Add'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="organizations" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle>Organizations</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add organizations to use as external auditees or 3rd party
                      auditors.
                    </p>
                  </div>
                  <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
                    <DialogTrigger asChild>
                      <Button aria-label="Add organization">
                        Add Organization
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Organization</DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={handleAddOrganization}
                        className="space-y-4 mt-4"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="org-name">Name *</Label>
                          <Input
                            id="org-name"
                            value={orgForm.name}
                            onChange={(e) =>
                              setOrgForm((p) => ({ ...p, name: e.target.value }))
                            }
                            placeholder="Organization name"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="org-type">Type</Label>
                          <Input
                            id="org-type"
                            value={orgForm.type}
                            onChange={(e) =>
                              setOrgForm((p) => ({ ...p, type: e.target.value }))
                            }
                            placeholder="e.g. Certification body, Supplier"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="org-contact">Contact</Label>
                          <Input
                            id="org-contact"
                            value={orgForm.contact}
                            onChange={(e) =>
                              setOrgForm((p) => ({
                                ...p,
                                contact: e.target.value,
                              }))
                            }
                            placeholder="Contact person or email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="org-address">Address</Label>
                          <Textarea
                            id="org-address"
                            value={orgForm.address}
                            onChange={(e) =>
                              setOrgForm((p) => ({ ...p, address: e.target.value }))
                            }
                            placeholder="Address"
                            rows={2}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOrgDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={orgSubmitting}>
                            {orgSubmitting ? 'Adding...' : 'Add'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {orgLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : organizations.length === 0 ? (
                  <p className="text-muted-foreground">
                    No organizations yet. Add one to use as external auditees or
                    3rd party auditors.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {organizations.map((org) => {
                      const orgFocalPersons = users.filter(
                        (u) => (u as UserWithDept).organizationId === org.id
                      )
                      return (
                        <li
                          key={org.id}
                          className="flex flex-col gap-2 p-3 border rounded-lg"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium">{org.name}</p>
                              {(org.type || org.contact || org.address) && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {[org.type, org.contact, org.address]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setFocalPersonOrg(org)}
                                aria-label={`Add focal person for ${org.name}`}
                              >
                                Add focal person
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditOrg(org)}
                                aria-label={`Edit ${org.name}`}
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </div>
                          </div>
                          {orgFocalPersons.length > 0 && (
                            <div className="text-sm text-muted-foreground border-t pt-2 mt-1">
                              <span className="font-medium">Focal persons: </span>
                              {orgFocalPersons
                                .map(
                                  (u) =>
                                    `${u.firstName} ${u.lastName} (${u.email})`
                                )
                                .join(', ')}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Dialog
              open={!!editingOrg}
              onOpenChange={(open) => !open && setEditingOrg(null)}
            >
              <DialogContent aria-describedby="edit-org-desc">
                  <DialogHeader>
                    <DialogTitle>Edit Organization</DialogTitle>
                  </DialogHeader>
                  <p id="edit-org-desc" className="sr-only">
                    Update organization details
                  </p>
                  {editingOrg && (
                  <form
                    onSubmit={handleSaveOrganization}
                    className="space-y-4 mt-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="edit-org-name">Name *</Label>
                      <Input
                        id="edit-org-name"
                        value={orgForm.name}
                        onChange={(e) =>
                          setOrgForm((p) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="Organization name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-org-type">Type</Label>
                      <Input
                        id="edit-org-type"
                        value={orgForm.type}
                        onChange={(e) =>
                          setOrgForm((p) => ({ ...p, type: e.target.value }))
                        }
                        placeholder="e.g. Certification body, Supplier"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-org-contact">Contact</Label>
                      <Input
                        id="edit-org-contact"
                        value={orgForm.contact}
                        onChange={(e) =>
                          setOrgForm((p) => ({
                            ...p,
                            contact: e.target.value,
                          }))
                        }
                        placeholder="Contact person or email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-org-address">Address</Label>
                      <Textarea
                        id="edit-org-address"
                        value={orgForm.address}
                        onChange={(e) =>
                          setOrgForm((p) => ({
                            ...p,
                            address: e.target.value,
                          }))
                        }
                        placeholder="Address"
                        rows={2}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditingOrg(null)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={orgSubmitting}>
                        {orgSubmitting ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </form>
                  )}
                </DialogContent>
              </Dialog>

            <Dialog
              open={!!focalPersonOrg}
              onOpenChange={(open) => !open && setFocalPersonOrg(null)}
            >
              <DialogContent aria-describedby="focal-person-desc">
                <DialogHeader>
                  <DialogTitle>
                    Add focal person{focalPersonOrg ? ` for ${focalPersonOrg.name}` : ''}
                  </DialogTitle>
                </DialogHeader>
                <p id="focal-person-desc" className="text-sm text-muted-foreground">
                  This person will be a user in the system and can only see findings assigned to them.
                </p>
                <form
                  onSubmit={handleAddFocalPerson}
                  className="space-y-4 mt-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="fp-firstName">First name *</Label>
                    <Input
                      id="fp-firstName"
                      value={focalPersonForm.firstName}
                      onChange={(e) =>
                        setFocalPersonForm((p) => ({ ...p, firstName: e.target.value }))
                      }
                      placeholder="First name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fp-lastName">Last name *</Label>
                    <Input
                      id="fp-lastName"
                      value={focalPersonForm.lastName}
                      onChange={(e) =>
                        setFocalPersonForm((p) => ({ ...p, lastName: e.target.value }))
                      }
                      placeholder="Last name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fp-email">Email *</Label>
                    <Input
                      id="fp-email"
                      type="email"
                      value={focalPersonForm.email}
                      onChange={(e) =>
                        setFocalPersonForm((p) => ({ ...p, email: e.target.value }))
                      }
                      placeholder="Email (used to sign in)"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fp-password">Temporary password *</Label>
                    <Input
                      id="fp-password"
                      type="password"
                      value={focalPersonForm.password}
                      onChange={(e) =>
                        setFocalPersonForm((p) => ({ ...p, password: e.target.value }))
                      }
                      placeholder="Min 6 characters (user can change after first login)"
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFocalPersonOrg(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={focalPersonSubmitting}>
                      {focalPersonSubmitting ? 'Adding...' : 'Add focal person'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {roles.includes('QUALITY_MANAGER') && (
            <>
              <TabsContent value="kpis" className="space-y-4">
                <KpiManagementContent />
              </TabsContent>
              <TabsContent value="finding-classifications" className="space-y-4">
                <FindingClassificationsContent />
              </TabsContent>
              <TabsContent value="regulatory-violations" className="space-y-4">
                <RegulatoryViolationsContent />
              </TabsContent>
            </>
          )}

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Global configuration and defaults for the QMS.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border p-4">
                  <h3 className="font-medium mb-1">Application</h3>
                  <p className="text-sm text-muted-foreground">
                    Application name: Sky SQ QMS. Further system-wide settings
                    (e.g. default CAP due days by priority, notification
                    preferences) can be added here.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <h3 className="font-medium mb-1">Admin access</h3>
                  <p className="text-sm text-muted-foreground">
                    Only users with the appropriate role can access this Admin
                    page. Restrict Admin menu visibility by role in your
                    deployment if needed.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}

export default AdminPage
