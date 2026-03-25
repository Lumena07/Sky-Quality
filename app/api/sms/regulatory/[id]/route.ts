import { NextResponse } from 'next/server'
import { canManageSmsRegulatory, canViewSmsRegulatory } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'
import { REGULATORY_REPORT_TYPES, REGULATORY_STATUSES } from '@/lib/sms-workflow-constants'

const TYPE_SET = new Set<string>(REGULATORY_REPORT_TYPES.map((t) => t.value))
const STATUS_SET = new Set<string>(REGULATORY_STATUSES.map((s) => s.value))

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsRegulatory(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase.from('sms_regulatory_reports').select('*').eq('id', id).maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsRegulatory(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: row, error: fetchErr } = await supabase.from('sms_regulatory_reports').select('*').eq('id', id).maybeSingle()
  if (fetchErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.reportType !== undefined) {
    const t = String(body.reportType).toUpperCase()
    if (!TYPE_SET.has(t)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    updates.report_type = t
  }
  if (body.status !== undefined) {
    const s = String(body.status).toUpperCase()
    if (!STATUS_SET.has(s)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    updates.status = s
  }
  if (body.submissionDate !== undefined) updates.submission_date = body.submissionDate || null
  if (body.submissionMethod !== undefined) updates.submission_method = body.submissionMethod
  if (body.authorityReferenceNumber !== undefined) updates.authority_reference_number = body.authorityReferenceNumber
  if (body.initialDeadlineAt !== undefined) updates.initial_deadline_at = body.initialDeadlineAt || null
  if (body.regulatoryAuthorityId !== undefined) updates.regulatory_authority_id = body.regulatoryAuthorityId || null
  if (body.regulatoryAuthority !== undefined) updates.regulatory_authority = body.regulatoryAuthority

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'No valid updates' }, { status: 400 })
  }

  const { data, error } = await supabase.from('sms_regulatory_reports').update(updates).eq('id', id).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_regulatory_reports',
    recordId: id,
    oldValue: row,
    newValue: data,
  })
  return NextResponse.json(data)
}
