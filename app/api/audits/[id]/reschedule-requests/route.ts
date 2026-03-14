import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, canEditAudit } from '@/lib/permissions'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: auditId } = params
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: rows, error } = await supabase
      .from('AuditRescheduleRequest')
      .select(
        '*, RequestedBy:requestedById(id, firstName, lastName, email), ReviewedBy:reviewedById(id, firstName, lastName, email)'
      )
      .eq('auditId', auditId)
      .order('requestedAt', { ascending: false })

    if (error) {
      console.error('Error fetching reschedule requests:', error)
      return NextResponse.json(
        { error: 'Failed to fetch reschedule requests' },
        { status: 500 }
      )
    }

    return NextResponse.json(rows ?? [])
  } catch (err) {
    console.error('Error in reschedule-requests GET:', err)
    return NextResponse.json(
      { error: 'Failed to fetch reschedule requests' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: auditId } = params
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: audit, error: auditError } = await supabase
      .from('Audit')
      .select('id, status')
      .eq('id', auditId)
      .single()

    if (auditError || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    const auditStatus = (audit as { status?: string }).status
    if (auditStatus !== 'PLANNED') {
      return NextResponse.json(
        { error: 'Reschedule can only be requested for a planned audit' },
        { status: 400 }
      )
    }

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    const { data: auditorRows } = await supabase
      .from('AuditAuditor')
      .select('userId')
      .eq('auditId', auditId)
    const auditorIds = (auditorRows ?? []).map((r: { userId: string }) => r.userId)
    const { data: auditeeRows } = await supabase
      .from('AuditAuditee')
      .select('userId')
      .eq('auditId', auditId)
    const auditeeIds = (auditeeRows ?? [])
      .map((r: { userId: string | null }) => r.userId)
      .filter(Boolean) as string[]
    if (!canEditAudit(roles, user.id, auditorIds, auditeeIds)) {
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors assigned to this audit can request reschedule' },
        { status: 403 }
      )
    }

    const { data: existingPending } = await supabase
      .from('AuditRescheduleRequest')
      .select('id')
      .eq('auditId', auditId)
      .eq('status', 'PENDING')
      .limit(1)

    if (existingPending && existingPending.length > 0) {
      return NextResponse.json(
        { error: 'A reschedule request is already pending for this audit' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { requestedStartDate, requestedEndDate, reason } = body

    if (!requestedStartDate || !requestedEndDate) {
      return NextResponse.json(
        { error: 'requestedStartDate and requestedEndDate are required' },
        { status: 400 }
      )
    }

    const start = new Date(requestedStartDate)
    const end = new Date(requestedEndDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format for requestedStartDate or requestedEndDate' },
        { status: 400 }
      )
    }
    if (end < start) {
      return NextResponse.json(
        { error: 'requestedEndDate must be on or after requestedStartDate' },
        { status: 400 }
      )
    }

    const reasonTrimmed =
      reason != null && typeof reason === 'string' ? reason.trim() : ''
    if (!reasonTrimmed) {
      return NextResponse.json(
        { error: 'Reason is required for a reschedule request' },
        { status: 400 }
      )
    }

    const requestId = randomUUID()
    const startDateOnly = requestedStartDate.toString().slice(0, 10)
    const endDateOnly = requestedEndDate.toString().slice(0, 10)

    const { data: inserted, error: insertError } = await supabase
      .from('AuditRescheduleRequest')
      .insert({
        id: requestId,
        auditId,
        requestedById: user.id,
        requestedStartDate: startDateOnly,
        requestedEndDate: endDateOnly,
        reason: reasonTrimmed,
        status: 'PENDING',
      })
      .select('*')
      .single()

    if (insertError || !inserted) {
      console.error('Error creating reschedule request:', insertError)
      return NextResponse.json(
        { error: 'Failed to create reschedule request' },
        { status: 500 }
      )
    }

    const { data: amUsers } = await supabase
      .from('User')
      .select('id')
      .eq('isActive', true)
      .contains('roles', ['ACCOUNTABLE_MANAGER'])

    const amIds = (amUsers ?? []).map((u: { id: string }) => u.id).filter(Boolean)
    for (const uid of amIds) {
      if (uid === user.id) continue
      await supabase.from('Notification').insert({
        id: randomUUID(),
        userId: uid,
        type: 'SYSTEM_ALERT',
        title: 'Audit reschedule requested',
        message: 'An audit reschedule has been requested. Please review and approve or reject.',
        link: `/audits/${auditId}`,
        auditId,
      })
    }

    return NextResponse.json(inserted, { status: 201 })
  } catch (err) {
    console.error('Error in reschedule-requests POST:', err)
    return NextResponse.json(
      { error: 'Failed to create reschedule request' },
      { status: 500 }
    )
  }
}
