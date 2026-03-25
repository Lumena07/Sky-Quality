'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, AlertCircle, FileCheck, TrendingUp, Clock, Download, FileText } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { exportDashboardStatsToExcel } from '@/lib/export/excel'
import { NotificationsCard } from '@/components/dashboard/notifications-card'
import { isNormalUser, canSeeAmDashboard, hasReviewerRole, isAccountableManager, isAdminOrQM } from '@/lib/permissions'

const DashboardPage = () => {
  const router = useRouter()
  const [roles, setRoles] = useState<string[] | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalAudits: 0,
    activeAudits: 0,
    openFindings: 0,
    overdueCAPs: 0,
    pendingDocuments: 0,
    pendingAssessmentHazards: 0,
  })

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          const nextRoles = Array.isArray(data.roles) ? data.roles : []
          setRoles(nextRoles)
          const fromProfile = [data.firstName, data.lastName].filter(Boolean).join(' ').trim()
          setUserName(fromProfile || data.email || null)
          if (isAccountableManager(nextRoles) && !isAdminOrQM(nextRoles)) {
            router.replace('/dashboard/am')
            return
          }
        } else {
          setRoles([])
        }
      } catch {
        setRoles([])
      }
    }
    fetchMe()
  }, [router])

  useEffect(() => {
    if (roles === null) return
    if (isNormalUser(roles)) return

    const fetchStats = async (retryOnUnauthorized = true) => {
      try {
        const res = await fetch('/api/dashboard/stats', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          setStats(data)
          return
        }
        if (res.status === 401 && retryOnUnauthorized) {
          await new Promise((r) => setTimeout(r, 300))
          return fetchStats(false)
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }
    fetchStats()
  }, [roles])

  const isNormal = roles !== null && isNormalUser(roles)
  const showAdminDashboard =
    roles !== null && (canSeeAmDashboard(roles) || hasReviewerRole(roles))

  const handleExportStats = () => {
    exportDashboardStatsToExcel(stats)
  }

  const statCards = [
    { title: 'Total Audits', value: stats.totalAudits, icon: Calendar, href: '/audits', color: 'text-blue-600' },
    { title: 'Active Audits', value: stats.activeAudits, icon: Clock, href: '/audits?status=ACTIVE', color: 'text-orange-600' },
    { title: 'Open Findings', value: stats.openFindings, icon: AlertCircle, href: '/findings?status=OPEN', color: 'text-red-600' },
    { title: 'Overdue CAPs', value: stats.overdueCAPs, icon: TrendingUp, href: '/findings?overdue=true', color: 'text-purple-600' },
    { title: 'Pending Assessment (SMS)', value: stats.pendingAssessmentHazards, icon: AlertCircle, href: '/sms/risk/register?status=PENDING_ASSESSMENT', color: 'text-rose-600' },
    { title: 'Needs Follow-up', value: '—', icon: AlertCircle, href: '/findings?needsFollowUp=true', color: 'text-amber-600' },
    { title: 'Pending Documents', value: stats.pendingDocuments, icon: FileCheck, href: '/documents?status=REVIEW', color: 'text-yellow-600' },
  ]

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Welcome back, {userName ?? 'User'}
            </p>
          </div>
          {showAdminDashboard && (
            <Button variant="outline" onClick={handleExportStats}>
              <Download className="mr-2 h-4 w-4" />
              Export Stats
            </Button>
          )}
        </div>

        <div className="space-y-6">
          <NotificationsCard />

          {isNormal && (
            <div className="grid gap-4 md:grid-cols-2">
              <Link href="/findings">
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Your Findings</CardTitle>
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">View and update findings assigned to you</p>
                    <Button variant="outline" className="mt-2 w-full">Go to Findings</Button>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/documents">
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Documents</CardTitle>
                    <FileText className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">View approved documents for your department</p>
                    <Button variant="outline" className="mt-2 w-full">View Documents</Button>
                  </CardContent>
                </Card>
              </Link>
            </div>
          )}

          {showAdminDashboard && (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {statCards.map((card) => {
                  const Icon = card.icon
                  return (
                    <Link key={card.title} href={card.href}>
                      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                          <Icon className={`h-4 w-4 ${card.color}`} />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{card.value}</div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Audits</CardTitle>
                    <CardDescription>Latest audit activities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">No recent audits</p>
                    <Link href="/audits">
                      <Button variant="outline" className="w-full mt-2">View All Audits</Button>
                    </Link>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Findings</CardTitle>
                    <CardDescription>Latest findings and corrective actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">No recent findings</p>
                    <Link href="/findings">
                      <Button variant="outline" className="w-full mt-2">View All Findings</Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  )
}

export default DashboardPage
