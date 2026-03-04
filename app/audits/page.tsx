'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { AuditCalendar } from '@/components/audits/audit-calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CreateAuditForm } from '@/components/audits/create-audit-form'

const AuditsPage = () => {
  const [audits, setAudits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    fetchAudits()
  }, [])

  const fetchAudits = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/audits', { credentials: 'include' })
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Audit Management</h1>
            <p className="text-muted-foreground mt-2">
              Schedule and manage audits
            </p>
          </div>
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

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/audits?status=PLANNED">
                  <Button variant="outline" className="w-full justify-start">
                    View Planned Audits
                  </Button>
                </Link>
                <Link href="/audits?status=ACTIVE">
                  <Button variant="outline" className="w-full justify-start">
                    View Active Audits
                  </Button>
                </Link>
                <Link href="/audits?status=COMPLETED">
                  <Button variant="outline" className="w-full justify-start">
                    View Completed Audits
                  </Button>
                </Link>
              </CardContent>
            </Card>
        </div>
      </div>
    </MainLayout>
  )
}

export default AuditsPage
