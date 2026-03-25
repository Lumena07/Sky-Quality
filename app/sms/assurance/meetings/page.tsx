'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Send } from 'lucide-react'
import { SmsTiptapEditor } from '@/components/sms/sms-tiptap-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type MeetingRow = {
  id: string
  meeting_number: string
  meeting_type: string
  title: string
  chaired_by_id: string | null
  scheduled_at: string
  actual_held_at: string | null
  status: string
  minutes: string | null
  minutes_html: string | null
  minutes_published_at: string | null
  attendee_user_ids: string[]
  agenda_items: { title: string; notes?: string }[]
  decisions: string | null
}

type ActionRow = {
  id: string
  description: string
  owner_id: string | null
  due_date: string | null
  status: string
}

type UserOpt = { id: string; firstName?: string; lastName?: string; email?: string }

const MEETING_HINTS: Record<string, string> = {
  SRB: 'Safety Review Board — chaired by Accountable Manager; quarterly minimum. Agenda: performance, SPIs, high-risk hazards, regulatory updates.',
  SAG: 'Safety Action Group — chaired by Director of Safety; monthly minimum. Operational issues, investigations, CAPAs, hazard trends.',
  SAFETY_COMMITTEE:
    'Safety Committee — cross-departmental; monthly minimum. SPI review, communications, lessons learned, training compliance.',
}

