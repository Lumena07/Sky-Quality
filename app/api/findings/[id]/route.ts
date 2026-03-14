import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isNormalUser, canSeeAmDashboard, canCreateFinding, canReviewFindingForAudit } from '@/lib/permissions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: finding, error } = await supabase
      .from('Finding')
      .select(
        `
        *,
        Audit:auditId(*),
        Department:departmentId(*),
        AssignedTo:assignedToId(*),
        CorrectiveAction(
          *,
          Responsible:responsibleId(*),
          Attachments:CAPAttachment(*)
        )
      `
      )
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116' || (error as { details?: string }).details?.includes('0 rows')) {
        return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
      }
      console.error('Error fetching finding from Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to fetch finding' },
        { status: 500 }
      )
    }

    if (!finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    const { data: attachmentRows } = await supabase
      .from('FindingAttachment')
      .select('*')
      .eq('findingId', id)

    // Ensure CorrectiveAction is always present (embed can vary by PostgREST relation name)
    let correctiveActionData = (finding as Record<string, unknown>).CorrectiveAction
      ?? (finding as Record<string, unknown>).correctiveAction
    if (!correctiveActionData) {
      const { data: caRows } = await supabase
        .from('CorrectiveAction')
        .select('*')
        .eq('findingId', id)
      correctiveActionData = (caRows?.length ?? 0) > 0 ? caRows : []
    }
    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (isNormalUser(roles) && !canSeeAmDashboard(roles)) {
      const assignedToId = (finding as { assignedToId?: string }).assignedToId
      if (assignedToId !== user.id) {
        return NextResponse.json(
          { error: 'You can only view findings assigned to you' },
          { status: 403 }
        )
      }
    }

    const auditId = (finding as { auditId?: string }).auditId
    const canReviewCapCat =
      typeof auditId === 'string'
        ? await canReviewFindingForAudit(supabase, user.id, auditId, roles)
        : false

    const response = {
      ...finding,
      attachments: attachmentRows ?? [],
      CorrectiveAction: Array.isArray(correctiveActionData) ? correctiveActionData : [correctiveActionData],
      canReviewCapCat,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching finding:', error)
    return NextResponse.json(
      { error: 'Failed to fetch finding' },
      { status: 500 }
    )
  }
}

/** PATCH: Assignee-only can update root cause (RCA); reviewers can update department, description, priority, assignee, classification. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    const { data: existing } = await supabase
      .from('Finding')
      .select('assignedToId, status')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    const body = (await request.clone().json().catch(() => ({}))) as Record<string, unknown>
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }

    if (canCreateFinding(roles)) {
      if (body.departmentId !== undefined) updates.departmentId = body.departmentId
      if (body.description !== undefined) updates.description = body.description
      if (body.priority !== undefined) updates.priority = body.priority
      if (body.assignedToId !== undefined) updates.assignedToId = body.assignedToId
      if (body.classificationId !== undefined) updates.classificationId = body.classificationId || null
    }

    const rootCause = typeof body.rootCause === 'string' ? body.rootCause.trim() : null
    const isAssignee = (existing as { assignedToId: string }).assignedToId === user.id
    // Only the person assigned to the finding can maintain RCA (assignee-only is intentional).
    if (rootCause !== null && isAssignee) {
      const { data: existingCa } = await supabase
        .from('CorrectiveAction')
        .select('id')
        .eq('findingId', id)
        .maybeSingle()
      if (existingCa) {
        return NextResponse.json(
          { error: 'Root cause cannot be changed once a Corrective Action Plan has been submitted. Only the CAP can be updated.' },
          { status: 400 }
        )
      }
      updates.rootCause = rootCause
      if ((existing as { status?: string }).status === 'OPEN') {
        updates.status = 'IN_PROGRESS'
      }
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: 'No allowed fields to update' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('Finding')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating finding:', error)
      return NextResponse.json({ error: 'Failed to update finding' }, { status: 500 })
    }
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error in PATCH /api/findings/[id]:', error)
    return NextResponse.json({ error: 'Failed to update finding' }, { status: 500 })
  }
}
