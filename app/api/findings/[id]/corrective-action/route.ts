import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import {
  auditTypeSkipsCapResourceAccountableManager,
  capRequiresAccountableManager,
  normalizeCapResourceTypes,
  validateCapResourceTypes,
} from '@/lib/cap-resources'
import { isObservationPriority } from '@/lib/audit-deadlines'

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
      .select('id, assignedToId, auditId, findingNumber, status, capDueDate, closeOutDueDate, priority')
      .eq('id', findingId)
      .single()

    if (findErr || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    const auditIdForFinding = (finding as { auditId?: string }).auditId
    let auditType: string | null = null
    if (auditIdForFinding) {
      const { data: auditRow } = await supabase
        .from('Audit')
        .select('type')
        .eq('id', auditIdForFinding)
        .single()
      auditType = (auditRow as { type?: string } | null)?.type ?? null
    }
    const skipAmCapResources = auditTypeSkipsCapResourceAccountableManager(auditType)

    if (isObservationPriority((finding as { priority?: string | null }).priority)) {
      return NextResponse.json(
        {
          error:
            'This finding is an observation. It does not use CAP/CAT in the system — use Close observation instead.',
        },
        { status: 400 }
      )
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
    const proposedCatDueDateInput =
      typeof body.proposedCatDueDate === 'string' ? body.proposedCatDueDate.trim() : ''
    const proposedCatDueDateReasonInput =
      typeof body.proposedCatDueDateReason === 'string' ? body.proposedCatDueDateReason.trim() : ''

    const { data: existingCa } = await supabase
      .from('CorrectiveAction')
      .select('id, actionPlan, dueDate, catDueDate, capStatus, capResourceTypes, amCapStatus')
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
      const caRow = existingCa as {
        capResourceTypes?: string[] | null
        amCapStatus?: string | null
      } | null
      if (
        !skipAmCapResources &&
        capRequiresAccountableManager(caRow?.capResourceTypes ?? null)
      ) {
        if (caRow?.amCapStatus !== 'APPROVED') {
          return NextResponse.json(
            {
              error:
                'Accountable Manager must approve this CAP (resources required) before you can submit Corrective Action Taken.',
            },
            { status: 400 }
          )
        }
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
        let resourceTypes =
          body.capResourceTypes !== undefined
            ? normalizeCapResourceTypes(body.capResourceTypes)
            : normalizeCapResourceTypes((existingCa as { capResourceTypes?: string[] }).capResourceTypes)
        if (resourceTypes.length === 0) resourceTypes = ['NONE']
        if (skipAmCapResources) {
          resourceTypes = ['NONE']
        }
        const val = validateCapResourceTypes(resourceTypes)
        if (!val.ok) {
          return NextResponse.json({ error: val.error }, { status: 400 })
        }
        updates.actionPlan = actionPlan
        updates.capStatus = 'PENDING'
        updates.capRejectionReason = null
        updates.capEnteredAt = new Date().toISOString()
        updates.capResourceTypes = resourceTypes
        updates.amCapStatus = 'NOT_REQUIRED'
        updates.amCapReviewedById = null
        updates.amCapReviewedAt = null
        updates.amCapRejectionReason = null
        if (proposedCatDueDateInput) {
          updates.proposedCatDueDate = new Date(proposedCatDueDateInput).toISOString()
          updates.proposedCatDueDateReason = proposedCatDueDateReasonInput || null
          updates.catDueDateProposalStatus = 'PENDING'
          updates.catDueDateReviewedById = null
          updates.catDueDateReviewedAt = null
          updates.catDueDateRejectionReason = null
        } else {
          updates.proposedCatDueDate = null
          updates.proposedCatDueDateReason = null
          updates.catDueDateProposalStatus = 'NOT_REQUESTED'
          updates.catDueDateReviewedById = null
          updates.catDueDateReviewedAt = null
          updates.catDueDateRejectionReason = null
        }
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
      let resourceTypes =
        body.capResourceTypes !== undefined
          ? normalizeCapResourceTypes(body.capResourceTypes)
          : ['NONE']
      if (resourceTypes.length === 0) resourceTypes = ['NONE']
      if (skipAmCapResources) {
        resourceTypes = ['NONE']
      }
      const val = validateCapResourceTypes(resourceTypes)
      if (!val.ok) {
        return NextResponse.json({ error: val.error }, { status: 400 })
      }
      if (
        correctiveActionTaken !== null &&
        correctiveActionTaken !== '' &&
        !skipAmCapResources &&
        capRequiresAccountableManager(resourceTypes)
      ) {
        return NextResponse.json(
          {
            error:
              'Submit your Corrective Action Plan first. After Quality Manager and Accountable Manager approve, you can submit Corrective Action Taken.',
          },
          { status: 400 }
        )
      }
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
          capResourceTypes: resourceTypes,
          amCapStatus: 'NOT_REQUIRED',
          proposedCatDueDate: proposedCatDueDateInput
            ? new Date(proposedCatDueDateInput).toISOString()
            : null,
          proposedCatDueDateReason: proposedCatDueDateInput
            ? proposedCatDueDateReasonInput || null
            : null,
          catDueDateProposalStatus: proposedCatDueDateInput ? 'PENDING' : 'NOT_REQUESTED',
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

    if (actionPlan !== null && proposedCatDueDateInput) {
      const { data: qmUsers } = await supabase
        .from('User')
        .select('id')
        .eq('isActive', true)
        .contains('roles', ['QUALITY_MANAGER'])
      for (const row of qmUsers ?? []) {
        const uid = (row as { id: string }).id
        if (!uid || uid === user.id) continue
        await supabase.from('Notification').insert({
          id: randomUUID(),
          userId: uid,
          type: 'SYSTEM_ALERT',
          title: 'Longer CAT due date proposal submitted',
          message: `Finding ${findingNumber ?? findingId}: a longer CAT due date was proposed during CAP entry and needs Quality Manager review.`,
          link: `/findings/${findingId}`,
          findingId,
        })
      }
    }

    return NextResponse.json(updated ?? existingCa)
  } catch (error) {
    console.error('Error in PATCH /api/findings/[id]/corrective-action:', error)
    return NextResponse.json({ error: 'Failed to update corrective action' }, { status: 500 })
  }
}
