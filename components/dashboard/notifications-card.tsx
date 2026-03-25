'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  AUDIT_SCHEDULED: 'Audit scheduled',
  AUDIT_REMINDER: 'Audit reminder',
  FINDING_ASSIGNED: 'Finding assigned',
  CAP_DUE_SOON: 'CAP due soon',
  CAP_OVERDUE: 'CAP overdue',
  DOCUMENT_APPROVAL: 'Document approval',
  TRAINING_EXPIRY: 'Training expiry',
  SYSTEM_ALERT: 'System alert',
  ESCALATION_TO_AM: 'Escalation to AM',
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

export const NotificationsCard = () => {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" aria-hidden />
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
  )
}
