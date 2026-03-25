import { NextResponse } from 'next/server'
import {
  canSubmitSmsReport,
  canViewAllSmsReports,
  canViewDepartmentSmsReports,
} from '@/lib/sms-permissions'
import {
  createSmsAuditLog,
  getSmsAuthContext,
  nextSmsIdentifier,
  notifySmsReportSubmitted,
} from '@/lib/sms'
import {
  CONTRIBUTING_FACTORS,
  ICAO_HIGH_RISK_CATEGORIES,
  LOCATION_AREA_OPTIONS,
  OPERATIONAL_AREA_OPTIONS,
  SMS_REPORT_TYPES,
} from '@/lib/sms-risk-constants'

const REPORT_TYPE_VALUES = new Set<string>(SMS_REPORT_TYPES.map((t) => t.value))
const LOCATION_VALUES = new Set<string>(LOCATION_AREA_OPTIONS.map((o) => o.value))
const OPERATIONAL_VALUES = new Set<string>(OPERATIONAL_AREA_OPTIONS.map((o) => o.value))
const CONTRIBUTING_VALUES = new Set<string>(CONTRIBUTING_FACTORS.map((c) => c.value))
const ICAO_VALUES = new Set<string>(ICAO_HIGH_RISK_CATEGORIES.map((c) => c.value))

const MAX_ATTACHMENTS = 5

export async function GET() {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let query = supabase.from('sms_reports').select('*').order('created_at', { ascending: false })

  if (canViewAllSmsReports(profile.roles)) {
    // no filter
  } else if (canViewDepartmentSmsReports(profile.roles) && profile.departmentId) {
    query = query.eq('reporter_department_id', profile.departmentId)
  } else {
    query = query.eq('reporter_id', user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSubmitSmsReport(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const reportNumber = await nextSmsIdentifier('sms_report', 'SMS-RPT')
  const isAnonymous = Boolean(body.isAnonymous)

  const reportType = String(body.reportType || '').toUpperCase()
  if (!REPORT_TYPE_VALUES.has(reportType)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  }

  const locationArea = String(body.locationArea || 'other')
  if (!LOCATION_VALUES.has(locationArea)) {
    return NextResponse.json({ error: 'Invalid location area' }, { status: 400 })
  }
  const locationText = body.locationText ? String(body.locationText).trim() || null : null
  if (locationArea === 'other' && !locationText) {
    return NextResponse.json({ error: 'Location details required when location is Other' }, { status: 400 })
  }

  const operationalArea = String(body.operationalArea || 'other')
  if (!OPERATIONAL_VALUES.has(operationalArea)) {
    return NextResponse.json({ error: 'Invalid operational area' }, { status: 400 })
  }

  const description = String(body.description || '').trim()
  if (!description || description.length < 50) {
    return NextResponse.json({ error: 'Description must be at least 50 characters' }, { status: 400 })
  }

  const contributingRaw = Array.isArray(body.contributingFactors) ? body.contributingFactors : []
  const contributing_factors = contributingRaw
    .map((x: unknown) => String(x).toUpperCase())
    .filter((x: string) => CONTRIBUTING_VALUES.has(x))

  const icaoRaw = Array.isArray(body.icaoCategories) ? body.icaoCategories : []
  const icao_high_risk_categories = icaoRaw
    .map((x: unknown) => String(x).toUpperCase().replace(/\s+/g, '_'))
    .map((x: string) => (x === 'LOC_I' ? 'LOC-I' : x))
    .filter((x: string) => ICAO_VALUES.has(x))

  const attachments = Array.isArray(body.attachments) ? body.attachments : []
  if (attachments.length > MAX_ATTACHMENTS) {
    return NextResponse.json({ error: `At most ${MAX_ATTACHMENTS} attachments` }, { status: 400 })
  }

  const insertPayload = {
    report_number: reportNumber,
    report_type: reportType,
    status: 'NEW',
    occurred_at: body.occurredAt || new Date().toISOString(),
    location_area: locationArea,
    location_text: locationText,
    operational_area: operationalArea,
    description,
    what_happened: body.whatHappened ? String(body.whatHappened).trim() || null : null,
    immediate_actions: body.immediateActions ? String(body.immediateActions).trim() || null : null,
    affected_party: body.affectedParty ? String(body.affectedParty).trim() || null : null,
    contributing_factors,
    icao_high_risk_categories,
    attachments,
    is_anonymous: isAnonymous,
    reporter_id: isAnonymous ? null : user.id,
    reporter_department_id: isAnonymous ? null : profile.departmentId ?? null,
    safety_protected: true,
  }

  const { data, error } = await supabase.from('sms_reports').insert(insertPayload).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })

  await notifySmsReportSubmitted(supabase, {
    reportId: String(data.id),
    reportNumber: String(data.report_number),
    operationalArea: String(data.operational_area),
  })

  const auditNewValue = isAnonymous
    ? {
        id: data.id,
        report_number: data.report_number,
        is_anonymous: true,
        operational_area: data.operational_area,
        report_type: data.report_type,
      }
    : data

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_reports',
    recordId: String(data.id),
    newValue: auditNewValue,
  })
  return NextResponse.json(data, { status: 201 })
}
