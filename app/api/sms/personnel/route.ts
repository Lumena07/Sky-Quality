import { NextRequest, NextResponse } from 'next/server'
import { canManageSmsPersonnel, canViewSmsPersonnel } from '@/lib/sms-permissions'
import { collectPersonnelExpiryDates, computeCurrencyFromExpiries } from '@/lib/sms-pillar1'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

const attachCurrency = (
  row: Record<string, unknown>,
  quals: { expiry_date?: string | null }[],
  training: { expiry_date?: string | null }[]
) => {
  const dates = collectPersonnelExpiryDates(quals, training)
  return {
    ...row,
    _computed_currency: computeCurrencyFromExpiries(dates),
    sms_qualifications: quals,
    sms_training_personnel: training,
  }
}

export async function GET(request: NextRequest) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const expand = request.nextUrl.searchParams.get('expand') === '1'

  const { data, error } = await supabase
    .from('sms_personnel')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Failed to fetch personnel' }, { status: 500 })

  const rows = data ?? []
  const filtered = rows.filter((row) => canViewSmsPersonnel(profile.roles, user.id, String(row.user_id)))

  if (!expand) {
    return NextResponse.json(filtered)
  }

  const ids = filtered.map((r) => r.id)
  const [{ data: allQuals }, { data: allTraining }] = await Promise.all([
    ids.length
      ? supabase.from('sms_qualifications').select('*').in('personnel_id', ids)
      : Promise.resolve({ data: [] as { personnel_id: string; expiry_date?: string | null }[] }),
    ids.length
      ? supabase.from('sms_training_personnel').select('*').in('personnel_id', ids)
      : Promise.resolve({ data: [] as { personnel_id: string; expiry_date?: string | null }[] }),
  ])

  const qualsByPid = new Map<string, { expiry_date?: string | null }[]>()
  for (const q of allQuals ?? []) {
    const pid = String(q.personnel_id)
    const list = qualsByPid.get(pid) ?? []
    list.push(q)
    qualsByPid.set(pid, list)
  }
  const trainByPid = new Map<string, { expiry_date?: string | null }[]>()
  for (const t of allTraining ?? []) {
    const pid = String(t.personnel_id)
    const list = trainByPid.get(pid) ?? []
    list.push(t)
    trainByPid.set(pid, list)
  }

  const shaped = filtered.map((row) => {
    const pid = String(row.id)
    const quals = qualsByPid.get(pid) ?? []
    const training = trainByPid.get(pid) ?? []
    return attachCurrency({ ...row }, quals, training)
  })

  return NextResponse.json(shaped)
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsPersonnel(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('sms_personnel')
    .insert({
      user_id: body.userId,
      post_holder_type: body.postHolderType,
      appointment_letter_url: body.appointmentLetterUrl || null,
      appointment_date: body.appointmentDate || null,
      appointed_by: body.appointedBy || user.id,
      regulatory_notification_date: body.regulatoryNotificationDate || null,
      regulatory_reference_number: body.regulatoryReferenceNumber || null,
      operational_area: body.operationalArea || null,
      currency_status: body.currencyStatus || 'CURRENT',
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to create personnel record' }, { status: 500 })
  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_personnel',
    recordId: String(data.id),
    newValue: data,
  })
  return NextResponse.json(data, { status: 201 })
}
