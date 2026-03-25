import { NextResponse } from 'next/server'
import { canManageSmsPersonnel } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: personnelId } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsPersonnel(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: parent, error: pErr } = await supabase
    .from('sms_personnel')
    .select('id')
    .eq('id', personnelId)
    .maybeSingle()

  if (pErr || !parent) {
    return NextResponse.json({ error: 'Personnel record not found' }, { status: 404 })
  }

  const body = (await request.json()) as {
    notifiedAt?: string
    authorityName?: string
    method?: string | null
    referenceNumber?: string | null
  }

  if (!body.notifiedAt || !body.authorityName?.trim()) {
    return NextResponse.json(
      { error: 'Notification date and authority name are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('sms_personnel_regulatory_notifications')
    .insert({
      personnel_id: personnelId,
      notified_at: body.notifiedAt,
      authority_name: body.authorityName.trim(),
      method: body.method ?? null,
      reference_number: body.referenceNumber ?? null,
      notified_by_id: user.id,
    })
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to add regulatory notification' }, { status: 500 })
  }

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_personnel_regulatory_notifications',
    recordId: String(data.id),
    newValue: data,
  })

  return NextResponse.json(data, { status: 201 })
}