const SmsAssuranceMeetingsPage = () => {
  const [meetings, setMeetings] = useState<MeetingRow[]>([])
  const [users, setUsers] = useState<UserOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ meeting: MeetingRow; actions: ActionRow[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [minutesHtml, setMinutesHtml] = useState('')

  const [createForm, setCreateForm] = useState({
    meetingType: 'SAG',
    title: '',
    scheduledAt: '',
  })

  const [agendaDraft, setAgendaDraft] = useState({ title: '', notes: '' })
  const [actionDraft, setActionDraft] = useState({ description: '', ownerId: '', dueDate: '' })
  const [decisionsText, setDecisionsText] = useState('')

  const loadMeetings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sms/meetings', { credentials: 'same-origin' })
      if (res.ok) setMeetings(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMeetings()
  }, [loadMeetings])

  useEffect(() => {
    const run = async () => {
      const res = await fetch('/api/me', { credentials: 'same-origin' })
      if (!res.ok) return
      const me = await res.json()
      const r = Array.isArray(me.roles) ? me.roles : []
      setCanEdit(
        r.includes('DIRECTOR_OF_SAFETY') ||
          r.includes('SAFETY_OFFICER') ||
          r.includes('ACCOUNTABLE_MANAGER')
      )
    }
    run()
  }, [])

  useEffect(() => {
    const run = async () => {
      const res = await fetch('/api/users', { credentials: 'same-origin' })
      if (!res.ok) return
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    }
    run()
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/sms/meetings/${id}`, { credentials: 'same-origin' })
      if (res.ok) {
        const j = await res.json()
        setDetail({ meeting: j.meeting, actions: j.actions ?? [] })
        setMinutesHtml(String(j.meeting.minutes_html ?? ''))
        setDecisionsText(String(j.meeting.decisions ?? ''))
      }
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else {
      setDetail(null)
      setMinutesHtml('')
      setDecisionsText('')
    }
  }, [selectedId, loadDetail])

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('meetingId')
    if (id) setSelectedId(id)
  }, [])

  const patchMeeting = async (body: Record<string, unknown>) => {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sms/meetings/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to save')
        return
      }
      await loadDetail(selectedId)
      await loadMeetings()
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.title.trim() || !createForm.scheduledAt) return
    const res = await fetch('/api/sms/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        meetingType: createForm.meetingType,
        title: createForm.title,
        scheduledAt: new Date(createForm.scheduledAt).toISOString(),
        agendaItems: [],
        attendeeUserIds: [],
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed')
      return
    }
    const created = await res.json()
    setCreateForm({ meetingType: 'SAG', title: '', scheduledAt: '' })
    await loadMeetings()
    setSelectedId(created.id)
  }

  const toggleAttendee = (userId: string) => {
    if (!detail) return
    const cur = new Set(detail.meeting.attendee_user_ids ?? [])
    if (cur.has(userId)) cur.delete(userId)
    else cur.add(userId)
    const next = { ...detail.meeting, attendee_user_ids: Array.from(cur) }
    setDetail({ ...detail, meeting: next })
  }

  const saveAttendees = () => {
    if (!detail) return
    void patchMeeting({ attendeeUserIds: detail.meeting.attendee_user_ids })
  }

  const addAgendaItem = () => {
    if (!detail || !agendaDraft.title.trim()) return
    const items = [...(detail.meeting.agenda_items ?? []), { title: agendaDraft.title.trim(), notes: agendaDraft.notes }]
    setDetail({ ...detail, meeting: { ...detail.meeting, agenda_items: items } })
    setAgendaDraft({ title: '', notes: '' })
    void patchMeeting({ agendaItems: items })
  }

  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId || !actionDraft.description.trim()) return
    const res = await fetch(`/api/sms/meetings/${selectedId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        description: actionDraft.description,
        ownerId: actionDraft.ownerId || null,
        dueDate: actionDraft.dueDate || null,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed')
      return
    }
    setActionDraft({ description: '', ownerId: '', dueDate: '' })
    await loadDetail(selectedId)
  }

  const patchAction = async (actionId: string, patch: Record<string, unknown>) => {
    if (!selectedId) return
    const res = await fetch(`/api/sms/meetings/${selectedId}/actions/${actionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed')
      return
    }
    await loadDetail(selectedId)
  }

  const userLabel = useCallback((u: UserOpt) => {
    const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
    return n || u.email || u.id
  }, [])

  const hint = detail ? MEETING_HINTS[detail.meeting.meeting_type] ?? '' : ''

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Safety meetings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          SRB, Safety Action Group, and Safety Committee records with minutes and tracked actions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Meetings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[560px] overflow-y-auto">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading" />
            ) : (
              meetings.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                    selectedId === m.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="font-medium">{m.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.meeting_number} · {m.meeting_type}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {canEdit ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Schedule meeting</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={createForm.meetingType}
                      onValueChange={(v) => setCreateForm((p) => ({ ...p, meetingType: v }))}
                    >
                      <SelectTrigger aria-label="Meeting type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SRB">Safety Review Board</SelectItem>
                        <SelectItem value="SAG">Safety Action Group</SelectItem>
                        <SelectItem value="SAFETY_COMMITTEE">Safety Committee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mtg-title">Title</Label>
                    <Input
                      id="mtg-title"
                      value={createForm.title}
                      onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="mtg-when">Scheduled</Label>
                    <Input
                      id="mtg-when"
                      type="datetime-local"
                      value={createForm.scheduledAt}
                      onChange={(e) => setCreateForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" className="gap-2">
                      <Plus className="h-4 w-4" aria-hidden />
                      Create
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {detailLoading ? (
            <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading meeting" />
          ) : !detail ? (
            <p className="text-muted-foreground text-sm">Select a meeting or create one.</p>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{detail.meeting.title}</CardTitle>
                <CardDescription>
                  {detail.meeting.meeting_number} · {detail.meeting.meeting_type}
                </CardDescription>
                {hint ? <p className="text-sm text-muted-foreground mt-2">{hint}</p> : null}
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="details">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="agenda">Agenda</TabsTrigger>
                    <TabsTrigger value="minutes">Minutes</TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="mt-4 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{detail.meeting.status}</Badge>
                      {detail.meeting.minutes_published_at ? (
                        <Badge variant="secondary">Minutes published</Badge>
                      ) : null}
                    </div>
                    {canEdit ? (
                      <div className="grid gap-2 max-w-xs">
                        <Label htmlFor="held">Actual held (optional)</Label>
                        <Input
                          id="held"
                          type="datetime-local"
                          defaultValue={
                            detail.meeting.actual_held_at
                              ? detail.meeting.actual_held_at.slice(0, 16)
                              : ''
                          }
                          onBlur={(e) => {
                            const v = e.target.value
                            void patchMeeting({
                              actualHeldAt: v ? new Date(v).toISOString() : null,
                            })
                          }}
                        />
                      </div>
                    ) : null}

                    <div>
                      <h3 className="text-sm font-medium mb-2">Attendees</h3>
                      <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                        {users.slice(0, 80).map((u) => (
                          <label key={u.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={(detail.meeting.attendee_user_ids ?? []).includes(u.id)}
                              disabled={!canEdit}
                              onChange={() => toggleAttendee(u.id)}
                            />
                            {userLabel(u)}
                          </label>
                        ))}
                      </div>
                      {canEdit ? (
                        <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => saveAttendees()}>
                          Save attendees
                        </Button>
                      ) : null}
                    </div>

                    <div>
                      <h3 className="text-sm font-medium mb-2">Decisions</h3>
                      <Textarea
                        value={decisionsText}
                        disabled={!canEdit}
                        onChange={(e) => setDecisionsText(e.target.value)}
                        rows={4}
                      />
                      {canEdit ? (
                        <Button
                          type="button"
                          size="sm"
                          className="mt-2"
                          disabled={saving}
                          onClick={() => void patchMeeting({ decisions: decisionsText })}
                        >
                          Save decisions
                        </Button>
                      ) : null}
                    </div>
                  </TabsContent>

                  <TabsContent value="agenda" className="mt-4 space-y-4">
                    <ul className="space-y-2 text-sm">
                      {(detail.meeting.agenda_items ?? []).map((item, i) => (
                        <li key={i} className="border rounded-md p-2">
                          <div className="font-medium">{item.title}</div>
                          {item.notes ? <p className="text-muted-foreground mt-1">{item.notes}</p> : null}
                        </li>
                      ))}
                    </ul>
                    {canEdit ? (
                      <div className="grid gap-2 max-w-lg">
                        <Input
                          placeholder="Agenda item title"
                          value={agendaDraft.title}
                          onChange={(e) => setAgendaDraft((p) => ({ ...p, title: e.target.value }))}
                        />
                        <Input
                          placeholder="Notes (optional)"
                          value={agendaDraft.notes}
                          onChange={(e) => setAgendaDraft((p) => ({ ...p, notes: e.target.value }))}
                        />
                        <Button type="button" size="sm" onClick={() => addAgendaItem()}>
                          Add agenda item
                        </Button>
                      </div>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="minutes" className="mt-4 space-y-4">
                    {canEdit ? (
                      <>
                        <SmsTiptapEditor content={minutesHtml} onChange={setMinutesHtml} editable />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={saving}
                            onClick={() => void patchMeeting({ minutesHtml })}
                          >
                            Save draft
                          </Button>
                          <Button
                            type="button"
                            className="gap-2"
                            disabled={saving}
                            onClick={() => void patchMeeting({ minutesHtml, publishMinutes: true })}
                          >
                            <Send className="h-4 w-4" aria-hidden />
                            Publish minutes to attendees
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div
                        className="prose prose-sm max-w-none border rounded-md p-4"
                        dangerouslySetInnerHTML={{ __html: minutesHtml || '<p>No minutes yet.</p>' }}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="actions" className="mt-4 space-y-4">
                    <ul className="space-y-2">
                      {detail.actions.map((a) => (
                        <li key={a.id} className="border rounded-md p-3 text-sm">
                          <p>{a.description}</p>
                          <div className="flex flex-wrap gap-2 mt-2 items-center">
                            <Badge variant="outline">{a.status}</Badge>
                            {canEdit ? (
                              <Select
                                value={a.status}
                                onValueChange={(v) => void patchAction(a.id, { status: v })}
                              >
                                <SelectTrigger className="h-8 w-[140px]" aria-label="Action status">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="OPEN">Open</SelectItem>
                                  <SelectItem value="COMPLETED">Completed</SelectItem>
                                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {canEdit ? (
                      <form onSubmit={handleAddAction} className="grid gap-2 max-w-lg">
                        <Textarea
                          placeholder="Action description"
                          value={actionDraft.description}
                          onChange={(e) => setActionDraft((p) => ({ ...p, description: e.target.value }))}
                          rows={2}
                        />
                        <Select
                          value={actionDraft.ownerId || '__none__'}
                          onValueChange={(v) =>
                            setActionDraft((p) => ({ ...p, ownerId: v === '__none__' ? '' : v }))
                          }
                        >
                          <SelectTrigger aria-label="Owner">
                            <SelectValue placeholder="Owner (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No owner</SelectItem>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {userLabel(u)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="date"
                          value={actionDraft.dueDate}
                          onChange={(e) => setActionDraft((p) => ({ ...p, dueDate: e.target.value }))}
                        />
                        <Button type="submit" size="sm">
                          Add action
                        </Button>
                      </form>
                    ) : null}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default SmsAssuranceMeetingsPage
