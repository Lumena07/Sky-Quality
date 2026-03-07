'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const auditSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    scope: z.string().min(1, 'Scope is required'),
    departmentId: z.string().optional(),
    base: z.string().min(1, 'Base is required'),
    startDate: z.date(),
    endDate: z.date(),
    type: z.enum(['INTERNAL', 'EXTERNAL', 'THIRD_PARTY', 'ERP']),
    openingMeetingAt: z.string().optional(),
    closingMeetingAt: z.string().optional(),
    scheduleNotes: z.string().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  })

type AuditFormData = z.infer<typeof auditSchema>

interface CreateAuditFormProps {
  onSuccess: () => void
  /** When true (e.g. dialog opened), refetch users so focal persons are up to date. */
  open?: boolean
}

export const CreateAuditForm = ({ onSuccess, open }: CreateAuditFormProps) => {
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [organizations, setOrganizations] = useState<any[]>([])
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([])
  const [selectedAuditees, setSelectedAuditees] = useState<string[]>([])
  const [selectedAuditeeOrgIds, setSelectedAuditeeOrgIds] = useState<string[]>([])
  const [selectedAuditorOrgIds, setSelectedAuditorOrgIds] = useState<string[]>([])
  // Focal person (user id) per external auditee organization – findings will be assigned to them
  const [externalFocalByOrgId, setExternalFocalByOrgId] = useState<Record<string, string>>({})

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AuditFormData>({
    resolver: zodResolver(auditSchema),
    defaultValues: {
      startDate: new Date(),
      endDate: new Date(),
      type: 'INTERNAL',
      openingMeetingAt: '',
      closingMeetingAt: '',
      scheduleNotes: '',
    },
  })

  const startDate = watch('startDate')
  const endDate = watch('endDate')
  const auditType = watch('type')

  useEffect(() => {
    fetchDepartments()
    fetchUsers()
    fetchOrganizations()
  }, [])

  useEffect(() => {
    if (open) {
      fetchUsers()
    }
  }, [open])

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations')
      if (res.ok) {
        const data = await res.json()
        setOrganizations(data)
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
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

  const onSubmit = async (data: AuditFormData) => {
    const needsUserAuditors = data.type === 'INTERNAL' || data.type === 'EXTERNAL'
    const needsAuditorOrgs3rdParty = data.type === 'THIRD_PARTY'
    const needsAuditees =
      data.type === 'EXTERNAL' ||
      data.type === 'INTERNAL' ||
      data.type === 'THIRD_PARTY'
    const hasAuditees =
      data.type === 'EXTERNAL'
        ? selectedAuditeeOrgIds.length > 0
        : data.type === 'THIRD_PARTY'
          ? selectedAuditees.length > 0
          : selectedAuditees.length > 0 || selectedAuditeeOrgIds.length > 0
    const needsDepartment = data.type !== 'ERP'
    const hasUserAuditors = selectedAuditors.length > 0 || selectedAuditorOrgIds.length > 0
    const hasAuditorOrgs = selectedAuditorOrgIds.length > 0

    if (data.type === 'EXTERNAL' && selectedAuditeeOrgIds.some((orgId) => !externalFocalByOrgId[orgId])) {
      alert('Please select a focal person for each auditee organization. Findings will be assigned to that person.')
      return
    }
    if (needsDepartment && !data.departmentId) {
      alert('Please select a department')
      return
    }
    if (needsUserAuditors && !hasUserAuditors) {
      alert('Please select at least one auditor')
      return
    }
    if (needsAuditorOrgs3rdParty && !hasAuditorOrgs) {
      alert('Please select at least one auditor organization')
      return
    }
    if (needsAuditees && !hasAuditees) {
      alert(
        data.type === 'EXTERNAL'
          ? 'Please select at least one auditee organization'
          : data.type === 'THIRD_PARTY'
            ? 'Please select at least one auditee (internal)'
            : 'Please select at least one auditee (user or organization)'
      )
      return
    }

    const overlap = selectedAuditors.filter((id) => selectedAuditees.includes(id))
    if (overlap.length > 0) {
      alert('A user cannot be both auditor and auditee on the same audit. Remove them from one list.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          auditorIds: data.type === 'THIRD_PARTY' ? [] : selectedAuditors,
          auditeeIds:
            data.type === 'EXTERNAL' || data.type === 'ERP'
              ? []
              : selectedAuditees,
          auditorOrganizationIds: selectedAuditorOrgIds,
          auditeeOrganizationIds: selectedAuditeeOrgIds,
          externalAuditees:
            data.type === 'EXTERNAL'
              ? selectedAuditeeOrgIds.map((orgId) => ({ organizationId: orgId, userId: externalFocalByOrgId[orgId] }))
              : undefined,
          departmentId: data.type === 'ERP' ? undefined : data.departmentId,
        }),
      })

      if (response.ok) {
        setSelectedAuditors([])
        setSelectedAuditees([])
        setSelectedAuditeeOrgIds([])
        setSelectedAuditorOrgIds([])
        setExternalFocalByOrgId({})
        onSuccess()
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(errorData.error || 'Failed to create audit. Please check the console for details.')
        console.error('Failed to create audit:', errorData)
      }
    } catch (error) {
      console.error('Error creating audit:', error)
      alert('An error occurred while creating the audit. Please check the console for details.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Audit Title *</Label>
        <Input
          id="title"
          {...register('title')}
          placeholder="Internal Audit - Q1 2024"
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Audit description..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="scope">Scope *</Label>
        <Textarea
          id="scope"
          {...register('scope')}
          placeholder="Audit scope and areas to be covered..."
        />
        {errors.scope && (
          <p className="text-sm text-destructive">{errors.scope.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {auditType !== 'ERP' && (
        <div className="space-y-2">
          <Label htmlFor="departmentId">Department *</Label>
          <Select
            value={watch('departmentId') ?? ''}
            onValueChange={(value) => setValue('departmentId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.departmentId && (
            <p className="text-sm text-destructive">
              {errors.departmentId.message}
            </p>
          )}
        </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="base">Base/Location *</Label>
          <Input
            id="base"
            {...register('base')}
            placeholder="Main Base"
          />
          {errors.base && (
            <p className="text-sm text-destructive">{errors.base.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Audit Type *</Label>
          <Select
            onValueChange={(value) => setValue('type', value as 'INTERNAL' | 'EXTERNAL' | 'THIRD_PARTY' | 'ERP')}
            defaultValue="INTERNAL"
          >
            <SelectTrigger>
              <SelectValue placeholder="Select audit type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INTERNAL">Internal</SelectItem>
              <SelectItem value="EXTERNAL">External</SelectItem>
              <SelectItem value="THIRD_PARTY">3rd Party</SelectItem>
              <SelectItem value="ERP">ERP</SelectItem>
            </SelectContent>
          </Select>
          {errors.type && (
            <p className="text-sm text-destructive">{errors.type.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Start Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'PPP') : <span>Pick start date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => {
                  if (date) {
                    setValue('startDate', date)
                    const currentEnd = watch('endDate')
                    if (currentEnd < date) setValue('endDate', date)
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.startDate && (
            <p className="text-sm text-destructive">{errors.startDate.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>End Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !endDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, 'PPP') : <span>Pick end date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && setValue('endDate', date)}
                disabled={(date) => startDate != null && date < startDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.endDate && (
            <p className="text-sm text-destructive">{errors.endDate.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Same day: set start and end to the same date. Multi-day: set end after start.
          </p>
        </div>
      </div>

      {auditType !== 'ERP' && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-sm font-medium">Audit schedule (optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="openingMeetingAt">Opening meeting</Label>
              <Input
                id="openingMeetingAt"
                type="datetime-local"
                {...register('openingMeetingAt')}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closingMeetingAt">Closing meeting</Label>
              <Input
                id="closingMeetingAt"
                type="datetime-local"
                {...register('closingMeetingAt')}
                className="w-full"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheduleNotes">Schedule notes</Label>
            <Textarea
              id="scheduleNotes"
              {...register('scheduleNotes')}
              placeholder="Process steps, agenda, or notes from the manual..."
              className="min-h-[80px]"
            />
          </div>
        </div>
      )}

      {(auditType === 'INTERNAL' || auditType === 'EXTERNAL' || auditType === 'THIRD_PARTY') && (
      <div
        className={cn(
          'grid gap-4',
          auditType === 'EXTERNAL' || auditType === 'THIRD_PARTY'
            ? 'grid-cols-1'
            : 'grid-cols-2'
        )}
      >
        {(auditType === 'INTERNAL' || auditType === 'EXTERNAL') && (
          <div className="space-y-2">
            <Label>Auditors *</Label>
            <Select
              onValueChange={(value) => {
                if (!selectedAuditors.includes(value)) {
                  setSelectedAuditors([...selectedAuditors, value])
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select auditors" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter((u) => u.role === 'AUDITOR' || u.role === 'QUALITY_MANAGER')
                  .map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedAuditors.map((auditorId) => {
                const user = users.find((u) => u.id === auditorId)
                return user ? (
                  <Badge key={auditorId} variant="secondary">
                    {user.firstName} {user.lastName}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedAuditors(
                          selectedAuditors.filter((id) => id !== auditorId)
                        )
                      }
                      className="ml-2"
                    >
                      ×
                    </button>
                  </Badge>
                ) : null
              })}
            </div>
          </div>
        )}

        {(auditType === 'INTERNAL' || auditType === 'THIRD_PARTY') && (
          <div className="space-y-2">
            <Label>Auditees *</Label>
            <Select
              onValueChange={(value) => {
                if (!selectedAuditees.includes(value)) {
                  setSelectedAuditees([...selectedAuditees, value])
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select auditees" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedAuditees.map((auditeeId) => {
                const user = users.find((u) => u.id === auditeeId)
                return user ? (
                  <Badge key={auditeeId} variant="secondary">
                    {user.firstName} {user.lastName}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedAuditees(
                          selectedAuditees.filter((id) => id !== auditeeId)
                        )
                      }
                      className="ml-2"
                    >
                      ×
                    </button>
                  </Badge>
                ) : null
              })}
            </div>
          </div>
        )}
      </div>
      )}

      {auditType === 'EXTERNAL' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Auditee organizations *</Label>
            <Select
              onValueChange={(value) => {
                if (value && !selectedAuditeeOrgIds.includes(value)) {
                  setSelectedAuditeeOrgIds([...selectedAuditeeOrgIds, value])
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select organizations to audit" />
              </SelectTrigger>
              <SelectContent>
                {organizations
                  .filter((org) => !selectedAuditeeOrgIds.includes(org.id))
                  .map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                      {org.type ? ` (${org.type})` : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedAuditeeOrgIds.map((orgId) => {
                const org = organizations.find((o) => o.id === orgId)
                return org ? (
                  <Badge key={orgId} variant="secondary">
                    {org.name}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAuditeeOrgIds(selectedAuditeeOrgIds.filter((id) => id !== orgId))
                        setExternalFocalByOrgId((prev) => {
                          const next = { ...prev }
                          delete next[orgId]
                          return next
                        })
                      }}
                      className="ml-2"
                      aria-label={`Remove ${org.name}`}
                    >
                      ×
                    </button>
                  </Badge>
                ) : null
              })}
            </div>
          </div>
          {selectedAuditeeOrgIds.length > 0 && (
            <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
              <p className="text-sm font-medium">Focal person per organization (findings will be assigned to them). Add focal persons in Admin → Organizations.</p>
              {selectedAuditeeOrgIds.map((orgId) => {
                const org = organizations.find((o) => o.id === orgId)
                if (!org) return null
                const orgFocalUsers = users.filter(
                  (u: { organizationId?: string | null; organization_id?: string | null }) =>
                    (u.organizationId ?? u.organization_id) === orgId
                )
                return (
                  <div key={orgId} className="flex flex-col gap-1.5">
                    <Label className="text-xs">Focal person for {org.name}</Label>
                    {orgFocalUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        No focal person for this org. Add one in Admin → Organizations.
                      </p>
                    ) : (
                      <Select
                        value={externalFocalByOrgId[orgId] ?? ''}
                        onValueChange={(value) =>
                          setExternalFocalByOrgId((prev) => ({ ...prev, [orgId]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select focal person" />
                        </SelectTrigger>
                        <SelectContent>
                          {orgFocalUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                              {user.email ? ` (${user.email})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {auditType === 'THIRD_PARTY' && (
        <div className="space-y-2">
          <Label>Auditor organizations *</Label>
          <Select
            onValueChange={(value) => {
              if (value && !selectedAuditorOrgIds.includes(value)) {
                setSelectedAuditorOrgIds([...selectedAuditorOrgIds, value])
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select auditing organizations" />
            </SelectTrigger>
            <SelectContent>
              {organizations
                .filter((org) => !selectedAuditorOrgIds.includes(org.id))
                .map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                    {org.type ? ` (${org.type})` : ''}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedAuditorOrgIds.map((orgId) => {
              const org = organizations.find((o) => o.id === orgId)
              return org ? (
                <Badge key={orgId} variant="secondary">
                  {org.name}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAuditorOrgIds(
                        selectedAuditorOrgIds.filter((id) => id !== orgId)
                      )
                    }
                    className="ml-2"
                    aria-label={`Remove ${org.name}`}
                  >
                    ×
                  </button>
                </Badge>
              ) : null
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Audit'}
        </Button>
      </div>
    </form>
  )
}
