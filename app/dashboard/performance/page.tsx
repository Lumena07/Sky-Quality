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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'

type KpiItem = {
  id: string
  code: string | null
  name: string
  area: string | null
  unit: string
  direction: string
  targetValue: number | null
  isComputed: boolean
  currentValue: number
  trend: Array<{ month: string; value: number }>
}

type PerformanceData = {
  month: string
  months: number
  kpis: KpiItem[]
  period: string
  days: number
  fromDate: string
  auditsCompleted: number
  findingsClosed: number
  findingsOpened: number
  overdueCAPsNow: number
  overdueCATsNow: number
  byDepartment: Array<{
    departmentId: string
    departmentName: string
    openFindings: number
    closedFindings: number
  }>
}

const getKpiStatus = (k: KpiItem): 'on_track' | 'at_risk' | null => {
  if (k.targetValue == null) return null
  const target = Number(k.targetValue)
  const value = Number(k.currentValue)
  if (k.direction === 'HIGHER_IS_BETTER') return value >= target ? 'on_track' : 'at_risk'
  return value <= target ? 'on_track' : 'at_risk'
}

const formatKpiValue = (value: number, unit: string): string => {
  if (unit === 'PERCENT') return `${value}%`
  if (unit === 'DAYS') return `${value} d`
  return String(value)
}

const getCurrentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const PerformanceDashboardPage = () => {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('30d')
  const month = getCurrentMonth()
  const months = 12

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/dashboard/performance?month=${month}&months=${months}&period=${period}`,
        { credentials: 'same-origin' }
      )
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
        <div className="mb-8 flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Performance Dashboard</h1>
            <p className="text-muted-foreground mt-1">KPIs and trends (monthly)</p>
          </div>
        </div>

        {error && <p className="text-destructive mb-4">{error}</p>}

        {data && (
          <Tabs defaultValue="kpis" className="space-y-6">
            <TabsList className="grid w-full max-w-sm grid-cols-2">
              <TabsTrigger value="kpis">KPIs & trends</TabsTrigger>
              <TabsTrigger value="summary">Period summary</TabsTrigger>
            </TabsList>

            <TabsContent value="kpis" className="space-y-6 mt-6">
              {data.kpis && data.kpis.length > 0 ? (
                <>
                  <div>
                    <h2 className="text-lg font-semibold mb-1">KPI / KPT (targets)</h2>
                    <p className="text-sm text-muted-foreground">Current month, last 12 months</p>
                  </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                  {data.kpis.map((k) => {
                    const status = getKpiStatus(k)
                    return (
                      <Card key={k.id}>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-medium leading-tight">{k.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {k.isComputed ? 'Computed' : 'Manual'}
                              </Badge>
                              {k.targetValue != null && (
                                <span className="text-xs text-muted-foreground">
                                  Target: {formatKpiValue(Number(k.targetValue), k.unit)}
                                </span>
                              )}
                              {status && (
                                <Badge
                                  variant={status === 'on_track' ? 'default' : 'destructive'}
                                  className="text-xs"
                                >
                                  {status === 'on_track' ? 'On track' : 'At risk'}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{formatKpiValue(k.currentValue, k.unit)}</div>
                          {k.trend && k.trend.length > 0 && (
                            <div className="h-12 mt-2 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={k.trend.map((t) => ({ ...t, name: t.month }))}>
                                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                                  <XAxis dataKey="month" hide />
                                  <YAxis hide domain={['auto', 'auto']} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {data.kpis.length > 0 && (
                  <div className="grid gap-6 md:grid-cols-2 mb-8">
                    <Card>
                      <CardHeader>
                        <CardTitle>Trend – Overdue CAP % & Overdue CAT % & Repeat findings %</CardTitle>
                        <CardDescription>Last 12 months</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={(() => {
                                const overdueCap = data.kpis.find((k) => k.code === 'OVERDUE_CAP')?.trend ?? []
                                const overdueCat = data.kpis.find((k) => k.code === 'OVERDUE_CAT')?.trend ?? []
                                const repeat = data.kpis.find((k) => k.code === 'REPEAT_FINDINGS')?.trend ?? []
                                const months = new Set([
                                  ...overdueCap.map((t) => t.month),
                                  ...overdueCat.map((t) => t.month),
                                  ...repeat.map((t) => t.month),
                                ])
                                return Array.from(months)
                                  .sort()
                                  .map((m) => ({
                                    month: m,
                                    'Overdue CAP %': overdueCap.find((t) => t.month === m)?.value ?? 0,
                                    'Overdue CAT %': overdueCat.find((t) => t.month === m)?.value ?? 0,
                                    'Repeat findings %': repeat.find((t) => t.month === m)?.value ?? 0,
                                  }))
                              })()}
                            >
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Line
                                type="monotone"
                                dataKey="Overdue CAP %"
                                name="Overdue CAP %"
                                stroke="#0ea5e9"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="Overdue CAT %"
                                name="Overdue CAT %"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="Repeat findings %"
                                name="Repeat findings %"
                                stroke="#10b981"
                                strokeWidth={2}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Regulatory violations (count)</CardTitle>
                        <CardDescription>By month</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={
                                (data.kpis.find((k) => k.code === 'REGULATORY_VIOLATIONS')?.trend ?? []).map(
                                  (t) => ({ month: t.month, count: t.value })
                                )
                              }
                            >
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Bar dataKey="count" name="Violations" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
                </>
              ) : (
                <p className="text-muted-foreground">No KPI definitions configured.</p>
              )}
            </TabsContent>

            <TabsContent value="summary" className="space-y-6 mt-6">
              <div className="flex flex-wrap items-center gap-4">
                <Label htmlFor="perf-period">Period (summary)</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger id="perf-period" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  Audits, findings, and department breakdown for the selected period.
                </span>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
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
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue CAT (now)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.overdueCATsNow}</div>
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
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  )
}

export default PerformanceDashboardPage
