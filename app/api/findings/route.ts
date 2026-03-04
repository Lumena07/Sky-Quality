import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { generateFindingNumber } from '@/lib/utils'
import { createActivityLog } from '@/lib/activity-log'
import { calculateDeadlines } from '@/lib/audit-deadlines'
import { getCurrentUserProfile, isNormalUser } from '@/lib/permissions'

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const departmentId = searchParams.get('departmentId')
    const overdue = searchParams.get('overdue')

    let query = supabase
      .from('Finding')
      .select(
        `
        *,
        Audit:auditId(*),
        Department:departmentId(*),
        AssignedTo:assignedToId(*),
        CorrectiveAction(
          *,
          Responsible:responsibleId(*)
        )
      `
      )
      .order('createdAt', { ascending: false })

    if (isNormalUser(roles)) {
      query = query.eq('assignedToId', user.id)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (departmentId) {
      query = query.eq('departmentId', departmentId)
    }
    if (overdue === 'true') {
      query = query
        .lt('dueDate', new Date().toISOString())
        .neq('status', 'CLOSED')
    }

    const { data: findings, error } = await query

    if (error) {
      console.error('Error fetching findings from Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to fetch findings' },
        { status: 500 }
      )
    }

    return NextResponse.json(findings ?? [])
  } catch (error) {
    console.error('Error fetching findings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch findings' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
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
      auditId,
      departmentId,
      policyReference,
      description,
      rootCause,
      severity,
      priority,
      checklistItemId,
      assignedToId,
      dueDate,
      actionPlan,
    } = body

    const { data: audit, error: auditError } = await supabase
      .from('Audit')
      .select('*')
      .eq('id', auditId)
      .single()

    if (auditError || !audit) {
      return NextResponse.json(
        { error: 'Audit not found' },
        { status: 404 }
      )
    }

    let capDueDate: string | null = null
    let closeOutDueDate: string | null = null
    const auditReportDate = audit.updatedAt || audit.createdAt

    if (priority) {
      const deadlines = calculateDeadlines(auditReportDate, priority as 'P1' | 'P2' | 'P3')
      capDueDate = deadlines.capDueDate.toISOString()
      closeOutDueDate = deadlines.closeOutDueDate.toISOString()
    }

    const fallbackCapDueDate =
      capDueDate ??
      (dueDate
        ? new Date(dueDate).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())

    const now = new Date().toISOString()
    const { data: finding, error: findingError } = await supabase
      .from('Finding')
      .insert({
        id: randomUUID(),
        findingNumber: generateFindingNumber(),
        auditId,
        departmentId,
        policyReference,
        description,
        rootCause,
        severity,
        priority: priority || null,
        checklistItemId: checklistItemId || null,
        assignedToId,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        capDueDate,
        closeOutDueDate,
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
          dueDate: fallbackCapDueDate,
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

    const { error: notificationError } = await supabase.from('Notification').insert({
      id: randomUUID(),
      userId: assignedToId,
      type: 'FINDING_ASSIGNED',
      title: 'New Finding Assigned',
      message: `You have been assigned a new finding: ${finding.findingNumber}`,
      link: `/findings/${finding.id}`,
      findingId: finding.id,
    })

    if (notificationError) {
      console.error('Error creating finding notification in Supabase:', notificationError)
    }

    await createActivityLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Finding',
      entityId: finding.id,
      details: `Created finding: ${finding.findingNumber}`,
      findingId: finding.id,
      auditId: finding.auditId,
    })

    return NextResponse.json(finding, { status: 201 })
  } catch (error) {
    console.error('Error creating finding:', error)
    return NextResponse.json(
      { error: 'Failed to create finding' },
      { status: 500 }
    )
  }
}
