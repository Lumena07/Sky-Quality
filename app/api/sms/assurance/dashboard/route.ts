import { NextResponse } from 'next/server'
import {
  canReadSmsDashboard,
  getAssuranceOperationalScope,
} from '@/lib/sms-permissions'
import { getSmsAuthContext } from '@/lib/sms'
import { internalAuditComplianceByArea } from '@/lib/sms-internal-audit-compliance'
import {
  alertForKey,
  buildSeriesForCalculationKey,
  fetchAssuranceDashboardBundle,
  meetingCadenceWarnings,
} from '@/lib/sms-spi-queries'
import { isSmsSpiCalculationKey } from '@/lib/sms-spi-keys'

export async function GET() {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReadSmsDashboard(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const scope = getAssuranceOperationalScope(profile.roles, profile.safetyOperationalArea)
  const bundle = await fetchAssuranceDashboardBundle(supabase, scope, { userId: user.id, months: 12 })

  const { data: spiRows, error: spiErr } = await supabase.from('sms_spis').select('*').order('spi_code')
  if (spiErr) return NextResponse.json({ error: 'Failed to load SPIs' }, { status: 500 })

  const spiList = spiRows ?? []
  const spiIds = spiList.map((r: { id: string }) => r.id)
  const oldestStart = bundle.buckets[0]?.periodStart ?? ''

  const { data: valueRows } =
    spiIds.length > 0
      ? await supabase
          .from('sms_spi_values')
          .select('spi_id, period_start, period_end, value')
          .in('spi_id', spiIds)
          .gte('period_start', oldestStart)
      : { data: [] as { spi_id: string; period_start: string; period_end: string; value: number }[] }

  const valuesBySpi = new Map<string, { period_start: string; value: number }[]>()
  for (const v of valueRows ?? []) {
    const id = String((v as { spi_id: string }).spi_id)
    const list = valuesBySpi.get(id) ?? []
    list.push({
      period_start: String((v as { period_start: string }).period_start).slice(0, 10),
      value: Number((v as { value: number }).value),
    })
    valuesBySpi.set(id, list)
  }

  const ctx = {
    hazards: bundle.hazards,
    reports: bundle.reports,
    investigations: bundle.investigations,
    capas: bundle.capas,
    findings: bundle.findings,
    training: bundle.training,
    hazardReviews: bundle.hazardReviews,
    activeUserIds: bundle.activeUserIds,
  }

  const spis = spiList.map((row: Record<string, unknown>) => {
    const id = String(row.id)
    const calcKeyRaw = row.calculation_key as string | null
    const calcKey = isSmsSpiCalculationKey(calcKeyRaw) ? calcKeyRaw : null
    const target = row.target_value != null ? Number(row.target_value) : null
    const alertLevel = row.alert_level != null ? Number(row.alert_level) : null

    let series: { period: string; value: number }[] = []
    let currentValue = 0
    let extra: Record<string, unknown> | undefined

    if (calcKey) {
      const built = buildSeriesForCalculationKey(calcKey, bundle.buckets, ctx)
      series = built.series
      currentValue = built.currentValue
      extra = built.extra
    } else {
      const manualVals = valuesBySpi.get(id) ?? []
      series = bundle.buckets.map((b) => {
        const hit = manualVals.find((m) => m.period_start.slice(0, 7) === b.label.slice(0, 7))
        return { period: b.label, value: hit ? hit.value : 0 }
      })
      currentValue = series[series.length - 1]?.value ?? 0
    }

    const alertState = alertForKey(calcKey, currentValue, target, alertLevel)

    return {
      id,
      spiCode: row.spi_code,
      name: row.name,
      description: row.description,
      measurementMethod: row.measurement_method,
      dataSource: row.data_source,
      reportingFrequency: row.reporting_frequency,
      targetValue: target,
      alertLevel: alertLevel,
      calculationKey: calcKey,
      isSystemSpi: Boolean(row.is_system_spi),
      currentValue,
      alertState,
      series,
      extra,
    }
  })

  return NextResponse.json({
    summary: bundle.summary,
    spis,
    meetingCadence: meetingCadenceWarnings(bundle.meetings),
    internalAuditCompliance: internalAuditComplianceByArea(bundle.auditsForCompliance),
  })
}
