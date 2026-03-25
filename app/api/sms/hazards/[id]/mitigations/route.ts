import { NextResponse } from 'next/server'
import { canManageSmsHazard } from '@/lib/sms-permissions'
import type { OperationalArea } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'
import { MITIGATION_CONTROL_TYPES, MITIGATION_STATUSES } from '@/lib/sms-risk-constants'

const CONTROL_VALUES = new Set<string>(MITIGATION_CONTROL_TYPES.map((c) => c.value))
const MIT_STATUS_VALUES = new Set<string>(MITIGATION_STATUSES.map((s) => s.value))

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: hazardId } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: hazard, error: hErr } = await supabase
    .from('sms_hazards')
    .select('operational_area')
    .eq('id', hazardId)
    .maybeSingle()
  if (hErr || !hazard) return NextResponse.json({ error: 'Hazard not found' }, { status: 404 })

  if (
    !canManageSmsHazard(profile.roles, profile.safetyOperationalArea as OperationalArea | null, hazard.operational_area as OperationalArea)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('sms_hazard_mitigations')
    .select('*')
    .eq('hazard_id', hazardId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to load mitigations' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: hazardId } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: hazard, error: hErr } = await supabase
    .from('sms_hazards')
    .select('operational_area')
    .eq('id', hazardId)
    .maybeSingle()
  if (hErr || !hazard) return NextResponse.json({ error: 'Hazard not found' }, { status: 404 })

  if (
    !canManageSmsHazard(profile.roles, profile.safetyOperationalArea as OperationalArea | null, hazard.operational_area as OperationalArea)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const controlType = String(body.controlType || '').toUpperCase()
  if (!CONTROL_VALUES.has(controlType)) {
    return NextResponse.json({ error: 'Invalid control type' }, { status: 400 })
  }
  const status = body.status ? String(body.status).toUpperCase() : 'OPEN'
  if (!MIT_STATUS_VALUES.has(status)) {
    return NextResponse.json({ error: 'Invalid mitigation status' }, { status: 400 })
  }

  const description = String(body.description || '').trim()
  if (!description) return NextResponse.json({ error: 'Description required' }, { status: 400 })

  const { data, error } = await supabase
    .from('sms_hazard_mitigations')
    .insert({
      hazard_id: hazardId,
      description,
      control_type: controlType,
      owner_id: body.ownerId || null,
      due_date: body.dueDate ? String(body.dueDate).slice(0, 10) : null,
      status,
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to create mitigation' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_hazard_mitigations',
    recordId: String(data.id),
    newValue: data,
  })
  return NextResponse.json(data, { status: 201 })
}
