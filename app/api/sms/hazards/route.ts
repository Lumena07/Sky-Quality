import { NextResponse } from 'next/server'
import { canViewSmsHazardRegister } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext, nextSmsIdentifier } from '@/lib/sms'
import { HAZARD_CATEGORIES, HAZARD_SOURCE_TYPES, HAZARD_STATUSES, ICAO_HIGH_RISK_CATEGORIES } from '@/lib/sms-risk-constants'
import { riskIndexToLevel } from '@/lib/sms-risk-constants'

const SOURCE_VALUES = new Set<string>(HAZARD_SOURCE_TYPES.map((s) => s.value))
const CATEGORY_VALUES = new Set<string>(HAZARD_CATEGORIES.map((c) => c.value))
const STATUS_VALUES = new Set<string>(HAZARD_STATUSES.map((s) => s.value))
const OPERATIONAL_AREAS = new Set([
  'airline_ops',
  'mro_maintenance',
  'airport_ground_ops',
  'all',
  'other',
])
const ICAO_VALUES = new Set<string>(ICAO_HIGH_RISK_CATEGORIES.map((c) => c.value))

const defaultReviewDate = (fromIso: string): string => {
  const d = new Date(fromIso)
  d.setMonth(d.getMonth() + 12)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsHazardRegister(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const embedded = await supabase
    .from('sms_hazards')
    .select('*, sms_hazard_mitigations(*)')
    .order('created_at', { ascending: false })

  if (!embedded.error && embedded.data) {
    return NextResponse.json(embedded.data)
  }

  const plain = await supabase.from('sms_hazards').select('*').order('created_at', { ascending: false })
  if (plain.error) {
    console.error('sms_hazards GET:', embedded.error ?? plain.error)
    return NextResponse.json({ error: 'Failed to fetch hazards' }, { status: 500 })
  }
  return NextResponse.json(plain.data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsHazardRegister(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const hazardNumber = await nextSmsIdentifier('sms_hazard', 'SMS-HAZ')

  const title = String(body.title || '').trim()
  const description = String(body.description || '').trim()
  if (!title || !description) {
    return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
  }

  const sourceType = String(body.sourceType || 'MANUAL').toUpperCase()
  if (!SOURCE_VALUES.has(sourceType)) {
    return NextResponse.json({ error: 'Invalid source type' }, { status: 400 })
  }
  const sourceReportId = body.sourceReportId || body.reportId || null
  if (sourceType === 'LINKED_REPORT' && !sourceReportId) {
    return NextResponse.json({ error: 'Linked report is required for this source' }, { status: 400 })
  }

  const operationalArea = String(body.operationalArea || profile.safetyOperationalArea || 'all')
  if (!OPERATIONAL_AREAS.has(operationalArea)) {
    return NextResponse.json({ error: 'Invalid operational area' }, { status: 400 })
  }

  const hazardCategory = body.hazardCategory ? String(body.hazardCategory).toUpperCase() : null
  if (hazardCategory && !CATEGORY_VALUES.has(hazardCategory)) {
    return NextResponse.json({ error: 'Invalid hazard category' }, { status: 400 })
  }

  const status = body.status ? String(body.status).toUpperCase() : 'OPEN'
  if (!STATUS_VALUES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const icaoRaw = Array.isArray(body.icaoHighRiskCategories) ? body.icaoHighRiskCategories : []
  const icao_high_risk_categories = icaoRaw
    .map((x: unknown) => String(x).toUpperCase().replace(/\s+/g, '_'))
    .map((x: string) => (x === 'LOC_I' ? 'LOC-I' : x))
    .filter((x: string) => ICAO_VALUES.has(x))

  const hasInitialScore =
    body.initialLikelihood !== undefined &&
    body.initialLikelihood !== null &&
    body.initialSeverity !== undefined &&
    body.initialSeverity !== null
  const initialLikelihood = hasInitialScore ? Math.min(5, Math.max(1, Number(body.initialLikelihood))) : null
  const initialSeverity = hasInitialScore ? Math.min(5, Math.max(1, Number(body.initialSeverity))) : null
  const initialRiskIndex = hasInitialScore ? Number(initialLikelihood) * Number(initialSeverity) : null
  const initialRiskLevel = hasInitialScore ? riskIndexToLevel(Number(initialRiskIndex)) : null

  const identifiedAt = body.identifiedAt ? String(body.identifiedAt) : new Date().toISOString()
  const reviewDate =
    body.reviewDate != null && body.reviewDate !== ''
      ? String(body.reviewDate).slice(0, 10)
      : hasInitialScore
        ? defaultReviewDate(identifiedAt)
        : null

  const { data, error } = await supabase
    .from('sms_hazards')
    .insert({
      hazard_number: hazardNumber,
      title,
      description,
      source_type: sourceType,
      source_report_id: sourceType === 'LINKED_REPORT' ? sourceReportId : null,
      operational_area: operationalArea,
      hazard_category: hazardCategory,
      icao_high_risk_categories,
      identified_at: identifiedAt,
      identified_by: user.id,
      initial_likelihood: initialLikelihood,
      initial_severity: initialSeverity,
      initial_risk_index: initialRiskIndex,
      initial_risk_level: initialRiskLevel,
      status: hasInitialScore ? status : 'PENDING_ASSESSMENT',
      review_date: reviewDate,
      safety_protected: true,
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to create hazard' }, { status: 500 })
  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_hazards',
    recordId: String(data.id),
    newValue: data,
  })
  return NextResponse.json(data, { status: 201 })
}
