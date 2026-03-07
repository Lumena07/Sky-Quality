'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { AlertCircle, Shield, TrendingUp, Building2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

type EscalationRow = {
  id: string
  findingId: string
  escalatedAt: string
  trigger: string
  Finding?: Array<{ findingNumber: string; status: string }> | { findingNumber: string; status: string }
}

type OverdueCapRow = {
  id: string
  findingId: string
  dueDate: string
  Finding?: Array<{
    findingNumber: string
    status: string
    departmentId: string
    Department?: Array<{ name: string }> | { name: string }
  }> | {
    findingNumber: string
    status: string
    departmentId: string
    Department?: Array<{ name: string }> | { name: string }
  }
}

type AmDashboardData = {
  escalations: EscalationRow[]
  overdueCAPs: OverdueCapRow[]
  overdueCAPsCount: number
  openFindingsCount: number
  openByDepartment: Array<{ departmentId: string; departmentName: string; count: number }>
}

const AmDashboardPage = () => {
  const [data, setData] = useState<AmDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/dashboard/am', { credentials: 'same-origin' })
        if (!res.ok) {
          if (res.status === 403) {
            setError('You do not have access to the AM Dashboard.')
            return
          }
          setError('Failed to load AM dashboard')
          return
        }
        const json = await res.json()
        setData(json)
      } catch {
        setError('Failed to load AM dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

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

  if (error || !data) {
    return (
      <MainLayout>
        <div className="p-8">
          <p className="text-destructive">{error ?? 'Failed to load data'}</p>
          <Link href="/dashboard">
            <Button variant="outline" className="mt-4">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </MainLayout>
    )
  }

  const getFindingNumber = (f: EscalationRow['Finding']): string => {
    if (!f) return '—'
    const arr = Array.isArray(f) ? f : [f]
    return arr[0]?.findingNumber ?? '—'
  }

  const getFindingFromCa = (f: OverdueCapRow['Finding']): { findingNumber: string; departmentName: string } => {
    if (!f) return { findingNumber: '—', departmentName: '—' }
    const arr = Array.isArray(f) ? f : [f]
    const first = arr[0]
    const dept = first?.Department
    const departmentName = Array.isArray(dept) ? dept[0]?.name : dept?.name
    return {
      findingNumber: first?.findingNumber ?? '—',
      departmentName: departmentName ?? '—',
    }
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Accountable Manager Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Oversight of escalated findings, overdue CAPs, and department compliance
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Escalated to AM</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.escalations.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue CAPs</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overdueCAPsCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Findings</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.openFindingsCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Departments</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.openByDepartment.length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Escalated to AM</CardTitle>
              <CardDescription>Findings reported to the Accountable Manager (ICAO / Auric Air Manual)</CardDescription>
            </CardHeader>
            <CardContent>
              {data.escalations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No escalations.</p>
              ) : (
                <ul className="space-y-2" role="list">
                  {data.escalations.slice(0, 15).map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border p-2 text-sm"
                    >
                      <span className="font-medium">{getFindingNumber(e.Finding)}</span>
                      <Badge variant="secondary" className="text-xs">
                        {e.trigger}
                      </Badge>
                      <Link href={`/findings/${e.findingId}`}>
                        <Button variant="ghost" size="sm" aria-label={`View finding ${getFindingNumber(e.Finding)}`}>
                          View
                        </Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {data.escalations.length > 15 && (
                <Link href="/findings?needsFollowUp=true">
                  <Button variant="outline" className="w-full mt-2">
                    View all findings needing follow-up
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overdue CAPs</CardTitle>
              <CardDescription>Corrective Action Plans past due date</CardDescription>
            </CardHeader>
            <CardContent>
              {data.overdueCAPs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No overdue CAPs.</p>
              ) : (
                <ul className="space-y-2" role="list">
                  {data.overdueCAPs.slice(0, 15).map((ca) => {
                    const { findingNumber, departmentName } = getFindingFromCa(ca.Finding)
                    return (
                      <li
                        key={ca.id}
                        className="flex items-center justify-between rounded-lg border p-2 text-sm"
                      >
                        <div>
                          <span className="font-medium">{findingNumber}</span>
                          <span className="text-muted-foreground ml-2">{departmentName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Due {formatDate(ca.dueDate)}
                          </span>
                          <Link href={`/findings/${ca.findingId}`}>
                            <Button variant="ghost" size="sm" aria-label={`View finding ${findingNumber}`}>
                              View
                            </Button>
                          </Link>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              {data.overdueCAPs.length > 0 && (
                <Link href="/findings?overdue=true">
                  <Button variant="outline" className="w-full mt-2">
                    View all overdue
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Open Findings by Department</CardTitle>
            <CardDescription>Count of open/in-progress findings per department</CardDescription>
          </CardHeader>
          <CardContent>
            {data.openByDepartment.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open findings.</p>
            ) : (
              <ul className="space-y-2" role="list">
                {data.openByDepartment.map((d) => (
                  <li
                    key={d.departmentId}
                    className="flex items-center justify-between rounded-lg border p-2 text-sm"
                  >
                    <span className="font-medium">{d.departmentName}</span>
                    <Badge variant="secondary">{d.count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

export default AmDashboardPage
