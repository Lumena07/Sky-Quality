import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canManageSmsPersonnel } from '@/lib/sms-permissions'
import { getCurrentUserProfile } from '@/lib/permissions'

/** Operational areas that require a dedicated Safety Officer assignment (exclude enum value `all`). */
const COVERAGE_AREAS = ['airline_ops', 'mro_maintenance', 'airport_ground_ops', 'other'] as const

const AREA_LABEL: Record<(typeof COVERAGE_AREAS)[number], string> = {
  airline_ops: 'Airline Ops',
  mro_maintenance: 'MRO-Maintenance',
  airport_ground_ops: 'Airport-Ground Ops',
  other: 'Other',
}

/**
 * GET: For DoS — list operational area labels with no active Safety Officer assigned
 * (sms_personnel.post_holder_type = SAFETY_OFFICER and matching operational_area, or area `all`).
 */
export async function GET() {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!canManageSmsPersonnel(roles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: personnelRows, error: pErr } = await supabase
      .from('sms_personnel')
      .select('user_id, operational_area, post_holder_type')
      .eq('post_holder_type', 'SAFETY_OFFICER')

    if (pErr) {
      console.error('SMS personnel coverage:', pErr)
      return NextResponse.json({ error: 'Failed to load personnel coverage' }, { status: 500 })
    }

    const userIds = Array.from(
      new Set((personnelRows ?? []).map((r) => String(r.user_id)).filter(Boolean))
    )
    let activeUserIds = new Set<string>()
    if (userIds.length > 0) {
      const { data: activeUsers, error: uErr } = await supabase
        .from('User')
        .select('id')
        .eq('isActive', true)
        .in('id', userIds)
      if (uErr) {
        console.error('SMS personnel coverage users:', uErr)
        return NextResponse.json({ error: 'Failed to verify active users' }, { status: 500 })
      }
      activeUserIds = new Set((activeUsers ?? []).map((u) => String(u.id)))
    }

    const coveredAreas = new Set<(typeof COVERAGE_AREAS)[number]>()
    for (const row of personnelRows ?? []) {
      if (!activeUserIds.has(String(row.user_id))) continue
      const area = row.operational_area as string | null
      if (area === 'all') {
        for (const a of COVERAGE_AREAS) coveredAreas.add(a)
      } else if (area && (COVERAGE_AREAS as readonly string[]).includes(area)) {
        coveredAreas.add(area as (typeof COVERAGE_AREAS)[number])
      }
    }

    const gaps: string[] = []
    for (const a of COVERAGE_AREAS) {
      if (!coveredAreas.has(a)) gaps.push(AREA_LABEL[a])
    }

    return NextResponse.json({ gaps })
  } catch (e) {
    console.error('GET /api/sms/personnel/coverage:', e)
    return NextResponse.json({ error: 'Coverage check failed' }, { status: 500 })
  }
}
