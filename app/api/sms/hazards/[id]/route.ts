import { NextResponse } from 'next/server'
import { isAccountableManager, isDirectorOfSafety } from '@/lib/permissions'
import { canManageSmsHazard, canViewSmsHazardRegister } from '@/lib/sms-permissions'
import type { OperationalArea } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'
import {
  HAZARD_CATEGORIES,
  HAZARD_SOURCE_TYPES,
  HAZARD_STATUSES,
  ICAO_HIGH_RISK_CATEGORIES,
  riskIndexToLevel,
} from '@/lib/sms-risk-constants'

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

type RouteParams = { params: Promise<{ id: string }> }

const normalizeIcao = (raw: unknown[]): string[] =>
  raw
    .map((x) => String(x).toUpperCase().replace(/\s+/g, '_'))
    .map((x: string) => (x === 'LOC_I' ? 'LOC-I' : x))
    .filter((x: string) => ICAO_VALUES.has(x))

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsHazardRegister(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const embedded = await supabase
    .from('sms_hazards')
    .select('*, sms_hazard_mitigations(*)')
    .eq('id', id)
    .maybeSingle()

  if (!embedded.error && embedded.data) {
    return NextResponse.json(embedded.data)
  }

  const plain = await supabase.from('sms_hazards').select('*').eq('id', id).maybeSingle()
  if (plain.error || !plain.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(plain.data)
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row, error: fetchErr } = await supabase
    .from('sms_hazards')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const hazardArea = row.operational_area as OperationalArea
  if (!canManageSmsHazard(profile.roles, profile.safetyOperationalArea as OperationalArea | null, hazardArea)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.title !== undefined) updates.title = String(body.title).trim()
  if (body.description !== undefined) updates.description = String(body.description).trim()

  if (body.sourceType !== undefined) {
    const v = String(body.sourceType).toUpperCase()
    if (!SOURCE_VALUES.has(v)) return NextResponse.json({ error: 'Invalid source type' }, { status: 400 })
    updates.source_type = v
  }
  if (body.sourceReportId !== undefined || body.reportId !== undefined) {
    updates.source_report_id = body.sourceReportId || body.reportId || null
  }

  if (body.operationalArea !== undefined) {
    const v = String(body.operationalArea)
    if (!OPERATIONAL_AREAS.has(v)) return NextResponse.json({ error: 'Invalid operational area' }, { status: 400 })
    updates.operational_area = v
  }

  if (body.hazardCategory !== undefined) {
    const v = body.hazardCategory ? String(body.hazardCategory).toUpperCase() : null
    if (v && !CATEGORY_VALUES.has(v)) {
      return NextResponse.json({ error: 'Invalid hazard category' }, { status: 400 })
    }
    updates.hazard_category = v
  }

  if (body.icaoHighRiskCategories !== undefined) {
    const arr = Array.isArray(body.icaoHighRiskCategories) ? body.icaoHighRiskCategories : []
    updates.icao_high_risk_categories = normalizeIcao(arr)
  }

  if (body.identifiedAt !== undefined) updates.identified_at = String(body.identifiedAt)

  if (body.reviewDate !== undefined) {
    updates.review_date =
      body.reviewDate != null && body.reviewDate !== '' ? String(body.reviewDate).slice(0, 10) : null
  }

  if (body.status !== undefined) {
    const v = String(body.status).toUpperCase()
    if (!STATUS_VALUES.has(v)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    updates.status = v
  }

  let initialL = row.initial_likelihood != null ? Number(row.initial_likelihood) : 1
  let initialS = row.initial_severity != null ? Number(row.initial_severity) : 1
  if (body.initialLikelihood !== undefined) {
    initialL = Math.min(5, Math.max(1, Number(body.initialLikelihood)))
    updates.initial_likelihood = initialL
  }
  if (body.initialSeverity !== undefined) {
    initialS = Math.min(5, Math.max(1, Number(body.initialSeverity)))
    updates.initial_severity = initialS
  }
  if (body.initialLikelihood !== undefined || body.initialSeverity !== undefined) {
    const idx = initialL * initialS
    updates.initial_risk_index = idx
    updates.initial_risk_level = riskIndexToLevel(idx)
  }

  const hadResidual = row.residual_likelihood != null
  const initialTouched = body.initialLikelihood !== undefined || body.initialSeverity !== undefined
  const residualExplicitTouched = body.residualLikelihood !== undefined
  const residualRecomputeFromInitial = initialTouched && hadResidual && !residualExplicitTouched

  if (residualExplicitTouched) {
    const resL = Math.min(5, Math.max(1, Number(body.residualLikelihood)))
    updates.residual_likelihood = resL
    updates.residual_severity = initialS
  } else if (residualRecomputeFromInitial) {
    updates.residual_severity = initialS
  }

  const residualTouched = residualExplicitTouched || residualRecomputeFromInitial

  if (residualTouched) {
    const rL = residualExplicitTouched
      ? Number(updates.residual_likelihood)
      : Number(row.residual_likelihood)
    const rS = initialS
    const rIdx = rL * rS
    const rLevel = riskIndexToLevel(rIdx)
    updates.residual_risk_index = rIdx
    updates.residual_risk_level = rLevel

    if (rLevel === 'ACCEPTABLE') {
      updates.risk_acceptance_status = 'AUTO_ACCEPTED'
      updates.risk_accepted_by = null
      updates.risk_accepted_at = new Date().toISOString()
      updates.risk_acceptance_signature = null
    } else if (rLevel === 'ALARP') {
      if (body.dosRiskAcceptance === true) {
        if (!isDirectorOfSafety(profile.roles)) {
          return NextResponse.json({ error: 'Only Director of Safety can accept ALARP risk' }, { status: 403 })
        }
        updates.risk_acceptance_status = 'ACCEPTED_BY_DOS'
        updates.risk_accepted_by = user.id
        updates.risk_accepted_at = new Date().toISOString()
        updates.risk_acceptance_signature = null
      } else if (residualTouched) {
        updates.risk_acceptance_status = 'PENDING_DOS'
        updates.risk_accepted_by = null
        updates.risk_accepted_at = null
        updates.risk_acceptance_signature = null
      }
    } else {
      if (body.riskAcceptanceSignature) {
        if (!isAccountableManager(profile.roles)) {
          return NextResponse.json(
            { error: 'Only Accountable Manager can sign unacceptable residual risk' },
            { status: 403 }
          )
        }
        updates.risk_acceptance_status = 'ACCEPTED_BY_AM'
        updates.risk_accepted_by = user.id
        updates.risk_accepted_at = new Date().toISOString()
        updates.risk_acceptance_signature = String(body.riskAcceptanceSignature)
      } else if (residualTouched) {
        updates.risk_acceptance_status = 'PENDING_AM'
        updates.risk_accepted_by = null
        updates.risk_accepted_at = null
        updates.risk_acceptance_signature = null
      }
    }
  } else if (body.dosRiskAcceptance === true) {
    const rL =
      row.residual_likelihood != null ? Number(row.residual_likelihood) : Number(row.initial_likelihood ?? 1)
    const rS = Number(row.initial_severity ?? 1)
    const rLevel = riskIndexToLevel(rL * rS)
    if (rLevel !== 'ALARP') {
      return NextResponse.json({ error: 'DoS acceptance only applies to ALARP residual risk' }, { status: 400 })
    }
    if (!isDirectorOfSafety(profile.roles)) {
      return NextResponse.json({ error: 'Only Director of Safety can accept ALARP risk' }, { status: 403 })
    }
    updates.risk_acceptance_status = 'ACCEPTED_BY_DOS'
    updates.risk_accepted_by = user.id
    updates.risk_accepted_at = new Date().toISOString()
    updates.risk_acceptance_signature = null
  } else if (body.riskAcceptanceSignature) {
    const rL =
      row.residual_likelihood != null ? Number(row.residual_likelihood) : Number(row.initial_likelihood ?? 1)
    const rS = Number(row.initial_severity ?? 1)
    const rLevel = riskIndexToLevel(rL * rS)
    if (rLevel !== 'UNACCEPTABLE') {
      return NextResponse.json(
        { error: 'Accountable Manager signature only applies to unacceptable residual risk' },
        { status: 400 }
      )
    }
    if (!isAccountableManager(profile.roles)) {
      return NextResponse.json(
        { error: 'Only Accountable Manager can sign unacceptable residual risk' },
        { status: 403 }
      )
    }
    updates.risk_acceptance_status = 'ACCEPTED_BY_AM'
    updates.risk_accepted_by = user.id
    updates.risk_accepted_at = new Date().toISOString()
    updates.risk_acceptance_signature = String(body.riskAcceptanceSignature)
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase.from('sms_hazards').update(updates).eq('id', id).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Failed to update hazard' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_hazards',
    recordId: id,
    oldValue: row,
    newValue: data,
  })

  return NextResponse.json(data)
}
