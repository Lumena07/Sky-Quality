import { NextResponse } from 'next/server'
import { canReadSmsDashboard, canViewSmsProtectedData } from '@/lib/sms-permissions'
import { getSmsAuthContext } from '@/lib/sms'

/** SMS-only audit dates for assurance calendar (no QMS audits). */
export async function GET() {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReadSmsDashboard(profile.roles) && !canViewSmsProtectedData(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('sms_audits')
    .select('id, title, planned_date, actual_date, status, audit_type, operational_area')
    .order('planned_date', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  return NextResponse.json({ smsAudits: data ?? [] })
}
