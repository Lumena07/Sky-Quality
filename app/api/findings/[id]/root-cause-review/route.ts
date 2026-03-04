import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserRoles, canReviewFinding } from '@/lib/permissions'

/** Approve or reject Root Cause. Rejection sends back to responsible person with reason. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

    const roles = await getCurrentUserRoles(supabase, user.id)
    if (!canReviewFinding(roles)) {
      return NextResponse.json(
        { error: 'Only auditors, quality managers, and system admins can review root cause' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const approved = body.approved === true
    const rejectionReason =
      typeof body.rejectionReason === 'string' ? body.rejectionReason.trim() : null

    if (!approved && !rejectionReason) {
      return NextResponse.json(
        { error: 'Rejection reason is required when rejecting' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const status = approved ? 'APPROVED' : 'REJECTED'
    const { data: updated, error } = await supabase
      .from('Finding')
      .update({
        rootCauseStatus: status,
        rootCauseReviewedById: user.id,
        rootCauseReviewedAt: now,
        rootCauseRejectionReason: approved ? null : rejectionReason,
        updatedAt: now,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error || !updated) {
      console.error('Error updating root cause review:', error)
      return NextResponse.json(
        { error: error?.message ?? 'Failed to update root cause review' },
        { status: 500 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error in root-cause-review:', error)
    return NextResponse.json(
      { error: 'Failed to update root cause review' },
      { status: 500 }
    )
  }
}
