import { NextResponse } from 'next/server'
import { canManageSmsSpis, canReadSmsDashboard } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

export async function GET() {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReadSmsDashboard(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase.from('sms_spis').select('*').order('spi_code')
  if (error) return NextResponse.json({ error: 'Failed to fetch SPIs' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsSpis(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const code = typeof body.spiCode === 'string' ? body.spiCode.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!code || !name) {
    return NextResponse.json({ error: 'spiCode and name are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sms_spis')
    .insert({
      spi_code: code,
      name,
      description: body.description ?? null,
      measurement_method: body.measurementMethod ?? null,
      data_source: 'MANUAL',
      reporting_frequency: typeof body.reportingFrequency === 'string' ? body.reportingFrequency : 'MONTHLY',
      target_value: body.targetValue != null ? Number(body.targetValue) : null,
      alert_level: body.alertLevel != null ? Number(body.alertLevel) : null,
      calculation_key: null,
      is_system_spi: false,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to create SPI' }, { status: 500 })
  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_spis',
    recordId: String(data.id),
    newValue: data,
  })
  return NextResponse.json(data, { status: 201 })
}
