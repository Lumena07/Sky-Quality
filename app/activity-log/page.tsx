'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { History, User, Filter } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/utils'

type ActivityLogRow = {
  id: string
  userId: string | null
  action: string
  entityType: string
  entityId: string
  details: string | null
  createdAt: string
  auditId: string | null
  findingId: string | null
  documentId: string | null
  User?: Array<{ id: string; email?: string; firstName?: string; lastName?: string }> | { id: string; email?: string; firstName?: string; lastName?: string }
}

const ENTITY_TYPES = ['Audit', 'Finding', 'Document', 'Checklist', 'CorrectiveAction']
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'UPLOAD']

const ActivityLogPage = () => {
  const [logs, setLogs] = useState<ActivityLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (userId) params.set('userId', userId)
      if (entityType) params.set('entityType', entityType)
      if (action) params.set('action', action)
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)
      params.set('limit', '100')
      const res = await fetch(`/api/activity-log?${params}`, { credentials: 'same-origin' })
      if (!res.ok) {
        if (res.status === 403) {
          setError('You do not have access to the activity log.')
          return
        }
        setError('Failed to load activity log')
        return
      }
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load activity log')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const getUserDisplay = (u: ActivityLogRow['User']): string => {
    if (!u) return '—'
    const arr = Array.isArray(u) ? u : [u]
    const first = arr[0]
    if (!first) return '—'
    const name = [first.firstName, first.lastName].filter(Boolean).join(' ').trim()
    return name || first.email || first.id || '—'
  }

  const getEntityLink = (row: ActivityLogRow): string | null => {
    if (row.findingId) return `/findings/${row.findingId}`
    if (row.auditId) return `/audits/${row.auditId}`
    if (row.documentId) return `/documents/${row.documentId}`
    return null
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center gap-2">
          <History className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Activity Log</h1>
            <p className="text-muted-foreground mt-1">
              Observe system behaviour: who did what and when
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <CardDescription>Filter by user, entity type, action, or date range</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="activity-userId">User ID</Label>
              <Input
                id="activity-userId"
                placeholder="User ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-48"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-entityType">Entity type</Label>
              <Select value={entityType || 'all'} onValueChange={(v) => setEntityType(v === 'all' ? '' : v)}>
                <SelectTrigger id="activity-entityType" className="w-40">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-action">Action</Label>
              <Select value={action || 'all'} onValueChange={(v) => setAction(v === 'all' ? '' : v)}>
                <SelectTrigger id="activity-action" className="w-32">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-fromDate">From date</Label>
              <Input
                id="activity-fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-toDate">To date</Label>
              <Input
                id="activity-toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <Button onClick={fetchLogs} disabled={loading}>
              Apply
            </Button>
          </CardContent>
        </Card>

        {error && (
          <p className="text-destructive mb-4">{error}</p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Log entries</CardTitle>
            <CardDescription>Most recent first</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse h-64 rounded bg-muted" />
            ) : logs.length === 0 ? (
              <p className="text-muted-foreground">No activity log entries found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Time</th>
                      <th className="text-left py-2 px-2 font-medium">User</th>
                      <th className="text-left py-2 px-2 font-medium">Action</th>
                      <th className="text-left py-2 px-2 font-medium">Entity</th>
                      <th className="text-left py-2 px-2 font-medium">Details</th>
                      <th className="text-left py-2 px-2 font-medium">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="py-2 px-2 text-muted-foreground">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="py-2 px-2">{getUserDisplay(row.User)}</td>
                        <td className="py-2 px-2">
                          <span className="font-medium">{row.action}</span>
                        </td>
                        <td className="py-2 px-2">
                          {row.entityType} ({row.entityId.slice(0, 8)}…)
                        </td>
                        <td className="py-2 px-2 max-w-xs truncate text-muted-foreground">
                          {row.details ?? '—'}
                        </td>
                        <td className="py-2 px-2">
                          {getEntityLink(row) ? (
                            <Link href={getEntityLink(row)!}>
                              <Button variant="ghost" size="sm" aria-label={`View ${row.entityType}`}>
                                View
                              </Button>
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

export default ActivityLogPage
