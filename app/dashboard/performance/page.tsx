'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { TrendingUp, Calendar, AlertCircle, CheckCircle, Building2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

type PerformanceData = {
  period: string
  days: number
  fromDate: string
  auditsCompleted: number
  findingsClosed: number
  findingsOpened: number
  overdueCAPsNow: number
  byDepartment: Array<{
    departmentId: string
    departmentName: string
    openFindings: number
    closedFindings: number
  }>
}

const PerformanceDashboardPage = () => {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('30d')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/performance?period=${period}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) {
        if (res.status === 403) {
          setError('You do not have access to the performance dashboard.')
          return
        }
        setError('Failed to load performance data')
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setError('Failed to load performance data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [period])

  if (loading && !data) {
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
          <div className="flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Performance Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                KPIs and trends over time
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="perf-period">Period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger id="perf-period" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <p className="text-destructive mb-4">{error}</p>
        )}

        {data && (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Audits completed</CardTitle>
                  <Calendar className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.auditsCompleted}</div>
                  <p className="text-xs text-muted-foreground">In selected period</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Findings closed</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.findingsClosed}</div>
                  <p className="text-xs text-muted-foreground">In selected period</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Findings opened</CardTitle>
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.findingsOpened}</div>
                  <p className="text-xs text-muted-foreground">In selected period</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue CAPs (now)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.overdueCAPsNow}</div>
                  <p className="text-xs text-muted-foreground">Current</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  By department (period)
                </CardTitle>
                <CardDescription>Open vs closed findings per department in selected period</CardDescription>
              </CardHeader>
              <CardContent>
                {data.byDepartment.length === 0 ? (
                  <p className="text-muted-foreground">No data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="table">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium">Department</th>
                          <th className="text-left py-2 px-2 font-medium">Open</th>
                          <th className="text-left py-2 px-2 font-medium">Closed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byDepartment.map((d) => (
                          <tr key={d.departmentId} className="border-b">
                            <td className="py-2 px-2 font-medium">{d.departmentName}</td>
                            <td className="py-2 px-2">{d.openFindings}</td>
                            <td className="py-2 px-2">{d.closedFindings}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  )
}

export default PerformanceDashboardPage
