import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'
import { getCurrentUserProfile, isAuditorOnly } from '@/lib/permissions'

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
        )
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
    const uniqueUserIds = [...new Set(userIds)]

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
    if (isAuditorOnly(roles)) {
      const { data: auditorRows } = await supabase
        .from('AuditAuditor')
        .select('userId')
        .eq('auditId', params.id)
      const auditorIds = (auditorRows ?? []).map((r: { userId: string }) => r.userId)
      if (!auditorIds.includes(user.id)) {
        return NextResponse.json(
          { error: 'You can only edit audits where you are assigned as auditor' },
          { status: 403 }
        )
      }
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
    } = body

    if (status === 'ACTIVE') {
      const { data: auditCheck, error: checkError } = await supabase
        .from('Audit')
        .select('checklistId')
        .eq('id', params.id)
        .single()

      if (checkError || !auditCheck?.checklistId) {
        return NextResponse.json(
          { error: 'Cannot start audit without a checklist selected' },
          { status: 400 }
        )
      }
    }

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

    const { data: auditBefore } = await supabase
      .from('Audit')
      .select('startDate, endDate, title')
      .eq('id', params.id)
      .single()

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
        )
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
