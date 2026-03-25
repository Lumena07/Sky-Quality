import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [qms, sms] = await Promise.all([
    supabase.from('Audit').select('id, title, plannedDate, startDate, endDate, status'),
    supabase.from('sms_audits').select('id, title, planned_date, actual_date, status'),
  ])

  if (qms.error || sms.error) {
    return NextResponse.json({ error: 'Failed to fetch audit calendar' }, { status: 500 })
  }

  return NextResponse.json({
    qmsAudits: qms.data ?? [],
    smsAudits: sms.data ?? [],
  })
}
