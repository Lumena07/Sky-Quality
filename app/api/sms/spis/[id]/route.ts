import { NextResponse } from 'next/server'
import { canManageSmsSpis, canReadSmsDashboard } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReadSmsDashboard(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase.from('sms_spis').select('*').eq('id', params.id).maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsSpis(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing, error: fetchErr } = await supabase.from('sms_spis').select('*').eq('id', params.id).single()
  if (fetchErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const row = existing as { is_system_spi?: boolean }
  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (typeof body.name === 'string') updates.name = body.name.trim()
  if (body.description !== undefined) updates.description = body.description
  if (typeof body.measurementMethod === 'string') {
    updates.measurement_method = body.measurementMethod.trim() || null
  }
  if (typeof body.reportingFrequency === 'string') updates.reporting_frequency = body.reportingFrequency
  if (body.targetValue !== undefined) updates.target_value = body.targetValue == null ? null : Number(body.targetValue)
  if (body.alertLevel !== undefined) updates.alert_level = body.alertLevel == null ? null : Number(body.alertLevel)

  if (row.is_system_spi && body.calculationKey !== undefined) {
    return NextResponse.json({ error: 'Cannot change calculation key on system SPI' }, { status: 400 })
  }
  if (!row.is_system_spi && body.dataSource !== undefined) {
    updates.data_source = body.dataSource
  }

  const { data, error } = await supabase.from('sms_spis').update(updates).eq('id', params.id).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_spis',
    recordId: params.id,
    oldValue: existing,
    newValue: data,
  })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsSpis(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing, error: fetchErr } = await supabase.from('sms_spis').select('*').eq('id', params.id).single()
  if (fetchErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('sms_spis').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'DELETE',
    module: 'sms_spis',
    recordId: params.id,
    oldValue: existing,
  })
  return new NextResponse(null, { status: 204 })
}
