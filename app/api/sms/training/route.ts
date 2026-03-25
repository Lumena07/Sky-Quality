import { NextResponse } from 'next/server'
import {
  canManageSmsPolicy,
  canViewAllSmsTrainingInMySafetyPortal,
} from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

export async function GET(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const portal = new URL(request.url).searchParams.get('portal')
  const roles = profile?.roles ?? []

  let query = supabase.from('sms_training_staff').select('*').order('created_at', { ascending: false })
  if (portal === 'my-safety' && !canViewAllSmsTrainingInMySafetyPortal(roles)) {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Failed to fetch training' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsPolicy(profile.roles) && !profile.roles.includes('DEPARTMENT_HEAD')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const { data, error } = await supabase
    .from('sms_training_staff')
    .insert({
      user_id: body.userId,
      training_type: body.trainingType,
      delivery_method: body.deliveryMethod || null,
      completed_at: body.completedAt || null,
      expiry_date: body.expiryDate || null,
      certificate_url: body.certificateUrl || null,
      recorded_by: user.id,
    })
    .select('*')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Failed to save training' }, { status: 500 })
  await createSmsAuditLog({ userId: user.id, actionType: 'CREATE', module: 'sms_training_staff', recordId: String(data.id), newValue: data })
  return NextResponse.json(data, { status: 201 })
}
