'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuditCalendar } from '@/components/audits/audit-calendar'
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
import { CreateAuditForm } from '@/components/audits/create-audit-form'
import { canScheduleAudit } from '@/lib/permissions'

const QUICK_ACTIONS = [
  { value: 'ALL', label: 'All audits' },
  { value: 'PLANNED', label: 'View Planned Audits' },
  { value: 'ACTIVE', label: 'View Active Audits' },
  { value: 'COMPLETED', label: 'View Completed Audits' },
] as const

const AuditsPage = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusParam = searchParams.get('status') ?? ''
  const quickActionValue = statusParam && ['PLANNED', 'ACTIVE', 'COMPLETED'].includes(statusParam) ? statusParam : 'ALL'
  const [audits, setAudits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [roles, setRoles] = useState<string[]>([])

  useEffect(() => {
    fetchAudits()
  }, [statusParam])

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          setRoles(Array.isArray(data.roles) ? data.roles : [])
        }
      } catch {
        setRoles([])
      }
    }
    fetchMe()
  }, [])

  const fetchAudits = async () => {
    setLoading(true)
    try {
      const url = statusParam
        ? `/api/audits?status=${encodeURIComponent(statusParam)}`
        : '/api/audits'
      const res = await fetch(url, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setAudits(data)
      }
    } catch (error) {
      console.error('Failed to fetch audits:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAuditCreated = () => {
    setDialogOpen(false)
    fetchAudits()
  }


  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-8 animate-pulse">
          <div className="mb-8 h-10 w-48 rounded bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Audit Management</h1>
            <p className="text-muted-foreground mt-2">
              Schedule and manage audits
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={quickActionValue}
              onValueChange={(value) => {
                const path = value === 'ALL' ? '/audits' : `/audits?status=${encodeURIComponent(value)}`
                router.push(path)
              }}
            >
              <SelectTrigger
                className="w-[200px]"
                aria-label="Quick actions: filter audits by status"
              >
                <SelectValue placeholder="Quick Actions" />
              </SelectTrigger>
              <SelectContent>
                {QUICK_ACTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canScheduleAudit(roles) && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Schedule Audit
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Schedule New Audit</DialogTitle>
                    <DialogDescription>
                      Create a new audit schedule with all required details
                    </DialogDescription>
                  </DialogHeader>
                  <CreateAuditForm onSuccess={handleAuditCreated} open={dialogOpen} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditCalendar
                audits={audits}
                onDateClick={handleDateClick}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  )
}

export default AuditsPage
