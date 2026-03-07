import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { generateAuditNumber } from '@/lib/utils'
import { createActivityLog } from '@/lib/activity-log'

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const departmentId = searchParams.get('departmentId')

    let query = supabase
      .from('Audit')
      .select(
        `
        *,
        Department(*),
        Auditors:AuditAuditor(
          *,
          User(*)
        ),
        Auditees:AuditAuditee(
          *,
          User(*)
        )
      `
      )
      .order('startDate', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }
    if (departmentId) {
      query = query.eq('departmentId', departmentId)
    }

    const { data: audits, error } = await query

    if (error) {
      console.error('Error fetching audits from Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to fetch audits' },
        { status: 500 }
      )
    }

    return NextResponse.json(audits ?? [])
  } catch (error) {
    console.error('Error fetching audits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audits' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      scope,
      departmentId,
      base,
      scheduledDate,
      startDate,
      endDate,
      type,
      openingMeetingAt,
      closingMeetingAt,
      scheduleNotes,
      auditorIds = [],
      auditeeIds = [],
      externalAuditees = [],
    } = body

    const externalAuditeeUserIds = (externalAuditees as { userId?: string }[])
      .map((e) => e.userId)
      .filter(Boolean) as string[]
    const allAuditeeUserIds = [...(auditeeIds as string[]), ...externalAuditeeUserIds]
    const auditorSet = new Set(auditorIds)
    const overlap = allAuditeeUserIds.filter((id) => auditorSet.has(id))
    if (overlap.length > 0) {
      return NextResponse.json(
        {
          error:
            'A user cannot be both auditor and auditee on the same audit. Remove them from one list.',
        },
        { status: 400 }
      )
    }

    const start = startDate != null ? new Date(startDate) : scheduledDate != null ? new Date(scheduledDate) : new Date()
    const end = endDate != null ? new Date(endDate) : start
    if (end < start) {
      return NextResponse.json(
        { error: 'End date must be on or after start date' },
        { status: 400 }
      )
    }
    const now = new Date().toISOString()
    const { data: auditInsert, error: auditError } = await supabase
      .from('Audit')
      .insert({
        id: randomUUID(),
        auditNumber: generateAuditNumber(),
        title,
        description,
        scope,
        departmentId,
        base,
        scheduledDate: start.toISOString(),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        status: 'PLANNED',
        type: type || 'INTERNAL',
        openingMeetingAt: openingMeetingAt ? new Date(openingMeetingAt).toISOString() : null,
        closingMeetingAt: closingMeetingAt ? new Date(closingMeetingAt).toISOString() : null,
        scheduleNotes: scheduleNotes ?? null,
        createdById: user.id,
        updatedAt: now,
      })
      .select('id')
      .single()

    if (auditError || !auditInsert) {
      console.error('Error creating audit in Supabase:', auditError)
      return NextResponse.json(
        { error: 'Failed to create audit' },
        { status: 500 }
      )
    }

    const auditId = auditInsert.id

    const auditorRows = (auditorIds as string[]).map((userId: string) => ({
      id: randomUUID(),
      auditId,
      userId,
    }))

    const internalAuditeeRows = (auditeeIds as string[]).map((userId: string) => ({
      id: randomUUID(),
      auditId,
      userId,
      name: null,
      email: null,
    }))

    const externalAuditeeRows = externalAuditees.map(
      (auditee: { organizationId?: string; userId?: string; name?: string; email?: string }) => {
        if (auditee.userId) {
          return {
            id: randomUUID(),
            auditId,
            userId: auditee.userId,
            name: null,
            email: null,
          }
        }
        return {
          id: randomUUID(),
          auditId,
          userId: null,
          name: auditee.name ?? null,
          email: auditee.email ?? null,
        }
      }
    )

    if (auditorRows.length > 0) {
      const { error: auditorError } = await supabase
        .from('AuditAuditor')
        .insert(auditorRows)

      if (auditorError) {
        console.error('Error creating audit auditors in Supabase:', auditorError)
      }
    }

    const allAuditeeRows = [...internalAuditeeRows, ...externalAuditeeRows]
    if (allAuditeeRows.length > 0) {
      const { error: auditeeError } = await supabase
        .from('AuditAuditee')
        .insert(allAuditeeRows)

      if (auditeeError) {
        console.error('Error creating audit auditees in Supabase:', auditeeError)
      }
    }

    const allUserIds: string[] = [...auditorIds, ...auditeeIds, ...externalAuditeeUserIds]
    if (allUserIds.length > 0) {
      const notificationRows = allUserIds.map((userId: string) => ({
        id: randomUUID(),
        userId,
        type: 'AUDIT_SCHEDULED',
        title: 'New Audit Scheduled',
        message: `You have been assigned to audit: ${title}`,
        link: `/audits/${auditId}`,
      }))

      const { error: notificationError } = await supabase
        .from('Notification')
        .insert(notificationRows)

      if (notificationError) {
        console.error('Error creating notifications in Supabase:', notificationError)
      }
    }

    await createActivityLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Audit',
      entityId: auditId,
      details: `Created audit: ${title}`,
      auditId,
    })

    const { data: fullAudit, error: fetchError } = await supabase
      .from('Audit')
      .select(
        `
        *,
        Department(*),
        Auditors:AuditAuditor(
          *,
          User(*)
        ),
        Auditees:AuditAuditee(
          *,
          User(*)
        )
      `
      )
      .eq('id', auditId)
      .single()

    if (fetchError) {
      console.error('Error fetching created audit from Supabase:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch created audit' },
        { status: 500 }
      )
    }

    return NextResponse.json(fullAudit, { status: 201 })
  } catch (error) {
    console.error('Error creating audit:', error)
    return NextResponse.json(
      { error: 'Failed to create audit' },
      { status: 500 }
    )
  }
}
