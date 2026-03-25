import { NextResponse } from 'next/server'
import { getDefaultSmsAuditChecklist } from '@/lib/sms-audit-checklist-templates'
import {
  canReadSmsDashboard,
  canSignOffSmsAuditClosure,
  canViewSmsProtectedData,
} from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'
import { isDirectorOfSafety } from '@/lib/permissions'

const ALLOWED_STATUS = new Set(['PLANNED', 'IN_PROGRESS', 'PENDING_REVIEW', 'CLOSED'])

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReadSmsDashboard(profile.roles) && !canViewSmsProtectedData(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: audit, error: aErr } = await supabase.from('sms_audits').select('*').eq('id', params.id).single()
  if (aErr || !audit) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: findings, error: fErr } = await supabase
    .from('sms_audit_findings')
    .select('*')
    .eq('audit_id', params.id)
    .order('finding_number', { ascending: true })

  if (fErr) return NextResponse.json({ error: 'Failed to load findings' }, { status: 500 })
  return NextResponse.json({ audit, findings: findings ?? [] })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsProtectedData(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing, error: exErr } = await supabase.from('sms_audits').select('*').eq('id', params.id).single()
  if (exErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (typeof body.title === 'string') updates.title = body.title.trim()
  if (typeof body.auditType === 'string') updates.audit_type = body.auditType
  if (body.operationalArea !== undefined) updates.operational_area = body.operationalArea
  if (body.leadAuditorId !== undefined) updates.lead_auditor_id = body.leadAuditorId
  if (Array.isArray(body.auditTeamUserIds)) updates.audit_team_user_ids = body.auditTeamUserIds.map(String)
  if (body.plannedDate !== undefined) updates.planned_date = body.plannedDate
  if (body.actualDate !== undefined) updates.actual_date = body.actualDate
  if (body.scope !== undefined) updates.scope = body.scope
  if (Array.isArray(body.checklist)) updates.checklist = body.checklist
  if (body.reportUrl !== undefined) updates.report_url = body.reportUrl

  if (body.resetChecklistFromTemplate === true && typeof body.auditType === 'string') {
    updates.checklist = getDefaultSmsAuditChecklist(body.auditType)
  }

  if (body.status !== undefined) {
    const st = String(body.status).toUpperCase()
    if (!ALLOWED_STATUS.has(st)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (st === 'CLOSED') {
      if (!canSignOffSmsAuditClosure(profile.roles)) {
        return NextResponse.json({ error: 'Only Director of Safety may close audits' }, { status: 403 })
      }
      updates.status = st
      updates.dos_signoff_by = user.id
      updates.dos_signoff_at = new Date().toISOString()
    } else {
      updates.status = st
    }
  }

  if (body.dosSignoff === true && isDirectorOfSafety(profile.roles)) {
    updates.dos_signoff_by = user.id
    updates.dos_signoff_at = new Date().toISOString()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid updates' }, { status: 400 })
  }

  const { data, error } = await supabase.from('sms_audits').update(updates).eq('id', params.id).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Failed to update audit' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_audits',
    recordId: params.id,
    oldValue: existing,
    newValue: data,
  })
  return NextResponse.json(data)
}
