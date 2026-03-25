import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile } from '@/lib/permissions'
import { canViewSmsProtectedData } from '@/lib/sms-permissions'
import { createSmsAuditLog, nextSmsIdentifier } from '@/lib/sms'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getCurrentUserProfile(supabase, user.id)
  if (!canViewSmsProtectedData(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { data: finding, error: findError } = await supabase
    .from('Finding')
    .select('id, findingNumber, description')
    .eq('id', id)
    .single()
  if (findError || !finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 })

  const reportNumber = await nextSmsIdentifier('sms_report', 'SMS-RPT')
  const { data, error } = await supabase
    .from('sms_reports')
    .insert({
      report_number: reportNumber,
      report_type: 'Hazard',
      occurred_at: new Date().toISOString(),
      location_area: 'other',
      operational_area: profile.safetyOperationalArea || 'all',
      description: String(finding.description ?? 'Promoted from QMS finding').padEnd(50, '.'),
      what_happened: `Promoted from QMS finding ${finding.findingNumber}`,
      is_anonymous: false,
      reporter_id: user.id,
      source_qms_finding_id: finding.id,
      safety_protected: true,
    })
    .select('*')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Failed to promote finding to SMS' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_reports',
    recordId: String(data.id),
    newValue: data,
  })

  return NextResponse.json(data, { status: 201 })
}
