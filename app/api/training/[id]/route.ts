import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, hasReviewerRole, canSeeAmDashboard, canSeeTraining, canAddTraining } from '@/lib/permissions'

/** GET: Single training record. Owner or reviewers/AM. */
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

    const { data: record, error } = await supabase
      .from('TrainingRecord')
      .select(
        `
        *,
        User:userId(id, email, firstName, lastName)
      `
      )
      .eq('id', id)
      .single()

    if (error || !record) {
      return NextResponse.json({ error: 'Training record not found' }, { status: 404 })
    }

    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    if (!canSeeTraining(roles, departmentId)) {
      return NextResponse.json(
        { error: 'Training is only available to Quality department and Accountable Manager' },
        { status: 403 }
      )
    }
    const ownerId = (record as { userId: string }).userId
    if (ownerId !== user.id && !hasReviewerRole(roles) && !canSeeAmDashboard(roles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(record)
  } catch (error) {
    console.error('Error in GET /api/training/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch training record' },
      { status: 500 }
    )
  }
}

/** PATCH: Update training record. Only reviewers or AM (or owner for limited fields if we allow). */
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

    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    if (!canSeeTraining(roles, departmentId)) {
      return NextResponse.json(
        { error: 'Training is only available to Quality department and Accountable Manager' },
        { status: 403 }
      )
    }
    if (!canAddTraining(roles)) {
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors can update training records.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }
    if (body.name !== undefined) updates.name = String(body.name).trim()
    if (body.recordType !== undefined) updates.recordType = body.recordType === 'QUALIFICATION' ? 'QUALIFICATION' : 'TRAINING'
    if (body.type !== undefined) updates.recordType = body.type === 'QUALIFICATION' ? 'QUALIFICATION' : 'TRAINING'
    if (body.completedAt !== undefined) updates.completedAt = body.completedAt ? new Date(body.completedAt).toISOString() : null
    if (body.expiryDate !== undefined) updates.expiryDate = body.expiryDate ? new Date(body.expiryDate).toISOString() : null
    if (body.documentUrl !== undefined) updates.documentUrl = body.documentUrl ? String(body.documentUrl).trim() : null

    const { data: updated, error } = await supabase
      .from('TrainingRecord')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating training record:', error)
      return NextResponse.json(
        { error: error.message ?? 'Failed to update training record' },
        { status: 500 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error in PATCH /api/training/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to update training record' },
      { status: 500 }
    )
  }
}

/** DELETE: Remove training record. Only reviewers or AM. */
export async function DELETE(
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

    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    if (!canSeeTraining(roles, departmentId)) {
      return NextResponse.json(
        { error: 'Training is only available to Quality department and Accountable Manager' },
        { status: 403 }
      )
    }
    if (!canAddTraining(roles)) {
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors can delete training records.' },
        { status: 403 }
      )
    }

    const { error } = await supabase.from('TrainingRecord').delete().eq('id', id)

    if (error) {
      console.error('Error deleting training record:', error)
      return NextResponse.json(
        { error: error.message ?? 'Failed to delete training record' },
        { status: 500 }
      )
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error in DELETE /api/training/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to delete training record' },
      { status: 500 }
    )
  }
}
