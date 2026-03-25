import { NextResponse } from 'next/server'
import { canManageSmsRegulatory, canViewSmsRegulatory } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext, nextSmsIdentifier } from '@/lib/sms'
import { REGULATORY_REPORT_TYPES, REGULATORY_STATUSES } from '@/lib/sms-workflow-constants'

const TYPE_SET = new Set<string>(REGULATORY_REPORT_TYPES.map((t) => t.value))
const STATUS_SET = new Set<string>(REGULATORY_STATUSES.map((s) => s.value))

const deadlineFromReport = (occurredAt: string): string => {
  const d = new Date(occurredAt)
  d.setHours(d.getHours() + 72)
  return d.toISOString()
}

export async function GET() {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsRegulatory(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('sms_regulatory_reports')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Failed to fetch regulatory reports' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsRegulatory(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const reportType = String(body.reportType || 'INITIAL').toUpperCase()
  if (!TYPE_SET.has(reportType)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  }
  const status = body.status && STATUS_SET.has(String(body.status).toUpperCase())
    ? String(body.status).toUpperCase()
    : 'SUBMITTED'

  const smsReportId = body.smsReportId || null
  const smsInvestigationId = body.smsInvestigationId || null

  let initialDeadline: string | null = body.initialDeadlineAt || null
  if (!initialDeadline && smsReportId) {
    const { data: rep } = await supabase.from('sms_reports').select('occurred_at').eq('id', smsReportId).maybeSingle()
    if (rep?.occurred_at) initialDeadline = deadlineFromReport(String(rep.occurred_at))
  }

  const reportNumber = await nextSmsIdentifier('sms_regulatory_report', 'SMS-REG')
  const authorityId = body.regulatoryAuthorityId || null
  let authorityText = body.regulatoryAuthority ? String(body.regulatoryAuthority) : ''
  if (authorityId && !authorityText) {
    const { data: auth } = await supabase.from('sms_regulatory_authorities').select('name').eq('id', authorityId).maybeSingle()
    authorityText = auth?.name ? String(auth.name) : 'Authority'
  }
  if (!authorityText) return NextResponse.json({ error: 'Regulatory authority required' }, { status: 400 })

  const { data, error } = await supabase
    .from('sms_regulatory_reports')
    .insert({
      report_number: reportNumber,
      sms_report_id: smsReportId,
      sms_investigation_id: smsInvestigationId,
      regulatory_authority: authorityText,
      regulatory_authority_id: authorityId,
      report_type: reportType,
      submission_date: body.submissionDate || null,
      submission_method: body.submissionMethod ?? null,
      authority_reference_number: body.authorityReferenceNumber ?? null,
      status,
      initial_deadline_at: initialDeadline,
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to create regulatory report' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_regulatory_reports',
    recordId: String(data.id),
    newValue: data,
  })
  return NextResponse.json(data, { status: 201 })
}
