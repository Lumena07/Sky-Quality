'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { Calendar, AlertCircle, FileCheck, TrendingUp, Clock, Download, Bell, FileText } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { exportDashboardStatsToExcel } from '@/lib/export/excel'
import { supabaseBrowserClient } from '@/lib/supabaseClient'
import { isNormalUser } from '@/lib/permissions'

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  AUDIT_SCHEDULED: 'Audit scheduled',
  AUDIT_REMINDER: 'Audit reminder',
  FINDING_ASSIGNED: 'Finding assigned',
  CAP_DUE_SOON: 'CAP due soon',
  CAP_OVERDUE: 'CAP overdue',
  DOCUMENT_APPROVAL: 'Document approval',
  TRAINING_EXPIRY: 'Training expiry',
  SYSTEM_ALERT: 'System alert',
}

type NotificationRow = {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

const DashboardPage = () => {
  const [roles, setRoles] = useState<string[] | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [stats, setStats] = useState({
    totalAudits: 0,
    activeAudits: 0,
    openFindings: 0,
    overdueCAPs: 0,
    pendingDocuments: 0,
  })

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const {
        data: { user },
      } = await supabaseBrowserClient.auth.getUser()
      setUserName(user?.user_metadata?.name ?? user?.email ?? null)
    }
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          setRoles(Array.isArray(data.roles) ? data.roles : [])
        } else {
          setRoles([])
        }
      } catch {
        setRoles([])
      }
    }
    fetchMe()
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?unreadOnly=true', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setNotifications(Array.isArray(data) ? data.slice(0, 10) : [])
      }
    } catch {
      setNotifications([])
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const handleMarkAsRead = async (id: string, andNavigateTo?: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
        credentials: 'same-origin',
      })
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
        if (andNavigateTo) {
          window.location.href = andNavigateTo
        }
      }
    } catch {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      if (andNavigateTo) {
        window.location.href = andNavigateTo
      }
    }
  }

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
  const showAdminDashboard = roles !== null && !isNormalUser(roles)

  const handleExportStats = () => {
    exportDashboardStatsToExcel(stats)
  }

  const statCards = [
    { title: 'Total Audits', value: stats.totalAudits, icon: Calendar, href: '/audits', color: 'text-blue-600' },
    { title: 'Active Audits', value: stats.activeAudits, icon: Clock, href: '/audits?status=ACTIVE', color: 'text-orange-600' },
    { title: 'Open Findings', value: stats.openFindings, icon: AlertCircle, href: '/findings?status=OPEN', color: 'text-red-600' },
    { title: 'Overdue CAPs', value: stats.overdueCAPs, icon: TrendingUp, href: '/findings?overdue=true', color: 'text-purple-600' },
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Your recent notifications</CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No unread notifications.</p>
              ) : (
                <ul className="space-y-2" role="list">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className="flex items-start justify-between gap-2 rounded-lg border p-2 text-sm bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{n.title}</span>
                        <p className="text-muted-foreground text-xs mt-0.5">{n.message}</p>
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          {NOTIFICATION_TYPE_LABELS[n.type] ?? n.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {n.link ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Open: ${n.title}`}
                            onClick={() => handleMarkAsRead(n.id, n.link ?? undefined)}
                          >
                            View
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Mark as read: ${n.title}`}
                            onClick={() => handleMarkAsRead(n.id)}
                          >
                            Mark read
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

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
