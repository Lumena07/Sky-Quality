import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, canViewAuditPlan, canManageAuditPlan } from '@/lib/permissions'

/** Add months to a date (date-only string YYYY-MM-DD); returns YYYY-MM-DD. */
function addMonthsToDate(dateStr: string | null | undefined, months: number): string | null {
  if (!dateStr || typeof months !== 'number' || months < 1) return null
  const d = new Date(dateStr + 'T12:00:00Z')
  if (Number.isNaN(d.getTime())) return null
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

export async function GET(
  _request: Request,
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

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!canViewAuditPlan(roles)) {
      return NextResponse.json(
        { error: 'Only Quality Manager, auditors, or Accountable Manager can view audit plans.' },
        { status: 403 }
      )
    }

    const { data: plan, error } = await supabase
      .from('AuditPlan')
      .select(
        `
        *,
        Department:departmentId(id, name, code)
      `
      )
      .eq('id', params.id)
      .single()

    if (error || !plan) {
      return NextResponse.json({ error: 'Audit plan not found' }, { status: 404 })
    }

    const lastDoneStr = (plan as { lastDoneDate?: string | null }).lastDoneDate
      ? String((plan as { lastDoneDate: string }).lastDoneDate).slice(0, 10)
      : null
    const nextDueDate = addMonthsToDate(lastDoneStr, (plan as { intervalMonths: number }).intervalMonths)

    const { data: linkedAudits } = await supabase
      .from('Audit')
      .select('id, title, startDate, scheduledDate, status')
      .eq('auditPlanId', params.id)
      .in('status', ['PLANNED', 'ACTIVE'])
      .limit(1)

    const linked = linkedAudits?.[0]
      ? {
          id: (linkedAudits[0] as { id: string }).id,
          title: (linkedAudits[0] as { title: string }).title,
          scheduledDate: (linkedAudits[0] as { scheduledDate: string }).scheduledDate,
          startDate: (linkedAudits[0] as { startDate?: string | null }).startDate ?? null,
          status: (linkedAudits[0] as { status: string }).status,
        }
      : null

    return NextResponse.json({
      ...plan,
      nextDueDate,
      linkedAudit: linked,
    })
  } catch (error) {
    console.error('Error in GET /api/audit-plans/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit plan' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!canManageAuditPlan(roles)) {
      return NextResponse.json(
        { error: 'Only Quality Manager can update audit plans.' },
        { status: 403 }
      )
    }

    const { data: existing } = await supabase
      .from('AuditPlan')
      .select('id')
      .eq('id', params.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Audit plan not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, intervalMonths, lastDoneDate, departmentId, base, scope } = body

    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Plan name cannot be empty' }, { status: 400 })
      }
      update.name = name.trim()
    }
    if (intervalMonths !== undefined) {
      const interval = typeof intervalMonths === 'number' ? intervalMonths : parseInt(intervalMonths, 10)
      if (Number.isNaN(interval) || interval < 1) {
        return NextResponse.json(
          { error: 'Interval in months must be at least 1' },
          { status: 400 }
        )
      }
      update.intervalMonths = interval
    }
    if (lastDoneDate !== undefined) {
      if (lastDoneDate == null || lastDoneDate === '') {
        update.lastDoneDate = null
      } else {
        const d = new Date(lastDoneDate)
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: 'Invalid last done date' }, { status: 400 })
        }
        update.lastDoneDate = d.toISOString().slice(0, 10)
      }
    }
    if (departmentId !== undefined) {
      const trimmed =
        departmentId != null && String(departmentId).trim() ? String(departmentId).trim() : ''
      if (!trimmed) {
        return NextResponse.json(
          { error: 'Department cannot be cleared; assign a department to this programme entry.' },
          { status: 400 }
        )
      }
      update.departmentId = trimmed
    }
    if (base !== undefined) {
      update.base = base && String(base).trim() ? String(base).trim() : null
    }
    if (scope !== undefined) {
      update.scope = scope && String(scope).trim() ? String(scope).trim() : null
    }

    const { data: plan, error } = await supabase
      .from('AuditPlan')
      .update(update)
      .eq('id', params.id)
      .select(
        `
        *,
        Department:departmentId(id, name, code)
      `
      )
      .single()

    if (error) {
      console.error('Error updating audit plan:', error)
      return NextResponse.json(
        { error: 'Failed to update audit plan' },
        { status: 500 }
      )
    }

    const lastDoneStr = (plan as { lastDoneDate?: string | null }).lastDoneDate
      ? String((plan as { lastDoneDate: string }).lastDoneDate).slice(0, 10)
      : null
    const nextDueDate = addMonthsToDate(lastDoneStr, (plan as { intervalMonths: number }).intervalMonths)

    return NextResponse.json({ ...plan, nextDueDate, linkedAudit: null })
  } catch (error) {
    console.error('Error in PATCH /api/audit-plans/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to update audit plan' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
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

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!canManageAuditPlan(roles)) {
      return NextResponse.json(
        { error: 'Only Quality Manager can delete audit plans.' },
        { status: 403 }
      )
    }

    const { data: existing } = await supabase
      .from('AuditPlan')
      .select('id')
      .eq('id', params.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Audit plan not found' }, { status: 404 })
    }

    const { error: unlinkError } = await supabase
      .from('Audit')
      .update({ auditPlanId: null })
      .eq('auditPlanId', params.id)

    if (unlinkError) {
      console.error('Error unlinking audits from plan:', unlinkError)
      return NextResponse.json(
        { error: 'Failed to unlink audits from plan' },
        { status: 500 }
      )
    }

    const { error: deleteError } = await supabase
      .from('AuditPlan')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      console.error('Error deleting audit plan:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete audit plan' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error in DELETE /api/audit-plans/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to delete audit plan' },
      { status: 500 }
    )
  }
}
