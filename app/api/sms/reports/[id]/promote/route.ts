import { NextResponse } from 'next/server'
import { canManageSmsReport } from '@/lib/sms-permissions'
import type { OperationalArea } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext, nextSmsIdentifier } from '@/lib/sms'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: report, error: reportErr } = await supabase
    .from('sms_reports')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (reportErr || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const reportArea = report.operational_area as OperationalArea
  if (!canManageSmsReport(profile.roles, profile.safetyOperationalArea as OperationalArea | null, reportArea)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const currentStatus = String(report.status || 'NEW').toUpperCase()
  if (!['NEW', 'UNDER_REVIEW'].includes(currentStatus)) {
    return NextResponse.json({ error: 'Only NEW or UNDER_REVIEW reports can be promoted' }, { status: 400 })
  }

  const { data: existingHazard } = await supabase
    .from('sms_hazards')
    .select('id, hazard_number')
    .eq('source_report_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existingHazard) {
    return NextResponse.json(
      { error: 'Report already promoted', hazardId: existingHazard.id, hazardNumber: existingHazard.hazard_number },
      { status: 409 }
    )
  }

  const hazardNumber = await nextSmsIdentifier('sms_hazard', 'SMS-HAZ')
  const hazardInsert = {
    hazard_number: hazardNumber,
    title: String(report.report_type || 'HAZARD').replace(/_/g, ' ') + ' from report ' + String(report.report_number),
    description: String(report.description || ''),
    source_type: 'LINKED_REPORT',
    source_report_id: id,
    operational_area: report.operational_area,
    hazard_category: null,
    icao_high_risk_categories: Array.isArray(report.icao_high_risk_categories)
      ? report.icao_high_risk_categories
      : [],
    identified_at: new Date().toISOString(),
    identified_by: user.id,
    status: 'PENDING_ASSESSMENT',
    initial_likelihood: null,
    initial_severity: null,
    initial_risk_index: null,
    initial_risk_level: null,
    review_date: null,
    safety_protected: true,
  }

  const { data: hazard, error: hazardErr } = await supabase
    .from('sms_hazards')
    .insert(hazardInsert)
    .select('*')
    .single()
  if (hazardErr || !hazard) {
    return NextResponse.json({ error: 'Failed to promote report to hazard' }, { status: 500 })
  }

  const { data: updatedReport, error: updErr } = await supabase
    .from('sms_reports')
    .update({ status: 'PROMOTED', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (updErr || !updatedReport) {
    return NextResponse.json({ error: 'Hazard created but report status update failed' }, { status: 500 })
  }

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_hazards',
    recordId: String(hazard.id),
    newValue: hazard,
  })
  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_reports',
    recordId: String(updatedReport.id),
    oldValue: report,
    newValue: updatedReport,
  })

  return NextResponse.json({
    report: updatedReport,
    hazard,
  })
}
