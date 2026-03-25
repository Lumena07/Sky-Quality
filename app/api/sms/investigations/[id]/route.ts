import { NextResponse } from 'next/server'
import {
  canCloseInvestigation,
  canManageSmsInvestigation,
  canReadSmsInvestigation,
} from '@/lib/sms-permissions'
import type { OperationalArea } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'
import { INVESTIGATION_STATUSES, ROOT_CAUSE_METHODS } from '@/lib/sms-workflow-constants'

const STATUS_SET = new Set<string>(INVESTIGATION_STATUSES.map((s) => s.value))
const METHOD_SET = new Set<string>(ROOT_CAUSE_METHODS.map((m) => m.value))

type RouteParams = { params: Promise<{ id: string }> }

const selectInvestigationDetail = (supabase: Awaited<ReturnType<typeof getSmsAuthContext>>['supabase'], id: string) =>
  supabase
    .from('sms_investigations')
    .select(
      `
      *,
      sms_investigation_reports(report_id),
      sms_investigation_team(user_id, role),
      sms_investigation_recommendations(*)
    `
    )
    .eq('id', id)
    .maybeSingle()

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let { data, error } = await selectInvestigationDetail(supabase, id)
  if (error || !data) {
    const plain = await supabase.from('sms_investigations').select('*').eq('id', id).maybeSingle()
    if (plain.error || !plain.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    data = plain.data as Record<string, unknown>
  }

  const teamRows = (data as { sms_investigation_team?: { user_id: string }[] }).sms_investigation_team ?? []
  const teamUserIds = teamRows.map((t) => String(t.user_id))

  if (
    !canReadSmsInvestigation(profile.roles, user.id, profile.safetyOperationalArea as OperationalArea | null, {
      lead_id: (data as { lead_id: string | null }).lead_id,
      operational_area: String((data as { operational_area: string }).operational_area),
      teamUserIds,
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row, error: fetchErr } = await supabase.from('sms_investigations').select('*').eq('id', id).maybeSingle()
  if (fetchErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: teamRows } = await supabase.from('sms_investigation_team').select('user_id').eq('investigation_id', id)
  const teamUserIds = (teamRows ?? []).map((t) => String(t.user_id))

  const invArea = row.operational_area as OperationalArea
  const isManager = canManageSmsInvestigation(
    profile.roles,
    profile.safetyOperationalArea as OperationalArea | null,
    invArea
  )
  const isLeadOrTeam =
    row.lead_id === user.id || teamUserIds.includes(user.id)

  if (!isManager && !isLeadOrTeam) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  const setIf = (key: string, val: unknown) => {
    if (val !== undefined) updates[key] = val
  }

  if (isManager || row.lead_id === user.id) {
    setIf('lead_id', body.leadId !== undefined ? body.leadId || null : undefined)
    setIf('target_completion_date', body.targetCompletionDate !== undefined ? body.targetCompletionDate || null : undefined)
    if (body.status !== undefined) {
      const st = String(body.status).toUpperCase()
      if (!STATUS_SET.has(st)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      if (st === 'CLOSED') {
        const { data: recs } = await supabase
          .from('sms_investigation_recommendations')
          .select('id, capa_id')
          .eq('investigation_id', id)
        const missing = (recs ?? []).filter((r) => !r.capa_id)
        if (missing.length > 0) {
          return NextResponse.json(
            { error: 'Each recommendation must be linked to a CAPA before closing' },
            { status: 400 }
          )
        }
      }
      updates.status = st
    }
    setIf('event_description', body.eventDescription)
    setIf('immediate_causes', body.immediateCauses)
    setIf('contributing_factors', body.contributingFactors)
    setIf('contributing_factors_structured', body.contributingFactorsStructured)
    if (body.rootCauseMethod !== undefined) {
      const m = body.rootCauseMethod ? String(body.rootCauseMethod).toUpperCase() : null
      if (m && !METHOD_SET.has(m)) return NextResponse.json({ error: 'Invalid root cause method' }, { status: 400 })
      updates.root_cause_method = m
    }
    setIf('root_cause_analysis', body.rootCauseAnalysis)
    setIf('safety_deficiencies', body.safetyDeficiencies)
    setIf('recommendations', body.recommendations)
    setIf('requires_regulatory_notification', body.requiresRegulatoryNotification)
    setIf('regulatory_notification_date', body.regulatoryNotificationDate)
    setIf('regulatory_reference', body.regulatoryReference)
    setIf('report_file_url', body.reportFileUrl)
    if (body.operationalArea !== undefined) {
      const na = String(body.operationalArea) as OperationalArea
      if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      updates.operational_area = na
    }
  }

  if (body.closureSignature !== undefined) {
    if (!canCloseInvestigation(profile.roles)) {
      return NextResponse.json({ error: 'Only Director of Safety can sign closure' }, { status: 403 })
    }
    updates.closure_signature = body.closureSignature || null
    updates.closure_signed_by = user.id
    updates.closure_signed_at = new Date().toISOString()
    updates.status = 'CLOSED'
  }

  const hasRelationalOnly =
    isManager &&
    (Array.isArray(body.reportIds) || Array.isArray(body.team)) &&
    Object.keys(updates).length <= 1
  if (Object.keys(updates).length <= 1 && !hasRelationalOnly) {
    return NextResponse.json({ error: 'No valid updates' }, { status: 400 })
  }

  const { data, error } = await supabase.from('sms_investigations').update(updates).eq('id', id).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Failed to update investigation' }, { status: 500 })

  if (isManager && Array.isArray(body.reportIds)) {
    await supabase.from('sms_investigation_reports').delete().eq('investigation_id', id)
    const reportIds = body.reportIds.map(String)
    if (reportIds.length > 0) {
      await supabase
        .from('sms_investigation_reports')
        .insert(reportIds.map((reportId: string) => ({ investigation_id: id, report_id: reportId })))
    }
  }

  if (isManager && Array.isArray(body.team)) {
    await supabase.from('sms_investigation_team').delete().eq('investigation_id', id)
    const team: { userId: string; role?: string }[] = body.team
    if (team.length > 0) {
      await supabase.from('sms_investigation_team').insert(
        team.map((t) => ({
          investigation_id: id,
          user_id: t.userId,
          role: t.role ?? null,
        }))
      )
    }
  }

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_investigations',
    recordId: id,
    oldValue: row,
    newValue: data,
  })

  const { data: full } = await selectInvestigationDetail(supabase, id)
  return NextResponse.json(full ?? data)
}
