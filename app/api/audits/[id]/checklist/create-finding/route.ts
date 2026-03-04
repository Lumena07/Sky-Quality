import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { generateFindingNumber } from '@/lib/utils'
import { calculateDeadlines } from '@/lib/audit-deadlines'
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

    const { getCurrentUserRoles, canCreateFinding } = await import('@/lib/permissions')
    const roles = await getCurrentUserRoles(supabase, user.id)
    if (!canCreateFinding(roles)) {
      return NextResponse.json(
        { error: 'Only auditors, quality managers, and system admins can create findings' },
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
    } = body

    if (!checklistItemId || !departmentId || !description || !priority || !assignedToId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
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
    const deadlines = calculateDeadlines(auditReportDate, priority as 'P1' | 'P2' | 'P3')

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
        rootCause: rootCause || null,
        severity: priority === 'P1' ? 'Critical' : priority === 'P2' ? 'Major' : 'Minor',
        priority,
        checklistItemId,
        assignedToId,
        capDueDate: deadlines.capDueDate.toISOString(),
        closeOutDueDate: deadlines.closeOutDueDate.toISOString(),
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

    if (actionPlan) {
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
