'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { Bell, ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type NotificationRow = {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

const NotificationTypeLabels: Record<string, string> = {
  AUDIT_SCHEDULED: 'Audit scheduled',
  AUDIT_REMINDER: 'Audit reminder',
  FINDING_ASSIGNED: 'Finding assigned',
  CAP_DUE_SOON: 'CAP due soon',
  CAP_OVERDUE: 'CAP overdue',
  DOCUMENT_APPROVAL: 'Document approval',
  TRAINING_EXPIRY: 'Training expiry',
  SYSTEM_ALERT: 'System alert',
}

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterUnread, setFilterUnread] = useState(false)

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const url = filterUnread ? '/api/notifications?unreadOnly=true' : '/api/notifications'
      const res = await fetch(url, { credentials: 'same-origin' })
      if (!res.ok) {
        setNotifications([])
        return
      }
      const data = await res.json()
      setNotifications(Array.isArray(data) ? data : [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [filterUnread])

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
        credentials: 'same-origin',
      })
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
      }
    } catch {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }
  }

  const handleDismiss = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
      }
    } catch {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }
  }

  const handleView = (id: string, link: string | null) => {
    if (link) {
      handleMarkAsRead(id)
      window.location.href = link
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="h-6 w-6" />
              Notifications
            </h1>
            <p className="text-muted-foreground mt-1">
              All your notifications in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filterUnread ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterUnread(!filterUnread)}
              aria-pressed={filterUnread}
              aria-label={filterUnread ? 'Show all notifications' : 'Show only unread'}
            >
              Unread only
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>
              {loading ? 'Loading...' : `${notifications.length} notification(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading notifications...</p>
            ) : notifications.length === 0 ? (
              <p className="text-muted-foreground text-sm">No notifications.</p>
            ) : (
              <ul className="space-y-3" role="list">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                      !n.isRead && 'bg-muted/50 border-primary/20'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {NotificationTypeLabels[n.type] ?? n.type}
                        </Badge>
                        {!n.isRead && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary" aria-hidden>
                            New
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="font-medium mt-1">{n.title}</p>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {n.link && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Open: ${n.title}`}
                          onClick={() => handleView(n.id, n.link)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Dismiss: ${n.title}`}
                        onClick={() => handleDismiss(n.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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

export default NotificationsPage
