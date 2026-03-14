import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'
import { getCurrentUserProfile, canReviewFinding, canReviewFindingForAudit } from '@/lib/permissions'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id: findingId, requestId } = await params
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!canReviewFinding(roles)) {
      return NextResponse.json(
        { error: 'Only reviewers can approve or reject extension requests' },
        { status: 403 }
      )
    }

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
        { error: 'Only auditors assigned to this audit or Quality Manager can approve or reject extension requests' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { status, reviewNotes } = body

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be APPROVED or REJECTED' },
        { status: 400 }
      )
    }

    const { data: extRequest, error: fetchError } = await supabase
      .from('FindingExtensionRequest')
      .select('*')
      .eq('id', requestId)
      .eq('findingId', findingId)
      .single()

    if (fetchError || !extRequest) {
      return NextResponse.json(
        { error: 'Extension request not found' },
        { status: 404 }
      )
    }

    if ((extRequest as { status: string }).status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Extension request has already been reviewed' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('FindingExtensionRequest')
      .update({
        status,
        reviewedById: user.id,
        reviewedAt: now,
        reviewNotes: reviewNotes ?? null,
      })
      .eq('id', requestId)
      .eq('findingId', findingId)
      .select('*')
      .single()

    if (updateError || !updated) {
      console.error('Error updating extension request:', updateError)
      return NextResponse.json(
        { error: 'Failed to update extension request' },
        { status: 500 }
      )
    }

    if (status === 'APPROVED') {
      const req = extRequest as {
        requestedCapDueDate: string | null
        requestedCloseOutDueDate: string | null
      }
      const findingUpdate: Record<string, unknown> = { updatedAt: now }
      if (req.requestedCapDueDate) {
        findingUpdate.capDueDate = new Date(req.requestedCapDueDate + 'T23:59:59Z').toISOString()
      }
      if (req.requestedCloseOutDueDate) {
        findingUpdate.closeOutDueDate = new Date(req.requestedCloseOutDueDate + 'T23:59:59Z').toISOString()
      }
      if (Object.keys(findingUpdate).length > 1) {
        await supabase
          .from('Finding')
          .update(findingUpdate)
          .eq('id', findingId)

        const { data: ca } = await supabase
          .from('CorrectiveAction')
          .select('id')
          .eq('findingId', findingId)
          .single()
        if (ca && req.requestedCapDueDate) {
          await supabase
            .from('CorrectiveAction')
            .update({
              dueDate: new Date(req.requestedCapDueDate + 'T23:59:59Z').toISOString(),
              updatedAt: now,
            })
            .eq('findingId', findingId)
        }
      }

      const { data: finding } = await supabase
        .from('Finding')
        .select('findingNumber, assignedToId')
        .eq('id', findingId)
        .single()
      const assignedToId = finding?.assignedToId
      if (assignedToId) {
        await supabase.from('Notification').insert({
          id: randomUUID(),
          userId: assignedToId,
          type: 'SYSTEM_ALERT',
          title: 'Extension approved',
          message: `Your extension request for finding ${(finding as { findingNumber?: string })?.findingNumber ?? findingId} has been approved.`,
          link: `/findings/${findingId}`,
          findingId,
        })
      }
    }

    await createActivityLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'FindingExtensionRequest',
      entityId: requestId,
      details: `Extension request ${status.toLowerCase()}: ${findingId}`,
      findingId,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error in extension-request PATCH:', error)
    return NextResponse.json(
      { error: 'Failed to update extension request' },
      { status: 500 }
    )
  }
}
