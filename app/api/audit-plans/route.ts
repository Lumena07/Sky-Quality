import { randomUUID } from 'crypto'
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

/** GET: List audit plans (with nextDueDate and linkedAudit). Used by Audit Plan page and by Schedule Audit form on Audits page so QM and auditors can pick a not-scheduled plan. */
export async function GET() {
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

    const { data: plans, error } = await supabase
      .from('AuditPlan')
      .select(
        `
        *,
        Department:departmentId(id, name, code)
      `
      )
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching audit plans:', error)
      return NextResponse.json(
        { error: 'Failed to fetch audit plans' },
        { status: 500 }
      )
    }

    const planIds = (plans ?? []).map((p: { id: string }) => p.id)
    let linkedAudits: Array<{ auditPlanId: string; id: string; title: string; startDate: string | null; scheduledDate: string; status: string }> = []
    if (planIds.length > 0) {
      const { data: audits } = await supabase
        .from('Audit')
        .select('id, title, startDate, scheduledDate, status, auditPlanId')
        .in('auditPlanId', planIds)
        .in('status', ['PLANNED', 'ACTIVE'])
      linkedAudits = (audits ?? []).map((a: { auditPlanId: string; id: string; title: string; startDate: string | null; scheduledDate: string; status: string }) => ({
        auditPlanId: a.auditPlanId,
        id: a.id,
        title: a.title,
        startDate: a.startDate ?? null,
        scheduledDate: a.scheduledDate,
        status: a.status,
      }))
    }

    const withNextDue = (plans ?? []).map((p: { id: string; lastDoneDate: string | null; intervalMonths: number; [k: string]: unknown }) => {
      const lastDone = p.lastDoneDate ? String(p.lastDoneDate).slice(0, 10) : null
      const nextDueDate = addMonthsToDate(lastDone, p.intervalMonths)
      const linked = linkedAudits.find((a) => a.auditPlanId === p.id)
      return {
        ...p,
        nextDueDate,
        linkedAudit: linked
          ? {
              id: linked.id,
              title: linked.title,
              scheduledDate: linked.scheduledDate,
              startDate: linked.startDate,
              status: linked.status,
            }
          : null,
      }
    })

    return NextResponse.json(withNextDue)
  } catch (error) {
    console.error('Error in GET /api/audit-plans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit plans' },
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

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!canManageAuditPlan(roles)) {
      return NextResponse.json(
        { error: 'Only Quality Manager can add or edit audit plans.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, intervalMonths, lastDoneDate, departmentId, base, scope } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Plan name is required' },
        { status: 400 }
      )
    }
    const deptTrimmed =
      departmentId != null && String(departmentId).trim() ? String(departmentId).trim() : ''
    if (!deptTrimmed) {
      return NextResponse.json(
        { error: 'Department is required for each programme entry.' },
        { status: 400 }
      )
    }
    const interval = typeof intervalMonths === 'number' ? intervalMonths : parseInt(intervalMonths, 10)
    if (Number.isNaN(interval) || interval < 1) {
      return NextResponse.json(
        { error: 'Interval in months must be at least 1' },
        { status: 400 }
      )
    }

    let lastDone: string | null = null
    if (lastDoneDate != null && lastDoneDate !== '') {
      const d = new Date(lastDoneDate)
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: 'Invalid last done date' },
          { status: 400 }
        )
      }
      lastDone = d.toISOString().slice(0, 10)
    }

    const id = randomUUID()
    const now = new Date().toISOString()
    const { data: plan, error } = await supabase
      .from('AuditPlan')
      .insert({
        id,
        name: name.trim(),
        intervalMonths: interval,
        lastDoneDate: lastDone,
        departmentId: deptTrimmed,
        base: base && String(base).trim() ? String(base).trim() : null,
        scope: scope && String(scope).trim() ? String(scope).trim() : null,
        createdById: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .select(
        `
        *,
        Department:departmentId(id, name, code)
      `
      )
      .single()

    if (error) {
      console.error('Error creating audit plan:', error)
      return NextResponse.json(
        { error: 'Failed to create audit plan' },
        { status: 500 }
      )
    }

    const lastDoneStr = (plan as { lastDoneDate?: string | null }).lastDoneDate
      ? String((plan as { lastDoneDate: string }).lastDoneDate).slice(0, 10)
      : null
    const nextDueDate = addMonthsToDate(lastDoneStr, (plan as { intervalMonths: number }).intervalMonths)

    return NextResponse.json(
      { ...plan, nextDueDate, linkedAudit: null },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in POST /api/audit-plans:', error)
    return NextResponse.json(
      { error: 'Failed to create audit plan' },
      { status: 500 }
    )
  }
}
