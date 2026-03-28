import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { generateFindingNumber } from '@/lib/utils'
import { calculateDeadlines, isObservationPriority } from '@/lib/audit-deadlines'
import { createActivityLog } from '@/lib/activity-log'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
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

    const { getCurrentUserProfile, canEditAudit } = await import('@/lib/permissions')
    const { roles } = await getCurrentUserProfile(supabase, user.id)
    const { data: auditorRows } = await supabase
      .from('AuditAuditor')
      .select('userId')
      .eq('auditId', params.id)
    const auditorIds = (auditorRows ?? []).map((r: { userId: string }) => r.userId)
    const { data: auditeeRows } = await supabase
      .from('AuditAuditee')
      .select('userId')
      .eq('auditId', params.id)
    const auditeeIds = (auditeeRows ?? [])
      .map((r: { userId: string | null }) => r.userId)
      .filter(Boolean) as string[]
    if (!canEditAudit(roles, user.id, auditorIds, auditeeIds)) {
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors assigned to this audit can create findings' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      checklistItemId,
      departmentId,
      description,
      priority,
      assignedToId,
      rootCause,
      actionPlan,
      classificationId,
    } = body

    if (!checklistItemId || !departmentId || !description || !priority || !assignedToId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const priorityNorm = String(priority).toUpperCase()
    if (!['P1', 'P2', 'P3', 'OBSERVATION'].includes(priorityNorm)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
    }

    const { data: audit, error: auditError } = await supabase
      .from('Audit')
      .select('*')
      .eq('id', params.id)
      .single()

    if (auditError || !audit) {
      return NextResponse.json(
        { error: 'Audit not found' },
        { status: 404 }
      )
    }

    const { data: checklistItem } = await supabase
      .from('ChecklistItem')
      .select('*')
      .eq('id', checklistItemId)
      .single()

    const auditReportDate = audit.updatedAt || audit.createdAt
    const isObs = isObservationPriority(priorityNorm)
    const deadlines = isObs
      ? null
      : calculateDeadlines(auditReportDate, priorityNorm as 'P1' | 'P2' | 'P3')

    const now = new Date().toISOString()
    const { data: finding, error: findingError } = await supabase
      .from('Finding')
      .insert({
        id: randomUUID(),
        findingNumber: generateFindingNumber(),
        auditId: params.id,
        departmentId,
        policyReference: checklistItem?.ref || checklistItem?.auditQuestion || 'N/A',
        description,
        rootCause: isObs ? null : rootCause || null,
        severity: isObs
          ? 'Observation'
          : priorityNorm === 'P1'
            ? 'Critical'
            : priorityNorm === 'P2'
              ? 'Major'
              : 'Minor',
        priority: priorityNorm,
        checklistItemId,
        assignedToId,
        classificationId: classificationId || null,
        capDueDate: deadlines ? deadlines.capDueDate.toISOString() : null,
        closeOutDueDate: deadlines ? deadlines.closeOutDueDate.toISOString() : null,
        ...(isObs ? { dueDate: null } : {}),
        status: 'OPEN',
        createdById: user.id,
        updatedAt: now,
      })
      .select('*')
      .single()

    if (findingError || !finding) {
      console.error('Error creating finding in Supabase:', findingError)
      return NextResponse.json(
        { error: 'Failed to create finding' },
        { status: 500 }
      )
    }

    if (!isObs && actionPlan && deadlines) {
      const { data: correctiveAction, error: caError } = await supabase
        .from('CorrectiveAction')
        .insert({
          findingId: finding.id,
          actionPlan,
          responsibleId: assignedToId,
          dueDate: deadlines.capDueDate.toISOString(),
          status: 'IN_PROGRESS',
        })
        .select('*')
        .single()

      if (!caError && correctiveAction) {
        await supabase
          .from('Finding')
          .update({ correctiveActionId: correctiveAction.id })
          .eq('id', finding.id)
      }
    }

    const notificationPayload = {
      id: randomUUID(),
      userId: assignedToId,
      type: 'FINDING_ASSIGNED',
      title: 'New Finding Assigned',
      message: `You have been assigned a new finding: ${finding.findingNumber}`,
      link: `/findings/${finding.id}`,
      findingId: finding.id,
    }

    const { error: notificationError } = await supabase
      .from('Notification')
      .insert(notificationPayload)

    if (notificationError) {
      console.error('Error creating finding notification in Supabase:', notificationError)
    }

    await createActivityLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Finding',
      entityId: finding.id,
      details: `Created finding from checklist item: ${finding.findingNumber}`,
      auditId: params.id,
      findingId: finding.id,
    })

    return NextResponse.json(finding, { status: 201 })
  } catch (error) {
    console.error('Error creating finding from checklist:', error)
    return NextResponse.json(
      { error: 'Failed to create finding' },
      { status: 500 }
    )
  }
}
