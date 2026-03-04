import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isNormalUser } from '@/lib/permissions'

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
    const response = {
      ...finding,
      attachments: attachmentRows ?? [],
      CorrectiveAction: Array.isArray(correctiveActionData) ? correctiveActionData : [correctiveActionData],
    }

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (isNormalUser(roles)) {
      const assignedToId = (response as { assignedToId?: string }).assignedToId
      if (assignedToId !== user.id) {
        return NextResponse.json(
          { error: 'You can only view findings assigned to you' },
          { status: 403 }
        )
      }
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

/** PATCH: Assignee updates root cause. Resubmission after reject sets status to PENDING. */
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

    const { data: existing } = await supabase
      .from('Finding')
      .select('assignedToId, status')
      .eq('id', id)
      .single()

    if (!existing || (existing as { assignedToId: string }).assignedToId !== user.id) {
      return NextResponse.json(
        { error: 'Only the person assigned to this finding can update root cause' },
        { status: 403 }
      )
    }

    const body = await request.clone().json().catch(() => ({}))
    const rootCause = typeof body.rootCause === 'string' ? body.rootCause.trim() : null

    if (rootCause !== null) {
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
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }
    if (rootCause !== null) {
      updates.rootCause = rootCause
      // Root cause has no approval status; only CAP and CAT are approved/rejected
      // Move finding from OPEN to IN_PROGRESS when assignee first submits root cause
      if ((existing as { status?: string }).status === 'OPEN') {
        updates.status = 'IN_PROGRESS'
      }
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
