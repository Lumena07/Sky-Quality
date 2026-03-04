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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const findingSchema = z.object({
  auditId: z.string().min(1, 'Audit is required'),
  departmentId: z.string().min(1, 'Department is required'),
  policyReference: z.string().min(1, 'Policy reference is required'),
  description: z.string().min(1, 'Description is required'),
  rootCause: z.string().optional(),
  severity: z.string().min(1, 'Severity is required'),
  assignedToId: z.string().min(1, 'Assigned to is required'),
  dueDate: z.date().optional(),
  actionPlan: z.string().min(1, 'Corrective action plan is required'),
})

type FindingFormData = z.infer<typeof findingSchema>

interface CreateFindingFormProps {
  onSuccess: () => void
}

export const CreateFindingForm = ({ onSuccess }: CreateFindingFormProps) => {
  const [loading, setLoading] = useState(false)
  const [audits, setAudits] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FindingFormData>({
    resolver: zodResolver(findingSchema),
  })

  const dueDate = watch('dueDate')

  useEffect(() => {
    fetchAudits()
    fetchDepartments()
    fetchUsers()
  }, [])

  const fetchAudits = async () => {
    try {
      const res = await fetch('/api/audits')
      if (res.ok) {
        const data = await res.json()
        setAudits(data)
      }
    } catch (error) {
      console.error('Failed to fetch audits:', error)
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

  const onSubmit = async (data: FindingFormData) => {
    setLoading(true)
    try {
      const response = await fetch('/api/findings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        onSuccess()
      } else {
        alert('Failed to create finding')
      }
    } catch (error) {
      console.error('Error creating finding:', error)
      alert('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="auditId">Audit *</Label>
          <Select onValueChange={(value) => setValue('auditId', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select audit" />
            </SelectTrigger>
            <SelectContent>
              {audits.map((audit) => (
                <SelectItem key={audit.id} value={audit.id}>
                  {audit.title} - {audit.auditNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.auditId && (
            <p className="text-sm text-destructive">{errors.auditId.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="departmentId">Department *</Label>
          <Select onValueChange={(value) => setValue('departmentId', value)}>
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="policyReference">Policy/Manual Reference *</Label>
        <Input
          id="policyReference"
          {...register('policyReference')}
          placeholder="QMS-001 Section 4.2"
        />
        {errors.policyReference && (
          <p className="text-sm text-destructive">
            {errors.policyReference.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Finding Description *</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Describe the non-conformance..."
          rows={4}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="rootCause">Root Cause Analysis</Label>
        <Textarea
          id="rootCause"
          {...register('rootCause')}
          placeholder="Root cause analysis..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="severity">Severity *</Label>
          <Select onValueChange={(value) => setValue('severity', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Critical">Critical</SelectItem>
              <SelectItem value="Major">Major</SelectItem>
              <SelectItem value="Minor">Minor</SelectItem>
              <SelectItem value="Observation">Observation</SelectItem>
            </SelectContent>
          </Select>
          {errors.severity && (
            <p className="text-sm text-destructive">{errors.severity.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="assignedToId">Assigned To *</Label>
          <Select onValueChange={(value) => setValue('assignedToId', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select person" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.assignedToId && (
            <p className="text-sm text-destructive">
              {errors.assignedToId.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Due Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !dueDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dueDate ? format(dueDate, 'PPP') : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={(date) => date && setValue('dueDate', date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label htmlFor="actionPlan">Corrective Action Plan *</Label>
        <Textarea
          id="actionPlan"
          {...register('actionPlan')}
          placeholder="Describe the corrective action plan..."
          rows={4}
        />
        {errors.actionPlan && (
          <p className="text-sm text-destructive">{errors.actionPlan.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Finding'}
        </Button>
      </div>
    </form>
  )
}
