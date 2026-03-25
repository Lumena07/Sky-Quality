import { NextResponse } from 'next/server'
import { canManageSmsInvestigation } from '@/lib/sms-permissions'
import type { OperationalArea } from '@/lib/sms-permissions'
import { isDirectorOfSafety, isSafetyOfficer } from '@/lib/permissions'
import { createSmsAuditLog, getSmsAuthContext, nextSmsIdentifier } from '@/lib/sms'
import { INVESTIGATION_STATUSES, ROOT_CAUSE_METHODS } from '@/lib/sms-workflow-constants'

const STATUS_SET = new Set<string>(INVESTIGATION_STATUSES.map((s) => s.value))
const METHOD_SET = new Set<string>(ROOT_CAUSE_METHODS.map((m) => m.value))

const buildInvestigationListQuery = async (
  supabase: Awaited<ReturnType<typeof getSmsAuthContext>>['supabase'],
  userId: string,
  roles: string[],
  safetyArea: OperationalArea | null
) => {
  let q = supabase.from('sms_investigations').select('*').order('created_at', { ascending: false })

  if (isDirectorOfSafety(roles)) return q

  const { data: teamRows } = await supabase
    .from('sms_investigation_team')
    .select('investigation_id')
    .eq('user_id', userId)
  const mappedIds = (teamRows ?? []).map((r) => String(r.investigation_id))
  const teamInvIds = mappedIds.filter((id, i) => mappedIds.indexOf(id) === i)

  const orParts: string[] = [`lead_id.eq.${userId}`]
  if (teamInvIds.length > 0) orParts.push(`id.in.(${teamInvIds.join(',')})`)
  if (isSafetyOfficer(roles) && safetyArea) {
    orParts.push(`operational_area.eq.${safetyArea}`)
    orParts.push('operational_area.eq.all')
  }

  return q.or(orParts.join(','))
}

export async function GET() {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = await buildInvestigationListQuery(
    supabase,
    user.id,
    profile.roles,
    profile.safetyOperationalArea as OperationalArea | null
  )
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Failed to fetch investigations' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const opArea = (body.operationalArea || profile.safetyOperationalArea || 'all') as OperationalArea
  if (!canManageSmsInvestigation(profile.roles, profile.safetyOperationalArea as OperationalArea | null, opArea)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const status = body.status ? String(body.status).toUpperCase() : 'OPEN'
  if (!STATUS_SET.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const rootCauseMethod = body.rootCauseMethod ? String(body.rootCauseMethod).toUpperCase() : null
  if (rootCauseMethod && !METHOD_SET.has(rootCauseMethod)) {
    return NextResponse.json({ error: 'Invalid root cause method' }, { status: 400 })
  }

  const investigationNumber = await nextSmsIdentifier('sms_investigation', 'SMS-INV')
  const { data: row, error } = await supabase
    .from('sms_investigations')
    .insert({
      investigation_number: investigationNumber,
      lead_id: body.leadId || user.id,
      target_completion_date: body.targetCompletionDate || null,
      status,
      event_description: body.eventDescription ?? null,
      immediate_causes: body.immediateCauses ?? null,
      contributing_factors: body.contributingFactors ?? null,
      contributing_factors_structured: body.contributingFactorsStructured ?? {},
      root_cause_method: rootCauseMethod,
      root_cause_analysis: body.rootCauseAnalysis ?? null,
      safety_deficiencies: body.safetyDeficiencies ?? null,
      recommendations: body.recommendations ?? null,
      requires_regulatory_notification: Boolean(body.requiresRegulatoryNotification),
      regulatory_notification_date: body.regulatoryNotificationDate || null,
      regulatory_reference: body.regulatoryReference ?? null,
      operational_area: opArea,
      safety_protected: true,
    })
    .select('*')
    .single()

  if (error || !row) return NextResponse.json({ error: 'Failed to create investigation' }, { status: 500 })

  const invId = String(row.id)

  const reportIds: string[] = Array.isArray(body.reportIds) ? body.reportIds.map(String) : []
  if (reportIds.length > 0) {
    await supabase.from('sms_investigation_reports').insert(
      reportIds.map((report_id) => ({ investigation_id: invId, report_id }))
    )
  }

  const team: { userId: string; role?: string }[] = Array.isArray(body.team) ? body.team : []
  if (team.length > 0) {
    await supabase.from('sms_investigation_team').insert(
      team.map((t) => ({
        investigation_id: invId,
        user_id: t.userId,
        role: t.role ?? null,
      }))
    )
  }

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_investigations',
    recordId: invId,
    newValue: row,
  })

  return NextResponse.json(row, { status: 201 })
}
