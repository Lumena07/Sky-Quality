import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserRoles, canReviewFinding, canReviewFindingForAudit } from '@/lib/permissions'
import { capRequiresAccountableManager } from '@/lib/cap-resources'

/** Approve or reject Corrective Action Plan (CAP). Rejection sends back to responsible person. */
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
        { error: 'Only auditors or quality managers can review CAP' },
        { status: 403 }
      )
    }

    const { id: findingId } = await params

    const { data: findingRow, error: findingErr } = await supabase
      .from('Finding')
      .select('auditId')
      .eq('id', findingId)
      .single()
    if (findingErr || !findingRow) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }
    const auditId = (findingRow as { auditId: string }).auditId
    const canReview = await canReviewFindingForAudit(supabase, user.id, auditId, roles)
    if (!canReview) {
      return NextResponse.json(
        { error: 'Only auditors assigned to this audit or Quality Manager can review CAP' },
        { status: 403 }
      )
    }

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
      .select('id, capResourceTypes')
      .eq('findingId', findingId)
      .single()

    if (fetchError || !ca) {
      return NextResponse.json(
        { error: 'Corrective action plan not found for this finding' },
        { status: 404 }
      )
    }

    const resourceTypes = (ca as { capResourceTypes?: string[] | null }).capResourceTypes ?? []
    const needsAm = approved && capRequiresAccountableManager(resourceTypes)

    const now = new Date().toISOString()
    const status = approved ? 'APPROVED' : 'REJECTED'
    const updatePayload: Record<string, unknown> = {
      capStatus: status,
      capReviewedById: user.id,
      capReviewedAt: now,
      capRejectionReason: approved ? null : rejectionReason,
      updatedAt: now,
    }
    if (approved && needsAm) {
      updatePayload.amCapStatus = 'PENDING'
    } else if (approved && !needsAm) {
      updatePayload.amCapStatus = 'NOT_REQUIRED'
      updatePayload.amCapReviewedById = null
      updatePayload.amCapReviewedAt = null
      updatePayload.amCapRejectionReason = null
    } else if (!approved) {
      updatePayload.amCapStatus = 'NOT_REQUIRED'
      updatePayload.amCapReviewedById = null
      updatePayload.amCapReviewedAt = null
      updatePayload.amCapRejectionReason = null
    }

    const { data: updated, error } = await supabase
      .from('CorrectiveAction')
      .update(updatePayload)
      .eq('id', ca.id)
      .select('*')
      .single()

    if (error || !updated) {
      console.error('Error updating CAP review:', error)
      return NextResponse.json(
        { error: error?.message ?? 'Failed to update CAP review' },
        { status: 500 }
      )
    }

    const { data: findingForNotify } = await supabase
      .from('Finding')
      .select('id, findingNumber, assignedToId')
      .eq('id', findingId)
      .single()
    const assignedToId = findingForNotify && (findingForNotify as { assignedToId?: string }).assignedToId
    const findingNumber = (findingForNotify as { findingNumber?: string })?.findingNumber ?? findingId
    if (assignedToId) {
      if (approved) {
        const message = needsAm
          ? `Your Corrective Action Plan for finding ${findingNumber} was approved by Quality. It is pending Accountable Manager approval (resources) before you can enter Corrective Action Taken.`
          : `Your Corrective Action Plan for finding ${findingNumber} has been approved. You can now enter Corrective Action Taken and upload evidence.`
        await supabase.from('Notification').insert({
          id: randomUUID(),
          userId: assignedToId,
          type: 'SYSTEM_ALERT',
          title: 'Corrective Action Plan approved',
          message,
          link: `/findings/${findingId}`,
          findingId,
        })
      } else {
        await supabase.from('Notification').insert({
          id: randomUUID(),
          userId: assignedToId,
          type: 'SYSTEM_ALERT',
          title: 'Corrective Action Plan rejected',
          message: `Your Corrective Action Plan for finding ${findingNumber} has been rejected. Please review the feedback and resubmit.`,
          link: `/findings/${findingId}`,
          findingId,
        })
      }
    }

    if (needsAm) {
      const { data: amUsers } = await supabase
        .from('User')
        .select('id')
        .eq('isActive', true)
        .contains('roles', ['ACCOUNTABLE_MANAGER'])
      for (const row of amUsers ?? []) {
        const amId = (row as { id: string }).id
        if (!amId) continue
        await supabase.from('Notification').insert({
          id: randomUUID(),
          userId: amId,
          type: 'SYSTEM_ALERT',
          title: 'CAP pending Accountable Manager approval',
          message: `Finding ${findingNumber}: Corrective Action Plan was approved by Quality and requires your approval (resources).`,
          link: `/findings/${findingId}`,
          findingId,
        })
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error in cap-review:', error)
    return NextResponse.json(
      { error: 'Failed to update CAP review' },
      { status: 500 }
    )
  }
}
