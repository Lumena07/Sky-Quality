import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserRoles, canReviewFinding } from '@/lib/permissions'

/** Approve or reject Corrective Action Taken (CAT). Rejection sends back to responsible person. */
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
        { error: 'Only auditors, quality managers, and system admins can review CAT' },
        { status: 403 }
      )
    }

    const { id: findingId } = await params
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

    const { data: ca, error: fetchError } = await supabase
      .from('CorrectiveAction')
      .select('id')
      .eq('findingId', findingId)
      .single()

    if (fetchError || !ca) {
      return NextResponse.json(
        { error: 'Corrective action not found for this finding' },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()
    const status = approved ? 'APPROVED' : 'REJECTED'
    const { data: updated, error } = await supabase
      .from('CorrectiveAction')
      .update({
        catStatus: status,
        catReviewedById: user.id,
        catReviewedAt: now,
        catRejectionReason: approved ? null : rejectionReason,
        updatedAt: now,
      })
      .eq('id', ca.id)
      .select('*')
      .single()

    if (error || !updated) {
      console.error('Error updating CAT review:', error)
      return NextResponse.json(
        { error: error?.message ?? 'Failed to update CAT review' },
        { status: 500 }
      )
    }

    const { data: findingRow } = await supabase
      .from('Finding')
      .select('findingNumber, assignedToId')
      .eq('id', findingId)
      .single()
    const assignedToId = findingRow && (findingRow as { assignedToId?: string }).assignedToId
    const findingNumber = (findingRow as { findingNumber?: string })?.findingNumber ?? findingId

    if (assignedToId) {
      if (approved) {
        await supabase.from('Notification').insert({
          id: randomUUID(),
          userId: assignedToId,
          type: 'SYSTEM_ALERT',
          title: 'Corrective Action Taken approved',
          message: `Your Corrective Action Taken for finding ${findingNumber} has been approved. This finding is now closed.`,
          link: `/findings/${findingId}`,
          findingId,
        })
      } else {
        await supabase.from('Notification').insert({
          id: randomUUID(),
          userId: assignedToId,
          type: 'SYSTEM_ALERT',
          title: 'Corrective Action Taken rejected',
          message: `Your Corrective Action Taken for finding ${findingNumber} has been rejected. Please review the feedback and resubmit.`,
          link: `/findings/${findingId}`,
          findingId,
        })
      }
    }

    if (approved) {
      await supabase
        .from('Finding')
        .update({ status: 'CLOSED', updatedAt: now })
        .eq('id', findingId)
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error in cat-review:', error)
    return NextResponse.json(
      { error: 'Failed to update CAT review' },
      { status: 500 }
    )
  }
}
