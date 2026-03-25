import { NextResponse } from 'next/server'
import { canViewSmsProtectedData } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext, nextSmsIdentifier } from '@/lib/sms'
import { CAPA_PRIORITIES, CAPA_STATUSES, CAPA_TYPES } from '@/lib/sms-workflow-constants'

const todayStr = () => new Date().toISOString().slice(0, 10)

const withDerivedStatus = (rows: Record<string, unknown>[]) => {
  const today = todayStr()
  return rows.map((item) => {
    const due = String(item.target_completion_date || '')
    const st = String(item.status || '')
    const overdue =
      due < today && (st === 'OPEN' || st === 'IN_PROGRESS')
    return { ...item, displayStatus: overdue ? 'OVERDUE' : st, isOverdue: overdue }
  })
}

export async function GET() {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('sms_capas')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Failed to fetch CAPAs' }, { status: 500 })
  const rows = canViewSmsProtectedData(profile.roles)
    ? (data ?? [])
    : (data ?? []).filter((item) => item.assigned_owner_id === user.id)
  return NextResponse.json(withDerivedStatus(rows as Record<string, unknown>[]))
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsProtectedData(profile.roles) && !profile.roles.includes('DEPARTMENT_HEAD')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const capaType = String(body.capaType || 'CORRECTIVE').toUpperCase()
  const priority = String(body.priority || 'MEDIUM').toUpperCase()
  const status = String(body.status || 'OPEN').toUpperCase()
  if (!CAPA_TYPES.some((t) => t.value === capaType)) {
    return NextResponse.json({ error: 'Invalid CAPA type' }, { status: 400 })
  }
  if (!CAPA_PRIORITIES.some((p) => p.value === priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }
  if (!CAPA_STATUSES.some((s) => s.value === status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  const capaNumber = await nextSmsIdentifier('sms_capa', 'SMS-CAPA')
  const { data, error } = await supabase
    .from('sms_capas')
    .insert({
      capa_number: capaNumber,
      capa_type: capaType,
      description: body.description,
      source_type: body.sourceType || 'hazard',
      source_id: body.sourceId || null,
      assigned_owner_id: body.assignedOwnerId || user.id,
      target_completion_date: body.targetCompletionDate,
      priority,
      status,
      operational_area: body.operationalArea || profile.safetyOperationalArea || 'all',
      safety_protected: true,
    })
    .select('*')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Failed to create CAPA' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_capas',
    recordId: String(data.id),
    newValue: data,
  })
  return NextResponse.json(data, { status: 201 })
}
