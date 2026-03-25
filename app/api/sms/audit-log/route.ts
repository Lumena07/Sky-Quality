import { NextResponse } from 'next/server'
import { canViewSmsProtectedData } from '@/lib/sms-permissions'
import { getSmsAuthContext } from '@/lib/sms'

export async function GET() {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsProtectedData(profile.roles) && !profile.roles.includes('ACCOUNTABLE_MANAGER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { data, error } = await supabase.from('sms_audit_log').select('*').order('occurred_at', { ascending: false }).limit(500)
  if (error) return NextResponse.json({ error: 'Failed to fetch SMS audit log' }, { status: 500 })
  return NextResponse.json(data ?? [])
}
