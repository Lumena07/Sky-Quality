import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'
import { getCurrentUserProfile, canEditAudit } from '@/lib/permissions'
import { deleteLocalPublicUpload } from '@/lib/delete-local-upload'

/** Resolve dayRef + time (HH:mm) to ISO datetime using audit start/end. */
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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: audit, error } = await supabase
      .from('Audit')
      .select(
        `
        *,
        Department:departmentId(*),
        Auditors:AuditAuditor(*),
        Auditees:AuditAuditee(*),
        Documents:AuditDocument(
          *
        ),
        Findings:Finding(
          *,
          AssignedTo:assignedToId(*),
          CorrectiveAction(*)
        ),
        Checklist:checklistId(
          *,
          Items:ChecklistItem(*)
        ),
        ScheduleItems:AuditScheduleItem(*)
      `
      )
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching audit from Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to fetch audit' },
        { status: 500 }
      )
    }

    if (!audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    const auditors = (audit as { Auditors?: Array<{ userId?: string }> }).Auditors ?? (audit as { auditors?: Array<{ userId?: string }> }).auditors ?? []
    const auditees = (audit as { Auditees?: Array<{ userId?: string }> }).Auditees ?? (audit as { auditees?: Array<{ userId?: string }> }).auditees ?? []
    const userIds = [
      ...auditors.map((a) => (a as { userId?: string }).userId).filter(Boolean),
      ...auditees.map((a) => (a as { userId?: string }).userId).filter(Boolean),
    ] as string[]
    const uniqueUserIds = Array.from(new Set(userIds))

    let userMap: Record<string, { id: string; firstName?: string; lastName?: string; email?: string }> = {}
    if (uniqueUserIds.length > 0) {
      const { data: users } = await supabase
        .from('User')
        .select('id, firstName, lastName, email')
        .in('id', uniqueUserIds)
      if (users?.length) {
        userMap = Object.fromEntries(users.map((u) => [u.id, u]))
      }
    }

    const enrichedAuditors = auditors.map((a: Record<string, unknown>) => {
      const uid = a.userId as string | undefined
      const user = uid ? userMap[uid] : null
      return { ...a, User: user ?? null, user: user ?? null }
    })
    const enrichedAuditees = auditees.map((a: Record<string, unknown>) => {
      const uid = a.userId as string | undefined
      const user = uid ? userMap[uid] : null
      return { ...a, User: user ?? null, user: user ?? null }
    })

    const response = {
      ...audit,
      Auditors: enrichedAuditors,
      Auditees: enrichedAuditees,
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching audit:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    const { data: auditorRows } = await supabase
      .from('AuditAuditor')
      .select('userId')
      .eq('auditId', params.id)
    const auditorIds = (auditorRows ?? []).map((r: { userId: string }) => r.userId)
    const { data: auditeeRows } = await supabase
      .from('AuditAuditee')
      .select('userId')
      .eq('auditId', params.id)
    const auditeeIds = (auditeeRows ?? [])
      .map((r: { userId: string | null }) => r.userId)
      .filter(Boolean) as string[]
    if (!canEditAudit(roles, user.id, auditorIds, auditeeIds)) {
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors assigned to this audit can edit it' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      status,
      checklistId,
      openingMeetingAt,
      closingMeetingAt,
      scheduleNotes,
      closingMeetingNotes,
      startDate,
      endDate,
      scheduleItems,
    } = body

    if (startDate != null || endDate != null) {
      return NextResponse.json(
        {
          error:
            'Reschedule requires Accountable Manager approval. Use Request reschedule and wait for AM approval.',
        },
        { status: 400 }
      )
    }

    if (status === 'ACTIVE') {
      const { data: pendingReschedule } = await supabase
        .from('AuditRescheduleRequest')
        .select('id')
        .eq('auditId', params.id)
        .eq('status', 'PENDING')
        .limit(1)
      if (pendingReschedule && pendingReschedule.length > 0) {
        return NextResponse.json(
          {
            error:
              'Cannot start audit while a reschedule request is pending. The Accountable Manager must approve or reject the request first.',
          },
          { status: 400 }
        )
      }
      const { data: auditCheck, error: checkError } = await supabase
        .from('Audit')
        .select('checklistId, type, checklistScheduleSentAt')
        .eq('id', params.id)
        .single()

      if (checkError || !auditCheck?.checklistId) {
        return NextResponse.json(
          { error: 'Cannot start audit without a checklist selected' },
          { status: 400 }
        )
      }

      const isERP = (auditCheck as { type?: string }).type === 'ERP'
      const sentAt = (auditCheck as { checklistScheduleSentAt?: string | null }).checklistScheduleSentAt
      if (!isERP && !sentAt) {
        return NextResponse.json(
          {
            error:
              'Send the checklist and schedule to auditees before starting the audit (Audit Schedule tab).',
          },
          { status: 400 }
        )
      }
    }

    if (status === 'COMPLETED') {
      const { data: openFindings, error: findingsError } = await supabase
        .from('Finding')
        .select('id')
        .eq('auditId', params.id)
        .neq('status', 'CLOSED')

      if (findingsError) {
        console.error('Error checking findings for audit completion:', findingsError)
        return NextResponse.json(
          { error: 'Failed to check findings status' },
          { status: 500 }
        )
      }
      const openCount = openFindings?.length ?? 0
      if (openCount > 0) {
        return NextResponse.json(
          {
            error:
              'Cannot complete audit: all findings must be closed first. Close or resolve open findings and try again.',
          },
          { status: 400 }
        )
      }
    }

    const { data: auditBefore } = await supabase
      .from('Audit')
      .select('startDate, endDate, title, auditPlanId')
      .eq('id', params.id)
      .single()

    const updatePayload: Record<string, unknown> = {}
    if (status != null) updatePayload.status = status
    if (checklistId !== undefined) updatePayload.checklistId = checklistId || null
    if (openingMeetingAt !== undefined) updatePayload.openingMeetingAt = openingMeetingAt ? new Date(openingMeetingAt).toISOString() : null
    if (closingMeetingAt !== undefined) updatePayload.closingMeetingAt = closingMeetingAt ? new Date(closingMeetingAt).toISOString() : null
    if (scheduleNotes !== undefined) updatePayload.scheduleNotes = scheduleNotes ?? null
    if (closingMeetingNotes !== undefined) updatePayload.closingMeetingNotes = closingMeetingNotes ?? null
    if (startDate !== undefined) updatePayload.startDate = startDate ? new Date(startDate).toISOString() : null
    if (endDate !== undefined) {
      const end = endDate ? new Date(endDate) : null
      if (end && updatePayload.startDate && new Date(updatePayload.startDate as string) > end) {
        return NextResponse.json(
          { error: 'End date must be on or after start date' },
          { status: 400 }
        )
      }
      updatePayload.endDate = end ? end.toISOString() : null
    }

    const effectiveStart = (updatePayload.startDate as string) ?? auditBefore?.startDate
    const effectiveEnd = (updatePayload.endDate as string) ?? auditBefore?.endDate

    if (Array.isArray(scheduleItems)) {
      await supabase.from('AuditScheduleItem').delete().eq('auditId', params.id)
      const validDayRefs = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'last']
      const toInsert = scheduleItems
        .filter(
          (item: { label?: string; dayRef?: string; time?: string }) =>
            item && typeof item.label === 'string' && item.label.trim() && validDayRefs.includes(String(item.dayRef || '1')) && typeof item.time === 'string'
        )
        .map((item: { label?: string; dayRef?: string; time?: string }, index: number) => ({
          id: randomUUID(),
          auditId: params.id,
          label: String(item.label).trim(),
          dayRef: String(item.dayRef || '1'),
          time: String(item.time).trim().slice(0, 5),
          sortOrder: index,
        }))
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from('AuditScheduleItem').insert(toInsert)
        if (insertError) {
          console.error('Error inserting schedule items:', insertError)
          return NextResponse.json({ error: 'Failed to save schedule items' }, { status: 500 })
        }
      }
      const openingItem = toInsert.find((i: { label: string }) => i.label === 'Opening meeting')
      const closingItem = toInsert.find((i: { label: string }) => i.label === 'Closing meeting')
      if (effectiveStart && effectiveEnd) {
        if (openingItem) {
          const resolved = resolveScheduleDateTime(effectiveStart, effectiveEnd, openingItem.dayRef, openingItem.time)
          if (resolved) updatePayload.openingMeetingAt = resolved
        }
        if (closingItem) {
          const resolved = resolveScheduleDateTime(effectiveStart, effectiveEnd, closingItem.dayRef, closingItem.time)
          if (resolved) updatePayload.closingMeetingAt = resolved
        }
      }
    } else if (startDate != null || endDate != null) {
      const { data: existingItems } = await supabase
        .from('AuditScheduleItem')
        .select('label, dayRef, time')
        .eq('auditId', params.id)
        .order('sortOrder', { ascending: true })
      const items = existingItems ?? []
      const openingItem = items.find((i: { label: string }) => i.label === 'Opening meeting')
      const closingItem = items.find((i: { label: string }) => i.label === 'Closing meeting')
      if (effectiveStart && effectiveEnd) {
        if (openingItem) {
          const resolved = resolveScheduleDateTime(effectiveStart, effectiveEnd, openingItem.dayRef, openingItem.time)
          if (resolved) updatePayload.openingMeetingAt = resolved
        }
        if (closingItem) {
          const resolved = resolveScheduleDateTime(effectiveStart, effectiveEnd, closingItem.dayRef, closingItem.time)
          if (resolved) updatePayload.closingMeetingAt = resolved
        }
      }
    }

    const { data: audit, error: updateError } = await supabase
      .from('Audit')
      .update(updatePayload)
      .eq('id', params.id)
      .select(
        `
        *,
        Department:departmentId(*),
        Auditors:AuditAuditor(
          *,
          User:userId(*)
        ),
        Auditees:AuditAuditee(
          *,
          User:userId(*)
        ),
        Checklist:checklistId(
          *,
          Items:ChecklistItem(*)
        ),
        ScheduleItems:AuditScheduleItem(*)
      `
      )
      .single()

    if (updateError || !audit) {
      console.error('Error updating audit in Supabase:', updateError)
      return NextResponse.json(
        { error: 'Failed to update audit' },
        { status: 500 }
      )
    }

    if (status === 'COMPLETED') {
      const planId = (auditBefore as { auditPlanId?: string | null })?.auditPlanId
      if (planId && typeof planId === 'string') {
        const completionDate = effectiveEnd ? String(effectiveEnd).slice(0, 10) : (audit as { endDate?: string }).endDate?.slice(0, 10)
        if (completionDate) {
          const { error: planUpdateError } = await supabase
            .from('AuditPlan')
            .update({ lastDoneDate: completionDate, updatedAt: new Date().toISOString() })
            .eq('id', planId)
          if (planUpdateError) {
            console.error('Error updating AuditPlan lastDoneDate:', planUpdateError)
          }
        }
      }
    }

    if (status === 'CLOSED') {
      const { data: focalDocs } = await supabase
        .from('AuditDocument')
        .select('id, fileUrl')
        .eq('auditId', params.id)
        .eq('documentKind', 'FOCAL_PRE_AUDIT')

      const docRows = (focalDocs ?? []) as Array<{ id: string; fileUrl: string | null }>
      for (const doc of docRows) {
        if (doc.fileUrl) await deleteLocalPublicUpload(doc.fileUrl)
      }
      if (docRows.length > 0) {
        const docIds = docRows.map((d) => d.id)
        await supabase.from('AuditDocument').delete().in('id', docIds)
      }
    }

    const isReschedule =
      (startDate != null || endDate != null) &&
      auditBefore &&
      (String(audit.startDate) !== String(auditBefore.startDate) ||
        String(audit.endDate) !== String(auditBefore.endDate))

    await createActivityLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Audit',
      entityId: audit.id,
      details: isReschedule
        ? `Rescheduled audit: ${audit.title}`
        : `Updated audit: ${audit.title}`,
      auditId: audit.id,
    })

    if (isReschedule) {
      const { data: auditeeRows } = await supabase
        .from('AuditAuditee')
        .select('userId')
        .eq('auditId', params.id)
      const auditeeUserIds = (auditeeRows ?? [])
        .map((r: { userId: string | null }) => r.userId)
        .filter(Boolean) as string[]
      for (const uid of auditeeUserIds) {
        await supabase.from('Notification').insert({
          id: randomUUID(),
          userId: uid,
          type: 'AUDIT_REMINDER',
          title: 'Audit rescheduled',
          message: `Audit "${audit.title}" has been rescheduled. Please check the new dates.`,
          link: `/audits/${audit.id}`,
          auditId: audit.id,
        })
      }
    }

    return NextResponse.json(audit)
  } catch (error) {
    console.error('Error updating audit:', error)
    return NextResponse.json(
      { error: 'Failed to update audit' },
      { status: 500 }
    )
  }
}
