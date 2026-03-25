import { NextResponse } from 'next/server'
import { canManageSmsReport, canReadSmsReport } from '@/lib/sms-permissions'
import type { OperationalArea } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'
import { SMS_REPORT_STATUSES } from '@/lib/sms-risk-constants'

const STATUS_VALUES = new Set<string>(SMS_REPORT_STATUSES.map((s) => s.value))
const REPORT_STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['UNDER_REVIEW', 'CLOSED'],
  UNDER_REVIEW: ['PROMOTED', 'CLOSED'],
  PROMOTED: [],
  CLOSED: [],
}

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row, error } = await supabase.from('sms_reports').select('*').eq('id', id).maybeSingle()
  if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (
    !canReadSmsReport(profile.roles, user.id, profile.departmentId, {
      reporter_id: row.reporter_id as string | null,
      reporter_department_id: row.reporter_department_id as string | null,
      is_anonymous: Boolean(row.is_anonymous),
      operational_area: String(row.operational_area),
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(row)
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row, error: fetchErr } = await supabase.from('sms_reports').select('*').eq('id', id).maybeSingle()
  if (fetchErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const reportArea = row.operational_area as OperationalArea
  if (!canManageSmsReport(profile.roles, profile.safetyOperationalArea as OperationalArea | null, reportArea)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.status !== undefined) {
    const status = String(body.status).toUpperCase()
    if (!STATUS_VALUES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    const current = String(row.status || 'NEW').toUpperCase()
    if (status !== current) {
      const allowed = REPORT_STATUS_TRANSITIONS[current] ?? []
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Invalid transition from ${current} to ${status}` },
          { status: 400 }
        )
      }
    }
    updates.status = status
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase.from('sms_reports').update(updates).eq('id', id).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_reports',
    recordId: id,
    oldValue: row,
    newValue: data,
  })

  return NextResponse.json(data)
}
