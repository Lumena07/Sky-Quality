import { NextResponse } from 'next/server'
import { canManageSmsPolicy } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

type RouteContext = { params: Promise<{ id: string; drillId: string }> }

export const PATCH = async (request: Request, context: RouteContext) => {
  const { id: erpId, drillId } = await context.params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsPolicy(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: row, error: fetchErr } = await supabase
    .from('sms_erp_drills')
    .select('*')
    .eq('id', drillId)
    .maybeSingle()
  if (fetchErr) return NextResponse.json({ error: 'Failed to fetch drill' }, { status: 500 })
  if (!row || String(row.erp_id) !== erpId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (body.plannedDate !== undefined) updates.planned_date = body.plannedDate || null
  if (body.drillType !== undefined) updates.drill_type = body.drillType?.trim() || null
  if (body.participants !== undefined) updates.participants = body.participants?.trim() || null
  if (body.actualDate !== undefined) updates.actual_date = body.actualDate || null
  if (body.outcome !== undefined) updates.outcome = body.outcome ?? null
  if (body.deficiencies !== undefined) updates.deficiencies = body.deficiencies ?? null
  if (body.correctiveActions !== undefined) updates.corrective_actions = body.correctiveActions ?? null

  const { data, error } = await supabase
    .from('sms_erp_drills')
    .update(updates)
    .eq('id', drillId)
    .select('*')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Failed to update drill' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_erp_drills',
    recordId: drillId,
    oldValue: row,
    newValue: data,
  })

  return NextResponse.json(data)
}
