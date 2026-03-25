import { NextResponse } from 'next/server'
import { canManageSmsPersonnel } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsPersonnel(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    appointmentDate?: string | null
    appointmentLetterUrl?: string | null
    operationalArea?: string | null
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('sms_personnel')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Personnel record not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('appointmentDate' in body) updates.appointment_date = body.appointmentDate
  if (body.appointmentLetterUrl !== undefined) {
    updates.appointment_letter_url = body.appointmentLetterUrl
  }
  if ('operationalArea' in body) updates.operational_area = body.operationalArea

  const { data, error } = await supabase.from('sms_personnel').update(updates).eq('id', id).select('*').single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update personnel record' }, { status: 500 })
  }

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_personnel',
    recordId: id,
    oldValue: existing,
    newValue: data,
  })

  return NextResponse.json(data)
}
