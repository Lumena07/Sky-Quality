import { NextResponse } from 'next/server'
import { getDefaultSmsAuditChecklist } from '@/lib/sms-audit-checklist-templates'
import { canReadSmsDashboard, canViewSmsProtectedData } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext, nextSmsIdentifier } from '@/lib/sms'

export async function GET() {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReadSmsDashboard(profile.roles) && !canViewSmsProtectedData(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { data, error } = await supabase.from('sms_audits').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsProtectedData(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const number = await nextSmsIdentifier('sms_audit', 'SMS-AUD')
  const auditType = typeof body.auditType === 'string' ? body.auditType : 'INTERNAL_SMS_AUDIT'
  const teamIds = Array.isArray(body.auditTeamUserIds) ? body.auditTeamUserIds.map(String) : []
  let checklist = Array.isArray(body.checklist) ? body.checklist : []
  if (checklist.length === 0 && body.useDefaultChecklist !== false) {
    checklist = getDefaultSmsAuditChecklist(auditType)
  }
  const { data, error } = await supabase
    .from('sms_audits')
    .insert({
      audit_number: number,
      title: body.title,
      audit_type: auditType,
      operational_area: body.operationalArea || 'all',
      lead_auditor_id: body.leadAuditorId || user.id,
      audit_team_user_ids: teamIds,
      planned_date: body.plannedDate || null,
      actual_date: body.actualDate || null,
      scope: body.scope || null,
      checklist,
      report_url: body.reportUrl || null,
      status: body.status || 'PLANNED',
    })
    .select('*')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  await createSmsAuditLog({ userId: user.id, actionType: 'CREATE', module: 'sms_audits', recordId: String(data.id), newValue: data })
  return NextResponse.json(data, { status: 201 })
}
