import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserRoles, isQualityManager } from '@/lib/permissions'

/** Quality Manager approves/rejects upfront longer CAT due date proposed during CAP entry. */
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
    if (!isQualityManager(roles)) {
      return NextResponse.json(
        { error: 'Only Quality Manager can review longer CAT due date proposals' },
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
      .select('id, proposedCatDueDate, catDueDateProposalStatus')
      .eq('findingId', findingId)
      .single()

    if (fetchError || !ca) {
      return NextResponse.json({ error: 'Corrective action not found for this finding' }, { status: 404 })
    }

    const caRow = ca as {
      id: string
      proposedCatDueDate?: string | null
      catDueDateProposalStatus?: string | null
    }

    if (!caRow.proposedCatDueDate) {
      return NextResponse.json({ error: 'No longer CAT due date proposal found for this finding' }, { status: 400 })
    }
    if (caRow.catDueDateProposalStatus !== 'PENDING') {
      return NextResponse.json({ error: 'This proposal is not pending review' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const updatePayload: Record<string, unknown> = {
      catDueDateProposalStatus: approved ? 'APPROVED' : 'REJECTED',
      catDueDateReviewedById: user.id,
      catDueDateReviewedAt: now,
      catDueDateRejectionReason: approved ? null : rejectionReason,
      updatedAt: now,
    }
    if (approved) {
      updatePayload.catDueDate = caRow.proposedCatDueDate
    }

    const { data: updated, error: updateErr } = await supabase
      .from('CorrectiveAction')
      .update(updatePayload)
      .eq('id', caRow.id)
      .select('*')
      .single()

    if (updateErr || !updated) {
      return NextResponse.json({ error: 'Failed to update proposal review' }, { status: 500 })
    }

    if (approved) {
      await supabase
        .from('Finding')
        .update({ closeOutDueDate: caRow.proposedCatDueDate, updatedAt: now })
        .eq('id', findingId)
    }

    const { data: finding } = await supabase
      .from('Finding')
      .select('findingNumber, assignedToId')
      .eq('id', findingId)
      .single()
    const assignedToId = (finding as { assignedToId?: string })?.assignedToId
    const findingNumber = (finding as { findingNumber?: string })?.findingNumber ?? findingId

    if (assignedToId) {
      await supabase.from('Notification').insert({
        id: randomUUID(),
        userId: assignedToId,
        type: 'SYSTEM_ALERT',
        title: approved ? 'Longer CAT due date approved' : 'Longer CAT due date rejected',
        message: approved
          ? `Your proposed longer CAT due date for finding ${findingNumber} has been approved.`
          : `Your proposed longer CAT due date for finding ${findingNumber} has been rejected. Please review feedback.`,
        link: `/findings/${findingId}`,
        findingId,
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error in cat-due-proposal-review PATCH:', error)
    return NextResponse.json({ error: 'Failed to review proposal' }, { status: 500 })
  }
}
