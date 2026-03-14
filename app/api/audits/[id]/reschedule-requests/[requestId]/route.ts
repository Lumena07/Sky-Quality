import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'
import { getCurrentUserProfile, canApproveAuditReschedule } from '@/lib/permissions'

function resolveScheduleDateTime(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  dayRef: string,
  time: string
): string | null {
  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null
  if (!start || !end || !time || !/^\d{1,2}:\d{2}$/.test(time)) return null
  const [hours, minutes] = time.split(':').map(Number)
  let date: Date
  if (dayRef === 'last') {
    date = new Date(end)
  } else {
    const dayIndex = parseInt(dayRef, 10)
    if (Number.isNaN(dayIndex) || dayIndex < 1) return null
    date = new Date(start)
    date.setDate(date.getDate() + dayIndex - 1)
    const endTime = new Date(end).getTime()
    if (date.getTime() > endTime) date = new Date(end)
  }
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; requestId: string } }
) {
  try {
    const { id: auditId, requestId } = params
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!canApproveAuditReschedule(roles)) {
      return NextResponse.json(
        { error: 'Only the Accountable Manager can approve or reject reschedule requests' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { status, reviewNotes } = body

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be APPROVED or REJECTED' },
        { status: 400 }
      )
    }

    const { data: rescheduleRequest, error: fetchError } = await supabase
      .from('AuditRescheduleRequest')
      .select('*')
      .eq('id', requestId)
      .eq('auditId', auditId)
      .single()

    if (fetchError || !rescheduleRequest) {
      return NextResponse.json(
        { error: 'Reschedule request not found' },
        { status: 404 }
      )
    }

    const currentStatus = (rescheduleRequest as { status: string }).status
    if (currentStatus !== 'PENDING') {
      return NextResponse.json(
        { error: 'This reschedule request has already been reviewed' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('AuditRescheduleRequest')
      .update({
        status,
        reviewedById: user.id,
        reviewedAt: now,
        reviewNotes: reviewNotes != null && typeof reviewNotes === 'string' ? reviewNotes.trim() || null : null,
      })
      .eq('id', requestId)
      .eq('auditId', auditId)
      .select('*')
      .single()

    if (updateError || !updated) {
      console.error('Error updating reschedule request:', updateError)
      return NextResponse.json(
        { error: 'Failed to update reschedule request' },
        { status: 500 }
      )
    }

    if (status === 'APPROVED') {
      const req = rescheduleRequest as {
        requestedStartDate: string
        requestedEndDate: string
        requestedById: string
      }
      // Store date only (midnight UTC) so same-day 20–20 stays 20–20 in all timezones
      const startDateStored = req.requestedStartDate + 'T00:00:00.000Z'
      const endDateStored = req.requestedEndDate + 'T00:00:00.000Z'
      // For schedule resolution we need "end of last day" so "Last day" and closing meeting are correct
      const endIsoForSchedule = req.requestedEndDate + 'T23:59:59.999Z'

      const { data: audit, error: auditFetchError } = await supabase
        .from('Audit')
        .select('id, status, title')
        .eq('id', auditId)
        .single()

      if (auditFetchError || !audit) {
        return NextResponse.json(
          { error: 'Audit not found' },
          { status: 404 }
        )
      }

      const auditStatus = (audit as { status?: string }).status
      if (auditStatus !== 'PLANNED') {
        return NextResponse.json(
          {
            error:
              'Audit is no longer in PLANNED status. Reschedule cannot be applied. The request has been marked as reviewed.',
          },
          { status: 400 }
        )
      }

      const updatePayload: Record<string, unknown> = {
        startDate: startDateStored,
        endDate: endDateStored,
      }

      const { data: scheduleItems } = await supabase
        .from('AuditScheduleItem')
        .select('label, dayRef, time')
        .eq('auditId', auditId)
        .order('sortOrder', { ascending: true })

      const items = scheduleItems ?? []
      const openingItem = items.find((i: { label: string }) => i.label === 'Opening meeting')
      const closingItem = items.find((i: { label: string }) => i.label === 'Closing meeting')
      if (openingItem) {
        const resolved = resolveScheduleDateTime(
          startDateStored,
          endIsoForSchedule,
          (openingItem as { dayRef: string }).dayRef,
          (openingItem as { time: string }).time
        )
        if (resolved) updatePayload.openingMeetingAt = resolved
      }
      if (closingItem) {
        const resolved = resolveScheduleDateTime(
          startDateStored,
          endIsoForSchedule,
          (closingItem as { dayRef: string }).dayRef,
          (closingItem as { time: string }).time
        )
        if (resolved) updatePayload.closingMeetingAt = resolved
      }

      const { error: auditUpdateError } = await supabase
        .from('Audit')
        .update(updatePayload)
        .eq('id', auditId)

      if (auditUpdateError) {
        console.error('Error applying reschedule to audit:', auditUpdateError)
        return NextResponse.json(
          { error: 'Failed to apply reschedule to audit' },
          { status: 500 }
        )
      }

      const { data: auditeeRows } = await supabase
        .from('AuditAuditee')
        .select('userId')
        .eq('auditId', auditId)
      const auditeeUserIds = (auditeeRows ?? [])
        .map((r: { userId: string | null }) => r.userId)
        .filter(Boolean) as string[]
      for (const uid of auditeeUserIds) {
        await supabase.from('Notification').insert({
          id: randomUUID(),
          userId: uid,
          type: 'AUDIT_REMINDER',
          title: 'Audit rescheduled',
          message: `Audit "${(audit as { title?: string }).title ?? 'Audit'}" has been rescheduled. Please check the new dates.`,
          link: `/audits/${auditId}`,
          auditId,
        })
      }

      if (req.requestedById && req.requestedById !== user.id) {
        await supabase.from('Notification').insert({
          id: randomUUID(),
          userId: req.requestedById,
          type: 'SYSTEM_ALERT',
          title: 'Reschedule approved',
          message: `Your reschedule request for the audit has been approved by the Accountable Manager.`,
          link: `/audits/${auditId}`,
          auditId,
        })
      }
    } else {
      const requestedById = (rescheduleRequest as { requestedById?: string }).requestedById
      if (requestedById && requestedById !== user.id && reviewNotes) {
        await supabase.from('Notification').insert({
          id: randomUUID(),
          userId: requestedById,
          type: 'SYSTEM_ALERT',
          title: 'Reschedule request rejected',
          message: `Your reschedule request was rejected. ${typeof reviewNotes === 'string' ? reviewNotes : ''}`.trim(),
          link: `/audits/${auditId}`,
          auditId,
        })
      }
    }

    await createActivityLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'AuditRescheduleRequest',
      entityId: requestId,
      details: `Reschedule request ${status.toLowerCase()}: ${auditId}`,
      auditId,
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error in reschedule-requests PATCH:', err)
    return NextResponse.json(
      { error: 'Failed to update reschedule request' },
      { status: 500 }
    )
  }
}
