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
    qualificationName?: string
    awardingBody?: string | null
    dateObtained?: string | null
    expiryDate?: string | null
    certificateUrl?: string | null
  }

  if (!body.qualificationName?.trim()) {
    return NextResponse.json({ error: 'Qualification name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sms_qualifications')
    .insert({
      personnel_id: personnelId,
      qualification_name: body.qualificationName.trim(),
      awarding_body: body.awardingBody ?? null,
      date_obtained: body.dateObtained || null,
      expiry_date: body.expiryDate || null,
      certificate_url: body.certificateUrl ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to add qualification' }, { status: 500 })
  }

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_qualifications',
    recordId: String(data.id),
    newValue: data,
  })

  return NextResponse.json(data, { status: 201 })
}
