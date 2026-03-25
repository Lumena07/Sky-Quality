import { NextResponse } from 'next/server'
import { canManageSmsPolicy } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext, nextSmsIdentifier } from '@/lib/sms'

export async function GET() {
  const { supabase, user } = await getSmsAuthContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('sms_communications')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Failed to fetch communications' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsPolicy(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const number = await nextSmsIdentifier('sms_communication', 'SMS-COM')
  const { data, error } = await supabase
    .from('sms_communications')
    .insert({
      reference_number: number,
      communication_type: body.communicationType,
      subject: body.subject,
      body: body.body,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      target_audience: Array.isArray(body.targetAudience) ? body.targetAudience : ['All Staff'],
      requires_acknowledgement: Boolean(body.requiresAcknowledgement),
      published_at: new Date().toISOString(),
      expiry_date: body.expiryDate || null,
      created_by: user.id,
    })
    .select('*')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Failed to create communication' }, { status: 500 })
  await createSmsAuditLog({ userId: user.id, actionType: 'CREATE', module: 'sms_communications', recordId: String(data.id), newValue: data })
  return NextResponse.json(data, { status: 201 })
}
