import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserRoles, isAccountableManager } from '@/lib/permissions'
import {
  auditTypeSkipsCapResourceAccountableManager,
  capRequiresAccountableManager,
} from '@/lib/cap-resources'

/** Accountable Manager approves or rejects CAP after Quality Manager approval when extra resources are required. */
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
    if (!isAccountableManager(roles)) {
      return NextResponse.json(
        { error: 'Only an Accountable Manager can review this step' },
        { status: 403 }
      )
    }

    const { id: findingId } = await params

    const body = await request.json()
    const approved = body.approved === true
    const rejectionReason =
      typeof body.rejectionReason === 'string' ? body.rejectionReason.trim() : null
    const signatureUrlRaw =
      typeof body.signatureUrl === 'string' ? body.signatureUrl.trim() : ''
    const signatureUrl = signatureUrlRaw.length > 0 ? signatureUrlRaw : null

    if (!approved && !rejectionReason) {
      return NextResponse.json(
        { error: 'Rejection reason is required when rejecting' },
        { status: 400 }
      )
    }

    const { data: ca, error: fetchError } = await supabase
      .from('CorrectiveAction')
      .select('id, capStatus, capResourceTypes, amCapStatus')
      .eq('findingId', findingId)
      .single()

    if (fetchError || !ca) {
      return NextResponse.json({ error: 'Corrective action not found for this finding' }, { status: 404 })
    }

    const { data: findingAuditRow } = await supabase
      .from('Finding')
      .select('auditId')
      .eq('id', findingId)
      .single()
    const amAuditId = (findingAuditRow as { auditId?: string } | null)?.auditId
    let amAuditType: string | null = null
    if (amAuditId) {
      const { data: amAudit } = await supabase.from('Audit').select('type').eq('id', amAuditId).single()
      amAuditType = (amAudit as { type?: string } | null)?.type ?? null
    }
    if (auditTypeSkipsCapResourceAccountableManager(amAuditType)) {
      return NextResponse.json(
        { error: 'Accountable Manager resource approval does not apply to this audit type' },
        { status: 400 }
      )
    }

    const caRow = ca as {
      id: string
      capStatus?: string
      capResourceTypes?: string[] | null
      amCapStatus?: string | null
    }

    if (caRow.capStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'The Corrective Action Plan must be approved by Quality before Accountable Manager review' },
        { status: 400 }
      )
    }

    if (!capRequiresAccountableManager(caRow.capResourceTypes ?? null)) {
      return NextResponse.json(
        { error: 'Accountable Manager approval is not required for this CAP' },
        { status: 400 }
      )
    }

    if (caRow.amCapStatus !== 'PENDING') {
      return NextResponse.json(
        { error: 'This CAP is not awaiting Accountable Manager approval' },
        { status: 400 }
      )
    }

    if (approved && !signatureUrl) {
      return NextResponse.json(
        { error: 'Electronic signature file is required before approving a CAP that needs resources' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    const updatePayload: Record<string, unknown> = { updatedAt: now }

    if (approved) {
      updatePayload.amCapStatus = 'APPROVED'
      updatePayload.amCapReviewedById = user.id
      updatePayload.amCapReviewedAt = now
      updatePayload.amCapRejectionReason = null
      updatePayload.amCapSignatureUrl = signatureUrl
    } else {
      updatePayload.amCapStatus = 'REJECTED'
      updatePayload.amCapReviewedById = user.id
      updatePayload.amCapReviewedAt = now
      updatePayload.amCapRejectionReason = rejectionReason
      updatePayload.amCapSignatureUrl = null
      updatePayload.capStatus = 'REJECTED'
      updatePayload.capRejectionReason = rejectionReason
      updatePayload.capReviewedAt = now
      updatePayload.capReviewedById = user.id
    }

    const { data: updated, error } = await supabase
      .from('CorrectiveAction')
      .update(updatePayload)
      .eq('id', caRow.id)
      .select('*')
      .single()

    if (error || !updated) {
      console.error('Error updating AM CAP review:', error)
      return NextResponse.json(
        { error: error?.message ?? 'Failed to update review' },
        { status: 500 }
      )
    }

    const { data: findingForNotify } = await supabase
      .from('Finding')
      .select('findingNumber, assignedToId')
      .eq('id', findingId)
      .single()
    const assignedToId = (findingForNotify as { assignedToId?: string })?.assignedToId
    const findingNumber =
      (findingForNotify as { findingNumber?: string })?.findingNumber ?? findingId

    if (assignedToId) {
      await supabase.from('Notification').insert({
        id: randomUUID(),
        userId: assignedToId,
        type: 'SYSTEM_ALERT',
        title: approved ? 'CAP approved by Accountable Manager' : 'CAP rejected by Accountable Manager',
        message: approved
          ? `Your Corrective Action Plan for finding ${findingNumber} was approved by the Accountable Manager. You may enter Corrective Action Taken.`
          : `Your Corrective Action Plan for finding ${findingNumber} was rejected by the Accountable Manager. Please review the feedback and resubmit.`,
        link: `/findings/${findingId}`,
        findingId,
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error in am-cap-review:', error)
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
  }
}
