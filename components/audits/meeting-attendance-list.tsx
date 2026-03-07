'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDateTime } from '@/lib/utils'

type AttendanceRow = {
  id: string
  name: string | null
  roleOrTitle: string | null
  signedAt: string | null
  userId: string | null
  User?: { firstName?: string; lastName?: string; email?: string } | null
}

interface MeetingAttendanceListProps {
  auditId: string
  meetingType: 'OPENING' | 'CLOSING'
  attendance: AttendanceRow[]
  canEdit: boolean
  onRefresh: () => void
  meId: string | undefined
}

export const MeetingAttendanceList = ({
  auditId,
  meetingType,
  attendance,
  canEdit,
  onRefresh,
  meId,
}: MeetingAttendanceListProps) => {
  const [addName, setAddName] = useState('')
  const [addRole, setAddRole] = useState('')
  const [adding, setAdding] = useState(false)
  const [signingId, setSigningId] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!addName.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/audits/${auditId}/meetings/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingType,
          name: addName.trim(),
          roleOrTitle: addRole.trim() || null,
        }),
      })
      if (res.ok) {
        setAddName('')
        setAddRole('')
        onRefresh()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to add attendee')
      }
    } finally {
      setAdding(false)
    }
  }

  const handleSign = async (attendanceId: string) => {
    setSigningId(attendanceId)
    try {
      const res = await fetch(
        `/api/audits/${auditId}/meetings/attendance/${attendanceId}/sign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      )
      if (res.ok) {
        onRefresh()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to record sign-off')
      }
    } finally {
      setSigningId(null)
    }
  }

  const displayName = (row: AttendanceRow) => {
    if (row.name) return row.name
    if (row.User) {
      return [row.User.firstName, row.User.lastName].filter(Boolean).join(' ') || row.User.email
    }
    return '—'
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 p-3 border rounded-lg bg-muted/30">
          <div className="flex-1 min-w-[120px] space-y-1">
            <Label htmlFor="att-name" className="text-xs">Name</Label>
            <Input
              id="att-name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Attendee name"
              className="h-9"
            />
          </div>
          <div className="flex-1 min-w-[100px] space-y-1">
            <Label htmlFor="att-role" className="text-xs">Role / Title</Label>
            <Input
              id="att-role"
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              placeholder="Role"
              className="h-9"
            />
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={adding || !addName.trim()}
          >
            {adding ? 'Adding...' : 'Add'}
          </Button>
        </div>
      )}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Role / Title</th>
              <th className="px-3 py-2 text-left font-medium">Signed</th>
              {canEdit && (
                <th className="px-3 py-2 text-right font-medium">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 4 : 3} className="px-3 py-4 text-center text-muted-foreground">
                  No attendees recorded yet.
                </td>
              </tr>
            ) : (
              attendance.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2">{displayName(row)}</td>
                  <td className="px-3 py-2">{row.roleOrTitle || '—'}</td>
                  <td className="px-3 py-2">
                    {row.signedAt ? (
                      <span className="text-green-600">
                        {formatDateTime(row.signedAt)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2 text-right">
                      {!row.signedAt && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSign(row.id)}
                          disabled={signingId === row.id}
                        >
                          {signingId === row.id ? 'Signing...' : 'Sign'}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
