import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'
import { getCurrentUserProfile, isQualityManager } from '@/lib/permissions'

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

    const reqRow = extRequest as {
      requestedCapDueDate: string | null
      requestedCloseOutDueDate: string | null
    }
    const involvesCapPart = Boolean(reqRow.requestedCapDueDate)
    const involvesCatPart = Boolean(reqRow.requestedCloseOutDueDate)

    if (!involvesCapPart && !involvesCatPart) {
      return NextResponse.json(
        { error: 'Extension request has no requested dates to review' },
        { status: 400 }
      )
    }

    if (!isQualityManager(roles)) {
      return NextResponse.json(
        {
          error:
            'Only a Quality Manager can approve or reject CAT extension requests',
        },
        { status: 403 }
      )
    }
    if (involvesCapPart) {
      return NextResponse.json(
        {
          error:
            'This endpoint reviews CAT extension requests only. CAP due-date changes are handled in CAP flows.',
        },
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
        if (ca) {
          const caUpdates: Record<string, unknown> = { updatedAt: now }
          if (req.requestedCapDueDate) {
            caUpdates.dueDate = new Date(req.requestedCapDueDate + 'T23:59:59Z').toISOString()
          }
          if (req.requestedCloseOutDueDate) {
            caUpdates.catDueDate = new Date(req.requestedCloseOutDueDate + 'T23:59:59Z').toISOString()
          }
          if (Object.keys(caUpdates).length > 1) {
            await supabase.from('CorrectiveAction').update(caUpdates).eq('findingId', findingId)
          }
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
