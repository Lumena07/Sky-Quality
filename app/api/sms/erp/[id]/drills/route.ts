import { NextResponse } from 'next/server'
import { canManageSmsPolicy } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

type RouteContext = { params: Promise<{ id: string }> }

export const POST = async (request: Request, context: RouteContext) => {
  const { id: erpId } = await context.params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsPolicy(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: erp, error: erpErr } = await supabase.from('sms_erp').select('id').eq('id', erpId).maybeSingle()
  if (erpErr) return NextResponse.json({ error: 'Failed to verify ERP' }, { status: 500 })
  if (!erp) return NextResponse.json({ error: 'ERP not found' }, { status: 404 })

  const body = await request.json()
  const payload = {
    erp_id: erpId,
    planned_date: body.plannedDate || null,
    drill_type: body.drillType?.trim() || null,
    participants: body.participants?.trim() || null,
  }

  const { data, error } = await supabase.from('sms_erp_drills').insert(payload).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Failed to create drill' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_erp_drills',
    recordId: String(data.id),
    newValue: data,
  })

  return NextResponse.json(data, { status: 201 })
}
