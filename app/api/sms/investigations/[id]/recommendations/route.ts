import { NextResponse } from 'next/server'
import { canManageSmsInvestigation, canReadSmsInvestigation } from '@/lib/sms-permissions'
import type { OperationalArea } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext, nextSmsIdentifier } from '@/lib/sms'
import { CAPA_PRIORITIES, CAPA_SOURCE_TYPES, CAPA_TYPES } from '@/lib/sms-workflow-constants'

const CAPA_TYPE_SET = new Set<string>(CAPA_TYPES.map((t) => t.value))
const CAPA_PRIORITY_SET = new Set<string>(CAPA_PRIORITIES.map((p) => p.value))

type RouteParams = { params: Promise<{ id: string }> }

const loadInvAccess = async (
  supabase: Awaited<ReturnType<typeof getSmsAuthContext>>['supabase'],
  investigationId: string,
  userId: string,
  roles: string[],
  safetyArea: OperationalArea | null
) => {
  const { data: row } = await supabase.from('sms_investigations').select('*').eq('id', investigationId).maybeSingle()
  if (!row) return { row: null, canWrite: false, canRead: false }
  const { data: teamRows } = await supabase.from('sms_investigation_team').select('user_id').eq('investigation_id', investigationId)
  const teamUserIds = (teamRows ?? []).map((t) => String(t.user_id))
  const canRead = canReadSmsInvestigation(roles, userId, safetyArea, {
    lead_id: row.lead_id as string | null,
    operational_area: String(row.operational_area),
    teamUserIds,
  })
  const canWrite = canManageSmsInvestigation(roles, safetyArea, row.operational_area as OperationalArea)
  return { row, canWrite, canRead, teamUserIds }
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: investigationId } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { row, canRead } = await loadInvAccess(
    supabase,
    investigationId,
    user.id,
    profile.roles,
    profile.safetyOperationalArea as OperationalArea | null
  )
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canRead) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('sms_investigation_recommendations')
    .select('*')
    .eq('investigation_id', investigationId)
    .order('sort_order', { ascending: true })
  if (error) return NextResponse.json({ error: 'Failed to load recommendations' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: investigationId } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { row, canWrite } = await loadInvAccess(
    supabase,
    investigationId,
    user.id,
    profile.roles,
    profile.safetyOperationalArea as OperationalArea | null
  )
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canWrite) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const description = String(body.description || '').trim()
  if (!description) return NextResponse.json({ error: 'Description required' }, { status: 400 })

  const sortOrder = Number(body.sortOrder ?? 0)
  let capaId: string | null = body.capaId ? String(body.capaId) : null

  if (body.createCapa === true) {
    const capaNumber = await nextSmsIdentifier('sms_capa', 'SMS-CAPA')
    const capaType = String(body.capaType || 'CORRECTIVE').toUpperCase()
    if (!CAPA_TYPE_SET.has(capaType)) {
      return NextResponse.json({ error: 'Invalid CAPA type' }, { status: 400 })
    }
    const priority = String(body.priority || 'MEDIUM').toUpperCase()
    if (!CAPA_PRIORITY_SET.has(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
    }
    const target = body.targetCompletionDate
    if (!target) return NextResponse.json({ error: 'targetCompletionDate required for new CAPA' }, { status: 400 })

    const { data: capa, error: capaErr } = await supabase
      .from('sms_capas')
      .insert({
        capa_number: capaNumber,
        capa_type: capaType,
        description,
        source_type: 'investigation',
        source_id: investigationId,
        assigned_owner_id: body.assignedOwnerId || user.id,
        target_completion_date: String(target).slice(0, 10),
        priority,
        status: 'OPEN',
        operational_area: row.operational_area,
        safety_protected: true,
      })
      .select('id')
      .single()
    if (capaErr || !capa) return NextResponse.json({ error: 'Failed to create CAPA' }, { status: 500 })
    capaId = String(capa.id)
    await createSmsAuditLog({
      userId: user.id,
      actionType: 'CREATE',
      module: 'sms_capas',
      recordId: capaId,
      newValue: capa,
    })
  }

  const { data, error } = await supabase
    .from('sms_investigation_recommendations')
    .insert({
      investigation_id: investigationId,
      sort_order: sortOrder,
      description,
      capa_id: capaId,
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to create recommendation' }, { status: 500 })
  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_investigation_recommendations',
    recordId: String(data.id),
    newValue: data,
  })
  return NextResponse.json(data, { status: 201 })
}
