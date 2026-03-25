import { NextResponse } from 'next/server'
import { canManageSmsSpis, canReadSmsDashboard } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReadSmsDashboard(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('sms_spi_values')
    .select('*')
    .eq('spi_id', params.id)
    .order('period_start', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch values' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsSpis(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: spi, error: spiErr } = await supabase.from('sms_spis').select('id, calculation_key').eq('id', params.id).single()
  if (spiErr || !spi) return NextResponse.json({ error: 'SPI not found' }, { status: 404 })
  if (spi.calculation_key) {
    return NextResponse.json({ error: 'Manual values are only for non-auto SPIs' }, { status: 400 })
  }

  const body = await request.json()
  const periodStart = typeof body.periodStart === 'string' ? body.periodStart.slice(0, 10) : ''
  const periodEnd = typeof body.periodEnd === 'string' ? body.periodEnd.slice(0, 10) : ''
  const value = body.value != null ? Number(body.value) : NaN
  if (!periodStart || !periodEnd || Number.isNaN(value)) {
    return NextResponse.json({ error: 'periodStart, periodEnd, and value are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sms_spi_values')
    .upsert(
      {
        spi_id: params.id,
        period_start: periodStart,
        period_end: periodEnd,
        value,
        notes: body.notes ?? null,
      },
      { onConflict: 'spi_id,period_start,period_end' }
    )
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to save value' }, { status: 500 })
  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPSERT',
    module: 'sms_spi_values',
    recordId: String(data.id),
    newValue: data,
  })
  return NextResponse.json(data, { status: 201 })
}
