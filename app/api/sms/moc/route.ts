import { NextResponse } from 'next/server'
import { canProposeSmsMoc, canViewSmsMoc } from '@/lib/sms-permissions'
import type { OperationalArea } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext, nextSmsIdentifier } from '@/lib/sms'
import { INTRODUCES_HAZARDS, MOC_CHANGE_TYPES, MOC_STATUSES } from '@/lib/sms-workflow-constants'
import { riskIndexToLevel } from '@/lib/sms-risk-constants'

const CHANGE_SET = new Set<string>(MOC_CHANGE_TYPES.map((c) => c.value))
const STATUS_SET = new Set<string>(MOC_STATUSES.map((s) => s.value))
const INTRO_SET = new Set<string>(INTRODUCES_HAZARDS.map((x) => x.value))

export async function GET() {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsMoc(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('sms_moc')
    .select('*, sms_moc_hazard_links(hazard_id)')
    .order('created_at', { ascending: false })
  if (error) {
    const plain = await supabase.from('sms_moc').select('*').order('created_at', { ascending: false })
    if (plain.error) return NextResponse.json({ error: 'Failed to fetch MoC' }, { status: 500 })
    return NextResponse.json(plain.data ?? [])
  }
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canProposeSmsMoc(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const changeType = String(body.changeType || '').toUpperCase()
  if (!CHANGE_SET.has(changeType)) {
    return NextResponse.json({ error: 'Invalid change type' }, { status: 400 })
  }

  const opArea = (body.operationalArea || profile.safetyOperationalArea || 'all') as OperationalArea
  const title = String(body.title || '').trim()
  const description = String(body.description || '').trim()
  if (!title || !description) return NextResponse.json({ error: 'Title and description required' }, { status: 400 })

  const introduces = String(body.introducesNewHazards || 'UNKNOWN').toUpperCase()
  if (!INTRO_SET.has(introduces)) {
    return NextResponse.json({ error: 'Invalid introduces new hazards value' }, { status: 400 })
  }

  let initialL: number | null = body.initialLikelihood != null ? Number(body.initialLikelihood) : null
  let initialS: number | null = body.initialSeverity != null ? Number(body.initialSeverity) : null
  let idx: number | null = null
  let level: string | null = null
  if (initialL != null && initialS != null) {
    initialL = Math.min(5, Math.max(1, initialL))
    initialS = Math.min(5, Math.max(1, initialS))
    idx = initialL * initialS
    level = riskIndexToLevel(idx)
  }

  const changeNumber = await nextSmsIdentifier('sms_moc', 'SMS-MOC')
  const { data: row, error } = await supabase
    .from('sms_moc')
    .insert({
      change_number: changeNumber,
      title,
      description,
      change_type: changeType,
      operational_area: opArea,
      proposed_by: user.id,
      implementation_date: body.implementationDate ? String(body.implementationDate).slice(0, 10) : null,
      introduces_new_hazards: introduces,
      safety_impact_notes: body.safetyImpactNotes ?? null,
      mitigations_proposed: Array.isArray(body.mitigationsProposed) ? body.mitigationsProposed : [],
      initial_likelihood: initialL,
      initial_severity: initialS,
      initial_risk_index: idx,
      initial_risk_level: level,
      status: body.status && STATUS_SET.has(String(body.status).toUpperCase()) ? String(body.status).toUpperCase() : 'DRAFT',
    })
    .select('*')
    .single()

  if (error || !row) return NextResponse.json({ error: 'Failed to create MoC' }, { status: 500 })

  const mocId = String(row.id)
  const hazardIds: string[] = Array.isArray(body.hazardIds) ? body.hazardIds.map(String) : []
  if (hazardIds.length > 0) {
    await supabase.from('sms_moc_hazard_links').insert(hazardIds.map((hazard_id) => ({ moc_id: mocId, hazard_id })))
  }

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_moc',
    recordId: mocId,
    newValue: row,
  })
  return NextResponse.json(row, { status: 201 })
}
