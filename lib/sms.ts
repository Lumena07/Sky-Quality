import { randomUUID } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { DIRECTOR_OF_SAFETY_ROLE, getCurrentUserProfile } from '@/lib/permissions'

type SmsSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

/** Notify Director of Safety and relevant Safety Officers when a new report is submitted. */
export const notifySmsReportSubmitted = async (
  supabase: SmsSupabase,
  params: { reportId: string; reportNumber: string; operationalArea: string }
) => {
  const userIds = new Set<string>()
  const { data: dosRows } = await supabase
    .from('User')
    .select('id')
    .eq('isActive', true)
    .contains('roles', [DIRECTOR_OF_SAFETY_ROLE])
  for (const row of dosRows ?? []) {
    if (row?.id) userIds.add(String(row.id))
  }

  const { data: soRows } = await supabase
    .from('sms_personnel')
    .select('user_id, operational_area')
    .eq('post_holder_type', 'SAFETY_OFFICER')

  const area = params.operationalArea
  for (const row of soRows ?? []) {
    const oa = row.operational_area as string | null
    if (oa === 'all' || oa === area) {
      if (row.user_id) userIds.add(String(row.user_id))
    }
  }

  const activeIds = Array.from(userIds).filter(Boolean)
  if (activeIds.length === 0) return

  const { data: activeUsers } = await supabase
    .from('User')
    .select('id')
    .eq('isActive', true)
    .in('id', activeIds)

  const allowed = new Set((activeUsers ?? []).map((u) => String(u.id)))
  const link = `/sms/risk/report?reportId=${params.reportId}`
  const notifications = activeIds
    .filter((id) => allowed.has(id))
    .map((userId) => ({
      id: randomUUID(),
      userId,
      type: 'SYSTEM_ALERT',
      title: 'New safety occurrence report',
      message: `Report ${params.reportNumber} was submitted and requires attention.`,
      link,
      findingId: null as string | null,
    }))

  if (notifications.length === 0) return
  const { error } = await supabase.from('Notification').insert(notifications)
  if (error) console.error('notifySmsReportSubmitted:', error)
}

/** Notify attendees when safety meeting minutes are first published. */
export const notifyMeetingMinutesPublished = async (
  supabase: SmsSupabase,
  params: { attendeeUserIds: string[]; meetingTitle: string; meetingId: string; meetingNumber: string }
) => {
  const unique = Array.from(new Set(params.attendeeUserIds.filter(Boolean)))
  if (unique.length === 0) return

  const { data: activeUsers } = await supabase.from('User').select('id').eq('isActive', true).in('id', unique)
  const allowed = new Set((activeUsers ?? []).map((u) => String(u.id)))
  const link = `/sms/assurance/meetings?meetingId=${params.meetingId}`
  const notifications = unique
    .filter((id) => allowed.has(id))
    .map((userId) => ({
      id: randomUUID(),
      userId,
      type: 'SYSTEM_ALERT' as const,
      title: 'Safety meeting minutes published',
      message: `Minutes for ${params.meetingTitle} (${params.meetingNumber}) are available.`,
      link,
      findingId: null as string | null,
    }))

  if (notifications.length === 0) return
  const { error } = await supabase.from('Notification').insert(notifications)
  if (error) console.error('notifyMeetingMinutesPublished:', error)
}

export const nextSmsIdentifier = async (
  key: string,
  prefix: string
): Promise<string> => {
  const supabase = createSupabaseServerClient()
  const year = new Date().getFullYear()
  const { data: existing } = await supabase
    .from('sms_identifiers')
    .select('key, year, seq')
    .eq('key', key)
    .maybeSingle()

  if (!existing) {
    await supabase.from('sms_identifiers').insert({ key, year, seq: 1 })
    return `${prefix}-${year}-0001`
  }

  const seq = existing.year === year ? Number(existing.seq) + 1 : 1
  await supabase
    .from('sms_identifiers')
    .update({ seq, year, updated_at: new Date().toISOString() })
    .eq('key', key)

  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}

export const createSmsAuditLog = async (payload: {
  userId: string
  actionType: string
  module: string
  recordId: string
  oldValue?: unknown
  newValue?: unknown
}) => {
  const supabase = createSupabaseServerClient()
  await supabase.from('sms_audit_log').insert({
    user_id: payload.userId,
    action_type: payload.actionType,
    module: payload.module,
    record_id: payload.recordId,
    old_value: payload.oldValue ?? null,
    new_value: payload.newValue ?? null,
  })
}

export const getSmsAuthContext = async () => {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { supabase, user: null, profile: null }
  const profile = await getCurrentUserProfile(supabase, user.id)
  return { supabase, user, profile }
}
