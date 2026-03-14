import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

/** Notify auditors of the finding's audit that assignee submitted CAP or CAT for review. */
async function notifyAuditorsForFinding(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  payload: {
    auditId: string
    findingId: string
    findingNumber: string | null
    submittedByUserId: string
    kind: 'cap' | 'cat'
  }
) {
  const { auditId, findingId, findingNumber, submittedByUserId, kind } = payload
  const { data: auditors } = await supabase
    .from('AuditAuditor')
    .select('userId')
    .eq('auditId', auditId)
  const userIds = (auditors ?? [])
    .map((a) => (a as { userId: string }).userId)
    .filter((uid) => uid !== submittedByUserId)
  const ref = findingNumber || findingId
  const isCap = kind === 'cap'
  const title = isCap
    ? 'Corrective Action Plan submitted for review'
    : 'Corrective Action Taken submitted for review'
  const message = isCap
    ? `Finding ${ref}: Root cause & Corrective Action Plan have been submitted and are awaiting your review.`
    : `Finding ${ref}: Corrective Action Taken (and evidence) have been submitted and are awaiting your review.`
  const link = `/findings/${findingId}`
  for (const userId of userIds) {
    await supabase.from('Notification').insert({
      id: randomUUID(),
      userId,
      type: 'SYSTEM_ALERT',
      title,
      message,
      link,
      findingId,
    })
  }
}

/** PATCH: Only the person assigned to the finding can update CAP/CAT (RCA is on Finding; assignee-only edit is intentional). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: findingId } = await params
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: finding, error: findErr } = await supabase
      .from('Finding')
      .select('id, assignedToId, auditId, findingNumber, status, capDueDate, closeOutDueDate')
      .eq('id', findingId)
      .single()

    if (findErr || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    const assignedToId = (finding as { assignedToId: string }).assignedToId
    if (assignedToId !== user.id) {
      return NextResponse.json(
        { error: 'Only the person assigned to this finding can update RCA, CAP, or CAT' },
        { status: 403 }
      )
    }

    const body = await request.clone().json().catch(() => ({}))
    const actionPlan = typeof body.actionPlan === 'string' ? body.actionPlan.trim() : null
    const correctiveActionTaken = typeof body.correctiveActionTaken === 'string' ? body.correctiveActionTaken.trim() : null

    const { data: existingCa } = await supabase
      .from('CorrectiveAction')
      .select('id, actionPlan, dueDate, catDueDate, capStatus')
      .eq('findingId', findingId)
      .single()

    if (correctiveActionTaken !== null) {
      const capApproved = (existingCa as { capStatus?: string } | null)?.capStatus === 'APPROVED'
      if (!capApproved) {
        return NextResponse.json(
          { error: 'Corrective Action Plan must be approved before you can save Corrective Action Taken' },
          { status: 400 }
        )
      }
    }

    const capDueDate = (finding as { capDueDate?: string }).capDueDate
    const closeOutDueDate = (finding as { closeOutDueDate?: string }).closeOutDueDate
    const fallbackDue = capDueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    let caId: string

    if (existingCa) {
      caId = (existingCa as { id: string }).id
      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
      if (actionPlan !== null) {
        updates.actionPlan = actionPlan
        updates.capStatus = 'PENDING'
        updates.capRejectionReason = null
        updates.capEnteredAt = new Date().toISOString()
      }
      if (correctiveActionTaken !== null) {
        updates.correctiveActionTaken = correctiveActionTaken
        updates.catStatus = 'PENDING'
        updates.catRejectionReason = null
        updates.catEnteredAt = new Date().toISOString()
        if (closeOutDueDate) updates.catDueDate = closeOutDueDate
      }
      if (Object.keys(updates).length > 1) {
        const { error: updateErr } = await supabase
          .from('CorrectiveAction')
          .update(updates)
          .eq('id', caId)
        if (updateErr) {
          console.error('Error updating CorrectiveAction:', updateErr)
          return NextResponse.json({ error: 'Failed to update corrective action' }, { status: 500 })
        }
        // Move finding from OPEN to IN_PROGRESS when assignee submits CAP
        if (actionPlan !== null && (finding as { status?: string }).status === 'OPEN') {
          await supabase.from('Finding').update({ status: 'IN_PROGRESS', updatedAt: new Date().toISOString() }).eq('id', findingId)
        }
      }
    } else {
      if (actionPlan === null || actionPlan === '') {
        return NextResponse.json(
          { error: 'Action plan is required when creating corrective action' },
          { status: 400 }
        )
      }
      const now = new Date().toISOString()
      const { data: created, error: insertErr } = await supabase
        .from('CorrectiveAction')
        .insert({
          id: randomUUID(),
          findingId,
          responsibleId: assignedToId,
          actionPlan,
          dueDate: fallbackDue,
          updatedAt: now,
          capStatus: 'PENDING',
          capEnteredAt: now,
          ...(correctiveActionTaken !== null && correctiveActionTaken !== ''
            ? {
                correctiveActionTaken,
                catStatus: 'PENDING',
                catDueDate: closeOutDueDate || fallbackDue,
                catEnteredAt: now,
              }
            : {}),
        })
        .select('id')
        .single()
      if (insertErr || !created) {
        console.error('Error creating CorrectiveAction:', insertErr)
        return NextResponse.json({ error: 'Failed to create corrective action' }, { status: 500 })
      }
      caId = (created as { id: string }).id
      // Move finding from OPEN to IN_PROGRESS when assignee first submits CAP
      if ((finding as { status?: string }).status === 'OPEN') {
        await supabase.from('Finding').update({ status: 'IN_PROGRESS', updatedAt: new Date().toISOString() }).eq('id', findingId)
      }
    }

    const { data: updated } = await supabase
      .from('CorrectiveAction')
      .select('*')
      .eq('id', caId)
      .single()

    const auditId = (finding as { auditId?: string }).auditId
    const findingNumber = (finding as { findingNumber?: string }).findingNumber ?? null
    if (auditId) {
      if (actionPlan !== null) {
        await notifyAuditorsForFinding(supabase, {
          auditId,
          findingId,
          findingNumber,
          submittedByUserId: user.id,
          kind: 'cap',
        })
      }
      if (correctiveActionTaken !== null) {
        await notifyAuditorsForFinding(supabase, {
          auditId,
          findingId,
          findingNumber,
          submittedByUserId: user.id,
          kind: 'cat',
        })
      }
    }

    return NextResponse.json(updated ?? existingCa)
  } catch (error) {
    console.error('Error in PATCH /api/findings/[id]/corrective-action:', error)
    return NextResponse.json({ error: 'Failed to update corrective action' }, { status: 500 })
  }
}
